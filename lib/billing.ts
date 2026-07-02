// Pure, I/O-free mapping from a verified Stripe webhook event to the
// subscription state it implies. NO SDK import, NO fetch, NO DB — the webhook
// route is verify (lib/stripe.ts) → map (HERE) → attribute → write
// (lib/subscription.ts#setUserTier) and nothing else. Unit-testable with plain
// fixture objects, zero mocks.
//
// Attribution contract (security-load-bearing):
//  - `userId` comes ONLY from refs WE minted at Checkout-Session creation
//    (metadata.user_id / client_reference_id / subscription_data metadata) —
//    all set server-side from the caller's Auth0 session in lib/stripe.ts.
//    Stripe verified the event's signature before this runs, so those fields
//    are ours, not an attacker's.
//  - When an event carries no user ref, `userId` is null and `customerId` lets
//    the webhook route fall back to lib/subscription.ts#userIdForStripeCustomer
//    (a lookup over OUR stored stripe_customer_id) — so a downgrade can never
//    be silently dropped, and no attacker-controlled id ever reaches the upsert.

import type { Tier } from '@/lib/subscription'
import type { StripeEventLike } from '@/lib/stripe'

export interface SubscriptionUpdate {
  /** Our Auth0 sub, when the event carries a ref we minted; else null. */
  userId: string | null
  tier: Tier
  customerId?: string
  subscriptionId?: string
  /** ISO timestamp of the Stripe event — the out-of-order guard's clock. */
  eventAt: string
}

// Subscription statuses that still entitle premium. `past_due` stays premium
// while Stripe's dunning retries the card — the definitive downgrade arrives as
// `customer.subscription.deleted` (or a terminal status) when retries exhaust.
const PREMIUM_STATUSES = new Set(['active', 'trialing', 'past_due'])

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined
}

// metadata.user_id — tolerant of a missing/odd-shaped metadata blob.
function metadataUserId(obj: Record<string, unknown>): string | undefined {
  const meta = obj.metadata
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return undefined
  return str((meta as Record<string, unknown>).user_id)
}

// `customer` is a string id on webhook payloads, but the API type allows an
// expanded object — handle both defensively.
function customerId(obj: Record<string, unknown>): string | undefined {
  const c = obj.customer
  if (typeof c === 'string' && c.trim()) return c
  if (c && typeof c === 'object' && !Array.isArray(c)) {
    return str((c as Record<string, unknown>).id)
  }
  return undefined
}

function eventAtIso(event: StripeEventLike): string {
  const sec = event.created
  if (typeof sec === 'number' && Number.isFinite(sec) && sec > 0) {
    return new Date(sec * 1000).toISOString()
  }
  return new Date().toISOString()
}

// Map a VERIFIED Stripe event to the subscription state it implies.
// Returns null for event types that say nothing about tier (the route
// 200-acks those so Stripe stops retrying). Pure and total: any shape of
// `data.object` yields a result or null, never a throw.
export function tierFromStripeEvent(event: StripeEventLike): SubscriptionUpdate | null {
  const obj = event?.data?.object
  if (!obj || typeof obj !== 'object') return null
  const eventAt = eventAtIso(event)

  switch (event.type) {
    case 'checkout.session.completed': {
      // Payment completed on the hosted page → premium. Our ref travels as
      // metadata.user_id and client_reference_id on the session itself.
      const userId = metadataUserId(obj) ?? str(obj.client_reference_id) ?? null
      return {
        userId,
        tier: 'premium',
        customerId: customerId(obj),
        subscriptionId: str(obj.subscription),
        eventAt,
      }
    }
    case 'customer.subscription.updated': {
      // Status-derived: active/trialing/past_due keep premium; anything
      // terminal (canceled, unpaid, incomplete_expired, paused) reverts free.
      const status = str(obj.status) ?? ''
      const userId = metadataUserId(obj) ?? null
      return {
        userId,
        tier: PREMIUM_STATUSES.has(status) ? 'premium' : 'free',
        customerId: customerId(obj),
        subscriptionId: str(obj.id),
        eventAt,
      }
    }
    case 'customer.subscription.deleted': {
      const userId = metadataUserId(obj) ?? null
      return {
        userId,
        tier: 'free',
        customerId: customerId(obj),
        subscriptionId: str(obj.id),
        eventAt,
      }
    }
    default:
      // Everything else (invoices, payment_intents, …) carries no tier signal.
      return null
  }
}
