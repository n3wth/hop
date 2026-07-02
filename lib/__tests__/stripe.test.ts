import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createCheckoutSession, verifyStripeEvent } from '@/lib/stripe'
import { isBillingEnabled } from '@/lib/env'

// The Stripe seam is GATED + graceful, like every hop upstream client:
//  - keyless (billing off) → every function resolves {ok:false,'unconfigured'},
//    never throws, never loads the SDK (the gate returns before the dynamic
//    import), so these tests run with no real keys and no network.
//  - configured-but-forged → verifyStripeEvent rejects with 'bad-signature'
//    (the SDK's constructEventAsync, no hand-rolled HMAC).

const BILLING_KEYS = [
  'HOP_ENABLE_BILLING',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID_PRO_MONTHLY',
  'STRIPE_PRICE_ID_PRO_YEARLY',
] as const

const ORIGINAL: Record<string, string | undefined> = {}
beforeEach(() => {
  for (const k of BILLING_KEYS) {
    ORIGINAL[k] = process.env[k]
    delete process.env[k]
  }
})
afterEach(() => {
  for (const k of BILLING_KEYS) {
    if (ORIGINAL[k] === undefined) delete process.env[k]
    else process.env[k] = ORIGINAL[k]
  }
})

function configureFakeBilling() {
  process.env.HOP_ENABLE_BILLING = '1'
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake_secret'
  process.env.STRIPE_PRICE_ID_PRO_MONTHLY = 'price_fake_monthly'
}

describe('isBillingEnabled — the double lock', () => {
  it('is false by default (no flag, no keys)', () => {
    expect(isBillingEnabled()).toBe(false)
  })

  it('is false with the flag but missing keys — keys alone or flag alone never enable', () => {
    process.env.HOP_ENABLE_BILLING = '1'
    expect(isBillingEnabled()).toBe(false)

    delete process.env.HOP_ENABLE_BILLING
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake_secret'
    process.env.STRIPE_PRICE_ID_PRO_MONTHLY = 'price_fake_monthly'
    expect(isBillingEnabled()).toBe(false)
  })

  it('requires all three keys — webhook secret and monthly price id included', () => {
    process.env.HOP_ENABLE_BILLING = '1'
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
    expect(isBillingEnabled()).toBe(false)
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake_secret'
    expect(isBillingEnabled()).toBe(false)
    process.env.STRIPE_PRICE_ID_PRO_MONTHLY = 'price_fake_monthly'
    expect(isBillingEnabled()).toBe(true)
  })

  it('yearly price id is optional', () => {
    configureFakeBilling()
    expect(isBillingEnabled()).toBe(true)
  })
})

describe('lib/stripe keyless — resolves unconfigured, never throws', () => {
  it('createCheckoutSession → {ok:false, unconfigured}', async () => {
    const res = await createCheckoutSession({
      userId: 'auth0|u1',
      email: 'u@example.com',
      interval: 'monthly',
      successUrl: 'https://hop.flights/account?upgraded=1#billing',
      cancelUrl: 'https://hop.flights/account#billing',
    })
    expect(res).toEqual({ ok: false, reason: 'unconfigured' })
  })

  it('verifyStripeEvent → {ok:false, unconfigured}', async () => {
    const res = await verifyStripeEvent('{}', 't=1,v1=deadbeef')
    expect(res).toEqual({ ok: false, reason: 'unconfigured' })
  })
})

describe('verifyStripeEvent configured — signature checked, forgeries rejected', () => {
  it('garbage signature with a real-looking secret → bad-signature', async () => {
    configureFakeBilling()
    const res = await verifyStripeEvent(
      JSON.stringify({ type: 'checkout.session.completed', data: { object: {} } }),
      't=12345,v1=not-a-real-signature',
    )
    expect(res).toEqual({ ok: false, reason: 'bad-signature' })
  })

  it('missing signature header → bad-signature (never verifies unsigned payloads)', async () => {
    configureFakeBilling()
    const res = await verifyStripeEvent('{}', null)
    expect(res).toEqual({ ok: false, reason: 'bad-signature' })
  })
})
