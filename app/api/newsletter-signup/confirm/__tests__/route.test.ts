import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/newsletter', () => ({
  confirmNewsletterSubscriber: vi.fn(async () => true),
}))

import { GET } from '../route'
import { confirmNewsletterSubscriber } from '@/lib/newsletter'
import { _resetRateLimitForTest } from '@/lib/rate-limit'

const mockConfirm = vi.mocked(confirmNewsletterSubscriber)

function request(token = 'good-token', ip = '1.2.3.4'): NextRequest {
  return new NextRequest(
    `http://localhost/api/newsletter-signup/confirm?token=${encodeURIComponent(token)}`,
    { headers: { 'x-vercel-forwarded-for': ip } },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockConfirm.mockResolvedValue(true)
  _resetRateLimitForTest()
})

describe('GET /api/newsletter-signup/confirm', () => {
  it('confirms a valid token and redirects to the confirmed page (no ok=0)', async () => {
    const res = await GET(request('good-token', '10.0.0.1'))
    expect(res.status).toBe(303)
    const location = res.headers.get('location') ?? ''
    expect(location).toContain('/newsletter/confirmed')
    expect(location).not.toContain('ok=0')
    expect(mockConfirm).toHaveBeenCalledWith('good-token')
  })

  it('redirects to ok=0 when the token is unknown/expired', async () => {
    mockConfirm.mockResolvedValueOnce(false)
    const res = await GET(request('bad-token', '10.0.0.2'))
    expect(res.headers.get('location')).toContain('ok=0')
  })

  it('rate-limits repeated calls from the same IP — once the bucket is exhausted, further calls never reach confirmNewsletterSubscriber and land on ok=0', async () => {
    const ip = '9.9.9.9'
    // Drain the bucket (capacity 10 per the route's CONFIRM_RATE).
    for (let i = 0; i < 10; i++) {
      await GET(request('good-token', ip))
    }
    mockConfirm.mockClear()

    const res = await GET(request('good-token', ip))
    expect(res.headers.get('location')).toContain('ok=0')
    expect(mockConfirm).not.toHaveBeenCalled()
  })

  it('does not rate-limit a different IP after another IP is exhausted', async () => {
    for (let i = 0; i < 10; i++) {
      await GET(request('good-token', '5.5.5.5'))
    }
    mockConfirm.mockClear()

    const res = await GET(request('good-token', '6.6.6.6'))
    expect(res.headers.get('location')).not.toContain('ok=0')
    expect(mockConfirm).toHaveBeenCalledWith('good-token')
  })
})
