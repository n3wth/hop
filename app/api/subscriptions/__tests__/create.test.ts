import { describe, expect, it, vi } from 'vitest'
import { GET, POST } from '../create/route'

vi.mock('stripe', () => {
  return {
    default: class {
      customers = {
        create: vi.fn().mockResolvedValue({ id: 'cus_test123' })
      }
      checkout = {
        sessions: {
          create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }),
        },
      }
    }
  }
})

vi.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: vi.fn().mockResolvedValue({
      user: {
        sub: 'user-123',
        email: 'test@example.com',
      },
    }),
  },
}))

vi.mock('@/lib/supabase-helpers', () => ({
  withDb: vi.fn().mockImplementation(async (fallback, fn) => {
    const mockDb = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
        insert: () => Promise.resolve({ error: null }),
      }),
    }
    return fn(mockDb)
  }),
}))

describe('POST /api/subscriptions/create', () => {
  it('returns a checkout url', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
    process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY = 'price_monthly'
    process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY = 'price_yearly'
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'

    const req = new Request('http://localhost/api/subscriptions/create', {
      method: 'POST',
      body: JSON.stringify({ priceId: 'price_monthly' }),
    })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toHaveProperty('url')
    expect(json.url).toBe('https://checkout.stripe.com/test')
  })
})

describe('GET /api/subscriptions/create', () => {
  it('redirects to stripe checkout url', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
    process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY = 'price_monthly'
    process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY = 'price_yearly'
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'

    const req = new Request('http://localhost/api/subscriptions/create?priceId=price_monthly', {
      method: 'GET',
    })
    const res = await GET(req)
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('https://checkout.stripe.com/test')
  })
})
