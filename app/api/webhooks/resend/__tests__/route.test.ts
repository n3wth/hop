import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/resend-webhook', () => ({
  verifyResendWebhook: vi.fn(),
  extractRecipientEmails: vi.fn((data: Record<string, unknown>) => {
    const raw = data?.to
    if (typeof raw === 'string') return [raw]
    if (Array.isArray(raw)) return raw.filter((v) => typeof v === 'string')
    return []
  }),
}))
vi.mock('@/lib/email-suppressions', () => ({
  recordSuppression: vi.fn(async () => undefined),
}))

import { POST } from '../route'
import { verifyResendWebhook } from '@/lib/resend-webhook'
import { recordSuppression } from '@/lib/email-suppressions'

const mockVerify = vi.mocked(verifyResendWebhook)
const mockRecord = vi.mocked(recordSuppression)

function request(body: string): Request {
  return new Request('http://localhost/api/webhooks/resend', {
    method: 'POST',
    body,
    headers: { 'svix-id': 'msg_1', 'svix-timestamp': '1700000000', 'svix-signature': 'v1,x' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/webhooks/resend', () => {
  it('unconfigured secret → 200 ack, nothing processed', async () => {
    mockVerify.mockResolvedValue({ ok: false, reason: 'unconfigured' })
    const res = await POST(request('{}'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, skipped: 'unconfigured' })
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('bad signature → 401, nothing processed', async () => {
    mockVerify.mockResolvedValue({ ok: false, reason: 'bad-signature' })
    const res = await POST(request('{}'))
    expect(res.status).toBe(401)
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('email.bounced → suppresses each recipient with reason "bounced"', async () => {
    mockVerify.mockResolvedValue({
      ok: true,
      event: { type: 'email.bounced', data: { to: ['a@example.com', 'b@example.com'] } },
    })
    const res = await POST(request('{}'))
    expect(res.status).toBe(200)
    expect(mockRecord).toHaveBeenCalledWith('a@example.com', 'bounced')
    expect(mockRecord).toHaveBeenCalledWith('b@example.com', 'bounced')
    expect(mockRecord).toHaveBeenCalledTimes(2)
  })

  it('email.complained → suppresses the recipient with reason "complained"', async () => {
    mockVerify.mockResolvedValue({
      ok: true,
      event: { type: 'email.complained', data: { to: 'c@example.com' } },
    })
    await POST(request('{}'))
    expect(mockRecord).toHaveBeenCalledWith('c@example.com', 'complained')
  })

  it.each(['email.delivered', 'email.opened', 'email.clicked', 'email.delivery_delayed'])(
    '%s → 200 ack, logged only, no suppression write',
    async (type) => {
      mockVerify.mockResolvedValue({ ok: true, event: { type, data: { to: 'x@example.com' } } })
      const res = await POST(request('{}'))
      expect(res.status).toBe(200)
      expect(mockRecord).not.toHaveBeenCalled()
    },
  )

  it('unknown event type → 200 ack, never throws', async () => {
    mockVerify.mockResolvedValue({ ok: true, event: { type: 'email.something_new', data: {} } })
    const res = await POST(request('{}'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
  })
})
