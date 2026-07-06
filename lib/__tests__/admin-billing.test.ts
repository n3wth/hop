// Regression test for the #213 review finding: getBillingOverview must
// degrade PER SECTION — one sub-query failing (status breakdown or the
// recent-subscriptions list) should not blank the whole console when the
// other sections are still real, useful data.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getDbMock, computeMrrMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  computeMrrMock: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ getDb: getDbMock }))
vi.mock('@/lib/unit-economics', () => ({ computeMrr: computeMrrMock }))

const { getBillingOverview } = await import('@/lib/admin-billing')

const STATUS_ROWS = [{ status: 'active', count: 3 }]
const SUB_ROWS = [
  {
    email: 'a@example.com',
    status: 'active',
    priceId: 'price_1',
    currentPeriodEnd: '2026-08-01T00:00:00.000Z',
    cancelAtPeriodEnd: false,
  },
]

// A projection-shaped chain: `{status, count}` selects resolve statusRows,
// everything else resolves subRows. Either can be made to throw to simulate
// that ONE sub-query failing.
function makeFakeDb(opts: {
  statusRows: unknown[] | 'throw'
  subRows: unknown[] | 'throw'
}) {
  return {
    select(projection: Record<string, unknown>) {
      const keys = Object.keys(projection)
      const isStatusQuery = keys.length === 2 && keys.includes('status') && keys.includes('count')
      const outcome = isStatusQuery ? opts.statusRows : opts.subRows
      const chain: Record<string, unknown> = {
        from: () => chain,
        innerJoin: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        groupBy: () => chain,
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
          outcome === 'throw'
            ? Promise.reject(new Error('db exploded')).then(resolve, reject)
            : Promise.resolve(outcome).then(resolve, reject),
      }
      return chain
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  computeMrrMock.mockResolvedValue({ mrrUsd: 199.0, count: 2 })
})

describe('getBillingOverview', () => {
  it('returns full data when every sub-query succeeds', async () => {
    getDbMock.mockReturnValue(makeFakeDb({ statusRows: STATUS_ROWS, subRows: SUB_ROWS }))
    const overview = await getBillingOverview()
    expect(overview.mrrUsd).toBe(199.0)
    expect(overview.statusCounts).toEqual({ active: 3 })
    expect(overview.recent).toHaveLength(1)
  })

  it('degrades only the status breakdown when that sub-query fails', async () => {
    getDbMock.mockReturnValue(makeFakeDb({ statusRows: 'throw', subRows: SUB_ROWS }))
    const overview = await getBillingOverview()
    expect(overview.statusCounts).toBeNull()
    // The still-healthy sections are NOT collapsed to null alongside it.
    expect(overview.mrrUsd).toBe(199.0)
    expect(overview.recent).toHaveLength(1)
  })

  it('degrades only the recent-subscriptions list when that sub-query fails', async () => {
    getDbMock.mockReturnValue(makeFakeDb({ statusRows: STATUS_ROWS, subRows: 'throw' }))
    const overview = await getBillingOverview()
    expect(overview.recent).toBeNull()
    expect(overview.mrrUsd).toBe(199.0)
    expect(overview.statusCounts).toEqual({ active: 3 })
  })

  it('never throws or returns a bare null when the db is entirely unavailable', async () => {
    getDbMock.mockReturnValue(null)
    const overview = await getBillingOverview()
    expect(overview).not.toBeNull()
    expect(overview.statusCounts).toBeNull()
    expect(overview.recent).toBeNull()
  })
})
