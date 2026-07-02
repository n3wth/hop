import { describe, expect, it, vi } from 'vitest'
import { GET } from '../status/route'

vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn().mockResolvedValue({
      user: {
        sub: 'user-123',
      },
    }),
  },
}))
const mockCustomerData = { id: 'cust-123' }
const mockSubData = {
  status: 'active',
  current_period_end: new Date(Date.now() + 86400000).toISOString(),
  cancel_at_period_end: false,
  stripe_price_id: 'price_monthly',
}
vi.mock('@/lib/supabase-helpers', () => ({
  withDb: vi.fn().mockImplementation(async (fallback, fn) => {
    const mockDb = {
      from: (table: string) => ({
        select: () => ({
          eq: () => {
            if (table === 'hop_customers') {
              return {
                maybeSingle: () => Promise.resolve({ data: mockCustomerData, error: null }),
              }
            } else {
              return {
                order: () => ({
                  limit: () => ({
                    maybeSingle: () => Promise.resolve({ data: mockSubData, error: null }),
                  }),
                }),
              }
            }
          },
        }),
      }),
    }
    return fn(mockDb)
  }),
}))

describe('GET /api/subscriptions/status', () => {
  it('returns subscription status active when valid', async () => {
    mockSubData.current_period_end = new Date(Date.now() + 86400000).toISOString()
    const res = await GET()
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.isActive).toBe(true)
    expect(json.subscription.status).toBe('active')
  })

  it('returns active false if period is expired', async () => {
    mockSubData.current_period_end = new Date(Date.now() - 86400000).toISOString()
    const res = await GET()
    const json = await res.json()
    expect(json.isActive).toBe(false)
  })
})
