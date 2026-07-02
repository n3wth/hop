import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../route'
import type { StripeEventLike, VerifyResult } from '@/lib/stripe'

// The webhook route's response contract, with the verify seam and the DB
// writers mocked so every branch is reachable without Stripe or Supabase.
// The MAPPER (lib/billing.ts) runs for real — it's pure.
//
//   unconfigured → 503 · bad signature → 400 · no tier signal → 200 no write
//   unattributable → 200 no write · write ok → 200 · write FAILED → 500
//   (the one deliberate non-200: Stripe's retry is the recovery mechanism)

vi.mock('@/lib/stripe', () => ({
  verifyStripeEvent: vi.fn(),
}))
vi.mock('@/lib/subscription', () => ({
  setUserTier: vi.fn(),
  userIdForStripeCustomer: vi.fn(),
}))

import { verifyStripeEvent } from '@/lib/stripe'
import { setUserTier, userIdForStripeCustomer } from '@/lib/subscription'

const mockVerify = vi.mocked(verifyStripeEvent)
const mockSetTier = vi.mocked(setUserTier)
const mockLookup = vi.mocked(userIdForStripeCustomer)

function request(body = '{}'): Request {
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: { 'stripe-signature': 't=1,v1=sig' },
  })
}

function verified(event: StripeEventLike): VerifyResult {
  return { ok: true, event }
}

const COMPLETED: StripeEventLike = {
  id: 'evt_1',
  type: 'checkout.session.completed',
  created: 1_780_000_000,
  data: {
    object: {
      metadata: { user_id: 'auth0|u1' },
      customer: 'cus_1',
      subscription: 'sub_1',
    },
  },
}

beforeEach(() => {
  vi.resetAllMocks()
  mockSetTier.mockResolvedValue(true)
  mockLookup.mockResolvedValue(null)
})

describe('POST /api/webhooks/stripe', () => {
  it('503 when billing is unconfigured (flag off) — the seam is inert', async () => {
    mockVerify.mockResolvedValue({ ok: false, reason: 'unconfigured' })
    const res = await POST(request())
    expect(res.status).toBe(503)
    expect(mockSetTier).not.toHaveBeenCalled()
  })

  it('400 on a bad/missing signature — forged payloads are dropped', async () => {
    mockVerify.mockResolvedValue({ ok: false, reason: 'bad-signature' })
    const res = await POST(request('not json at all'))
    expect(res.status).toBe(400)
    expect(mockSetTier).not.toHaveBeenCalled()
  })

  it('200-acks an event with no tier signal, writing nothing (Stripe stops retrying)', async () => {
    mockVerify.mockResolvedValue(
      verified({ type: 'invoice.paid', data: { object: { customer: 'cus_1' } } }),
    )
    const res = await POST(request())
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ ok: true, ignored: true })
    expect(mockSetTier).not.toHaveBeenCalled()
  })

  it('writes premium for a completed checkout attributed by OUR metadata', async () => {
    mockVerify.mockResolvedValue(verified(COMPLETED))
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mockSetTier).toHaveBeenCalledWith('auth0|u1', 'premium', {
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      eventAt: new Date(1_780_000_000 * 1000).toISOString(),
    })
  })

  it('falls back to our stored stripe_customer_id when the event has no user ref', async () => {
    mockVerify.mockResolvedValue(
      verified({
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_1', customer: 'cus_9' } },
      }),
    )
    mockLookup.mockResolvedValue('auth0|u9')
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mockLookup).toHaveBeenCalledWith('cus_9')
    expect(mockSetTier).toHaveBeenCalledWith(
      'auth0|u9',
      'free',
      expect.objectContaining({ customerId: 'cus_9' }),
    )
  })

  it('200-acks an unattributable event with NO write — no attacker-controlled id reaches the upsert', async () => {
    mockVerify.mockResolvedValue(
      verified({
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_1', customer: 'cus_unknown' } },
      }),
    )
    mockLookup.mockResolvedValue(null)
    const res = await POST(request())
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ ok: true, ignored: true })
    expect(mockSetTier).not.toHaveBeenCalled()
  })

  it('500 when the tier write fails — the one deliberate non-200, so Stripe retries', async () => {
    mockVerify.mockResolvedValue(verified(COMPLETED))
    mockSetTier.mockResolvedValue(false)
    const res = await POST(request())
    expect(res.status).toBe(500)
  })
})
