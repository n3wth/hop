import { describe, it, expect } from 'vitest'
import { tierFromStripeEvent } from '@/lib/billing'
import type { StripeEventLike } from '@/lib/stripe'

// The event mapper is PURE — plain fixture objects, zero mocks, no SDK.
// Attribution rule under test: userId comes ONLY from refs WE minted
// (metadata.user_id / client_reference_id); an event without one yields
// userId:null + customerId so the route can fall back to OUR stored mapping.

const CREATED = 1_780_000_000 // seconds
const CREATED_ISO = new Date(CREATED * 1000).toISOString()

function ev(type: string, object: Record<string, unknown>): StripeEventLike {
  return { id: 'evt_1', type, created: CREATED, data: { object } }
}

describe('tierFromStripeEvent — checkout.session.completed', () => {
  it('maps to premium with our metadata.user_id + Stripe ids', () => {
    const update = tierFromStripeEvent(
      ev('checkout.session.completed', {
        metadata: { user_id: 'auth0|u1' },
        client_reference_id: 'auth0|u1',
        customer: 'cus_123',
        subscription: 'sub_456',
      }),
    )
    expect(update).toEqual({
      userId: 'auth0|u1',
      tier: 'premium',
      customerId: 'cus_123',
      subscriptionId: 'sub_456',
      eventAt: CREATED_ISO,
    })
  })

  it('falls back to client_reference_id when metadata is absent', () => {
    const update = tierFromStripeEvent(
      ev('checkout.session.completed', {
        client_reference_id: 'auth0|u2',
        customer: 'cus_123',
      }),
    )
    expect(update?.userId).toBe('auth0|u2')
    expect(update?.tier).toBe('premium')
  })

  it('yields userId:null (not an invented id) when the session carries no ref', () => {
    const update = tierFromStripeEvent(
      ev('checkout.session.completed', { customer: 'cus_123' }),
    )
    expect(update?.userId).toBeNull()
    expect(update?.customerId).toBe('cus_123')
  })
})

describe('tierFromStripeEvent — subscription lifecycle', () => {
  it('updated with an entitling status stays premium (subscription_data metadata carries our ref)', () => {
    for (const status of ['active', 'trialing', 'past_due']) {
      const update = tierFromStripeEvent(
        ev('customer.subscription.updated', {
          id: 'sub_456',
          status,
          customer: 'cus_123',
          metadata: { user_id: 'auth0|u1' },
        }),
      )
      expect(update).toEqual({
        userId: 'auth0|u1',
        tier: 'premium',
        customerId: 'cus_123',
        subscriptionId: 'sub_456',
        eventAt: CREATED_ISO,
      })
    }
  })

  it('updated with a terminal status reverts to free', () => {
    for (const status of ['canceled', 'unpaid', 'incomplete_expired', 'paused']) {
      const update = tierFromStripeEvent(
        ev('customer.subscription.updated', {
          id: 'sub_456',
          status,
          customer: 'cus_123',
          metadata: { user_id: 'auth0|u1' },
        }),
      )
      expect(update?.tier).toBe('free')
    }
  })

  it('deleted → free; a metadata-less delete still carries customerId for fallback attribution', () => {
    const update = tierFromStripeEvent(
      ev('customer.subscription.deleted', { id: 'sub_456', customer: 'cus_123' }),
    )
    expect(update).toEqual({
      userId: null,
      tier: 'free',
      customerId: 'cus_123',
      subscriptionId: 'sub_456',
      eventAt: CREATED_ISO,
    })
  })

  it('handles an expanded customer object (not just the string id)', () => {
    const update = tierFromStripeEvent(
      ev('customer.subscription.deleted', {
        id: 'sub_456',
        customer: { id: 'cus_789', object: 'customer' },
      }),
    )
    expect(update?.customerId).toBe('cus_789')
  })
})

describe('tierFromStripeEvent — everything else is noise', () => {
  it('unknown event types → null', () => {
    expect(tierFromStripeEvent(ev('invoice.paid', { customer: 'cus_1' }))).toBeNull()
    expect(tierFromStripeEvent(ev('payment_intent.succeeded', {}))).toBeNull()
    expect(tierFromStripeEvent(ev('charge.refunded', {}))).toBeNull()
  })

  it('a malformed event (no data.object) → null, never a throw', () => {
    expect(
      tierFromStripeEvent({ type: 'checkout.session.completed' } as unknown as StripeEventLike),
    ).toBeNull()
  })

  it('a missing created timestamp still yields a valid ISO eventAt', () => {
    const update = tierFromStripeEvent({
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_1', metadata: { user_id: 'auth0|u1' } } },
    })
    expect(update).not.toBeNull()
    expect(Number.isFinite(Date.parse(update!.eventAt))).toBe(true)
  })
})
