import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setUserTier, userIdForStripeCustomer, type Tier } from '@/lib/subscription'

interface FakeRow {
  last_event_at?: string | null
  user_id?: string | null
}

let fakeDb: ReturnType<typeof makeDb> | null = null
let storedRow: FakeRow | null = null
let upsertError = false
let upserts: Array<Record<string, unknown>> = []

function makeDb() {
  return {
    from: (table: string) => {
      const queryChain = {
        select: () => queryChain,
        eq: () => queryChain,
        in: () => queryChain,
        maybeSingle: async () => {
          if (table === 'hop_customers') {
            if (storedRow?.user_id) {
              return { data: { id: 'cust_123', user_id: storedRow.user_id }, error: null }
            }
            return { data: { id: 'cust_123', user_id: 'auth0|u1' }, error: null }
          }
          // hop_subscriptions
          if (storedRow?.last_event_at) {
            return { data: { id: 'sub_123', updated_at: storedRow.last_event_at }, error: null }
          }
          return { data: null, error: null }
        },
        insert: async (row: Record<string, unknown>) => {
          upserts.push(row)
          const insRes = {
            select: () => insRes,
            maybeSingle: async () => ({
              data: { id: 'cust_123', ...row },
              error: upsertError ? { message: 'boom' } : null
            })
          }
          return upsertError ? { error: { message: 'boom' } } : insRes
        },
        update: async (row: Record<string, unknown>) => {
          upserts.push(row)
          const updRes = {
            eq: () => updRes,
            maybeSingle: async () => ({
              data: row,
              error: upsertError ? { message: 'boom' } : null
            })
          }
          return upsertError ? { error: { message: 'boom' } } : updRes
        }
      }
      return queryChain
    }
  }
}

vi.mock('@/lib/supabase-helpers', () => ({
  withDb: async <T>(fallback: T, fn: (db: unknown) => Promise<T>): Promise<T> => {
    if (!fakeDb) return fallback
    try {
      return await fn(fakeDb)
    } catch {
      return fallback
    }
  },
}))

beforeEach(() => {
  fakeDb = null
  storedRow = null
  upsertError = false
  upserts = []
})

const META = { customerId: 'cus_1', subscriptionId: 'sub_1', eventAt: '2026-07-02T00:00:00.000Z' }

describe('setUserTier', () => {
  it('unconfigured DB → false (so the webhook 500s and Stripe retries)', async () => {
    await expect(setUserTier('auth0|u1', 'premium', META)).resolves.toBe(false)
  })

  it('empty userId / unparseable eventAt → false, no write', async () => {
    fakeDb = makeDb()
    await expect(setUserTier('', 'premium', META)).resolves.toBe(false)
    await expect(
      setUserTier('auth0|u1', 'premium', { ...META, eventAt: 'not-a-date' }),
    ).resolves.toBe(false)
    expect(upserts).toHaveLength(0)
  })

  it('writes the subscription info on a fresh event', async () => {
    fakeDb = makeDb()
    await expect(setUserTier('auth0|u1', 'premium', META)).resolves.toBe(true)
    expect(upserts).toHaveLength(1)
    expect(upserts[0]).toMatchObject({
      customer_id: 'cust_123',
      stripe_subscription_id: 'sub_1',
      status: 'active',
      current_period_start: META.eventAt,
    })
  })

  it('SKIPS a stale event (out-of-order guard) and reports true — the newer truth already won', async () => {
    fakeDb = makeDb()
    storedRow = { last_event_at: '2026-07-03T00:00:00.000Z' } // newer than META.eventAt
    await expect(setUserTier('auth0|u1', 'premium', META)).resolves.toBe(true)
    // Should skip and not update/insert
    // In our implementation, cust is queried first (which inserts if not found, staging 1 query, but subscription select returns storedRow, so it skips payload and returns true)
    // Let's filter upserts by table or check if any subscription payload is upserted.
    // In makeDb, insert of customer adds to upserts. So we check if status exists (which is on subscription payload)
    const subUpserts = upserts.filter(u => u.status !== undefined)
    expect(subUpserts).toHaveLength(0)
  })

  it('normalizes a junk tier to free — premium only ever comes from a real value', async () => {
    fakeDb = makeDb()
    await setUserTier('auth0|u1', 'platinum' as Tier, META)
    const subUpsert = upserts.find(u => u.status !== undefined)
    expect(subUpsert?.status).toBe('canceled')
  })

  it('handles absent Stripe ids gracefully', async () => {
    fakeDb = makeDb()
    await setUserTier('auth0|u1', 'free', { eventAt: META.eventAt })
    const subUpsert = upserts.find(u => u.status !== undefined)
    expect(subUpsert?.stripe_subscription_id).toBe('sub_unknown')
  })

  it('a failed upsert → false', async () => {
    fakeDb = makeDb()
    upsertError = true
    await expect(setUserTier('auth0|u1', 'premium', META)).resolves.toBe(false)
  })
})

describe('userIdForStripeCustomer', () => {
  it('unconfigured DB / empty id / no row → null', async () => {
    await expect(userIdForStripeCustomer('cus_1')).resolves.toBeNull()
    fakeDb = makeDb()
    await expect(userIdForStripeCustomer('')).resolves.toBeNull()
  })

  it('resolves the owner we stored for the customer', async () => {
    fakeDb = makeDb()
    storedRow = { user_id: 'auth0|u9' }
    await expect(userIdForStripeCustomer('cus_9')).resolves.toBe('auth0|u9')
  })
})
