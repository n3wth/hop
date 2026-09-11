import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SearchParams } from '@/lib/types'

// Keep the request, action, validator, persistence mapper and cron real. Only
// external boundaries (session, database transport, search) are replaced.
const { rows, db, getSession, assembleSearch, revalidatePath } = vi.hoisted(() => {
  const rows: Record<string, unknown>[] = []
  const db = {
    from: vi.fn(() => {
      let inserted: Record<string, unknown> | undefined
      const filters: [string, unknown][] = []
      const result = () => ({
        data: rows.filter(row => filters.every(([key, value]) => row[key] === value)),
        count: rows.filter(row => filters.every(([key, value]) => row[key] === value)).length,
        error: null,
      })
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters.push([key, value]); return query },
        order: async () => result(),
        insert: (row: Record<string, unknown>) => {
          inserted = { ...JSON.parse(JSON.stringify(row)), id: 'watch-1', last_notified_offer: null }
          rows.push(inserted!)
          return query
        },
        maybeSingle: async () => ({ data: inserted, error: null }),
        then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
      }
      return query
    }),
  }
  return { rows, db, getSession: vi.fn(), assembleSearch: vi.fn(), revalidatePath: vi.fn() }
})

vi.mock('@/lib/supabase-helpers', () => ({ withDb: async (_fallback: unknown, fn: (value: typeof db) => unknown) => fn(db) }))
vi.mock('@/lib/auth0', () => ({ auth0: { getSession } }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/prefs', () => ({ getPrefs: async () => ({}) }))
vi.mock('@/lib/standing-orders-parser', () => ({ parseStandingOrder: vi.fn() }))
vi.mock('@/lib/subscription', () => ({ getUserTier: async () => 'free', ALERT_LIMITS: { free: 3 } }))
vi.mock('@/lib/standing-order-alerts', () => ({ markAllAlertsSeen: vi.fn(), recordAlert: vi.fn() }))
vi.mock('@/lib/search', () => ({ assembleSearch }))
vi.mock('@/lib/accounts', () => ({ getUserBalances: async () => [] }))
vi.mock('@/lib/email', () => ({ isEmailEnabled: () => false, sendAlertEmail: vi.fn() }))
vi.mock('@/lib/cron-heartbeat', () => ({ recordHeartbeat: vi.fn() }))
vi.mock('@/lib/notification-outbox', () => ({ reserve: vi.fn(), markSent: vi.fn(), release: vi.fn() }))

import { watchRequestFromParams } from '@/lib/watch-request'
import { listActiveStandingOrders } from '@/lib/standing-orders'
import { createWatchExplicit } from '../standing-orders'
import { GET } from '@/app/api/cron/standing-orders/route'

beforeEach(() => {
  vi.clearAllMocks()
  rows.length = 0
  getSession.mockResolvedValue({ user: { sub: 'user-1', email: 'traveler@example.com' } })
  assembleSearch.mockImplementation(async (params: SearchParams) => ({ params, options: [], pick: undefined }))
  vi.stubEnv('STANDING_ORDERS_CRON_ENABLED', '1')
  vi.stubEnv('CRON_SECRET', 'test-cron-secret')
})
afterEach(() => vi.unstubAllEnvs())

describe('route watch passenger round trip', () => {
  it.each([
    { adults: 2 },
    { adults: 2, children: 1 },
    { adults: 2, children: 1, infants: 1 },
  ])('saves and re-runs the same party: %j', async (party) => {
    const params: SearchParams = { from: 'SFO', to: 'NRT', depart: '2099-12-01', return: '2099-12-08', ...party }
    expect(await createWatchExplicit(watchRequestFromParams(params))).toEqual({ ok: true })
    expect(rows[0]).toMatchObject({ user_id: 'user-1', params, seats: 2 + (party.children ?? 0) })
    expect((await listActiveStandingOrders())[0].params).toEqual(params)
    const response = await GET(new Request('http://localhost/api/cron/standing-orders', {
      headers: { authorization: 'Bearer test-cron-secret' },
    }))
    expect(response.status).toBe(200)
    expect(assembleSearch).toHaveBeenCalledWith(params, [], undefined)
  })

  it('requires a session before persisting a mixed-party watch', async () => {
    getSession.mockResolvedValue(null)
    const params: SearchParams = { from: 'SFO', to: 'NRT', depart: '2099-12-01', adults: 2, children: 1 }
    expect(await createWatchExplicit(watchRequestFromParams(params))).toEqual({ ok: false, error: 'Not signed in' })
    expect(rows).toEqual([])
    expect(db.from).not.toHaveBeenCalled()
  })
})
