import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setUserTier, userIdForStripeCustomer, type Tier } from '@/lib/subscription'

// The webhook-side writers, with withDb mocked so the DB contract is testable
// without Supabase: unconfigured → fallback (false/null); the last_event_at
// guard drops stale events (a late `updated` can't resurrect premium after
// `deleted`); junk tiers normalize to 'free'; absent Stripe ids never clobber
// stored ones.

interface FakeRow {
  last_event_at?: string | null
  user_id?: string | null
}

let fakeDb: unknown = null
let storedRow: FakeRow | null = null
let upsertError = false
let upserts: Array<Record<string, unknown>> = []

function makeDb() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: storedRow, error: null }),
        }),
      }),
      upsert: async (row: Record<string, unknown>) => {
        upserts.push(row)
        return { error: upsertError ? { message: 'boom' } : null }
      },
    }),
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

  it('writes the tier + Stripe ids + last_event_at on a fresh event', async () => {
    fakeDb = makeDb()
    await expect(setUserTier('auth0|u1', 'premium', META)).resolves.toBe(true)
    expect(upserts).toHaveLength(1)
    expect(upserts[0]).toMatchObject({
      user_id: 'auth0|u1',
      tier: 'premium',
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_1',
      last_event_at: META.eventAt,
    })
  })

  it('SKIPS a stale event (out-of-order guard) and reports true — the newer truth already won', async () => {
    fakeDb = makeDb()
    storedRow = { last_event_at: '2026-07-03T00:00:00.000Z' } // newer than META.eventAt
    await expect(setUserTier('auth0|u1', 'premium', META)).resolves.toBe(true)
    expect(upserts).toHaveLength(0)
  })

  it('normalizes a junk tier to free — premium only ever comes from a real value', async () => {
    fakeDb = makeDb()
    await setUserTier('auth0|u1', 'platinum' as Tier, META)
    expect(upserts[0]?.tier).toBe('free')
  })

  it('omits absent Stripe ids so an id-less event cannot clobber stored ones', async () => {
    fakeDb = makeDb()
    await setUserTier('auth0|u1', 'free', { eventAt: META.eventAt })
    expect(upserts[0]).not.toHaveProperty('stripe_customer_id')
    expect(upserts[0]).not.toHaveProperty('stripe_subscription_id')
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
    await expect(userIdForStripeCustomer('cus_1')).resolves.toBeNull()
  })

  it('resolves the owner we stored for the customer', async () => {
    fakeDb = makeDb()
    storedRow = { user_id: 'auth0|u9' }
    await expect(userIdForStripeCustomer('cus_9')).resolves.toBe('auth0|u9')
  })
})
