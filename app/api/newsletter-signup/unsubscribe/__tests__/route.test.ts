import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/newsletter', () => ({
  unsubscribeNewsletter: vi.fn(async () => true),
}))

import { GET } from '../route'
import { unsubscribeNewsletter } from '@/lib/newsletter'
import { _resetRateLimitForTest } from '@/lib/rate-limit'

const mockUnsubscribe = vi.mocked(unsubscribeNewsletter)

function request(token = 'good-token', ip = '1.2.3.4'): NextRequest {
  return new NextRequest(
    `http://localhost/api/newsletter-signup/unsubscribe?token=${encodeURIComponent(token)}`,
    { headers: { 'x-vercel-forwarded-for': ip } },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUnsubscribe.mockResolvedValue(true)
  _resetRateLimitForTest()
})

describe('GET /api/newsletter-signup/unsubscribe', () => {
  it('unsubscribes a valid token and redirects to the unsubscribed page', async () => {
    const res = await GET(request('good-token', '10.0.0.1'))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('/newsletter/unsubscribed')
    expect(mockUnsubscribe).toHaveBeenCalledWith('good-token')
  })

  it('rate-limits repeated calls from the same IP — once the bucket is exhausted, further calls never reach unsubscribeNewsletter', async () => {
    const ip = '9.9.9.9'
    // Drain the bucket (capacity 10 per the route's UNSUBSCRIBE_RATE).
    for (let i = 0; i < 10; i++) {
      await GET(request('good-token', ip))
    }
    mockUnsubscribe.mockClear()

    const res = await GET(request('good-token', ip))
    // Same landing page regardless — a limited hit must not be distinguishable
    // from a matched/unmatched token (no probing signal).
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('/newsletter/unsubscribed')
    expect(mockUnsubscribe).not.toHaveBeenCalled()
  })

  it('does not rate-limit a different IP after another IP is exhausted', async () => {
    for (let i = 0; i < 10; i++) {
      await GET(request('good-token', '5.5.5.5'))
    }
    mockUnsubscribe.mockClear()

    await GET(request('good-token', '6.6.6.6'))
    expect(mockUnsubscribe).toHaveBeenCalledWith('good-token')
  })
})
