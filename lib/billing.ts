// Pure, I/O-free mapping from a verified Stripe webhook event to the
// subscription state it implies. NO SDK import, NO fetch, NO DB — the webhook
// route is verify (lib/stripe.ts) → map (HERE) → attribute → write
// (lib/subscription.ts#recordSubscription) and nothing else. Unit-testable
// with plain fixture objects, zero mocks.
//
// Attribution contract (security-load-bearing):
//  - `userId` comes ONLY from refs WE minted at Checkout-Session creation
//    (metadata.user_id / client_reference_id / subscription_data metadata) —
//    all set server-side from the caller's Better Auth session in
//    lib/stripe.ts. Stripe verified the event's signature before this runs,
//    so those fields are ours, not an attacker's.
//  - When an event carries no user ref, `userId` is null and `customerId` lets
//    the write path attribute via OUR stored hop_customers mapping — so a
//    downgrade can never be silently dropped, and no attacker-controlled id
//    ever reaches the upsert.

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
// Exported because lib/subscription.ts#getUserTier derives tier from the SAME
// set — a second hand-written status list would silently drift from this one.
export const PREMIUM_STATUSES = new Set(['active', 'trialing', 'past_due'])

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

// The subscription-state columns hop_subscriptions stores, extracted from a
// VERIFIED event (or from a Stripe API retrieve shaped like one).
export interface SubscriptionRecord {
  subscriptionId: string
  priceId: string
  status: string
  /** ISO timestamps. */
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
}

function isoFromEpoch(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
    return new Date(v * 1000).toISOString()
  }
  return undefined
}

function firstItem(obj: Record<string, unknown>): Record<string, unknown> | undefined {
  const items = obj.items
  if (!items || typeof items !== 'object' || Array.isArray(items)) return undefined
  const data = (items as Record<string, unknown>).data
  if (!Array.isArray(data) || !data[0] || typeof data[0] !== 'object') return undefined
  return data[0] as Record<string, unknown>
}

// Pure extractor for subscription-shaped payloads: customer.subscription.*
// events carry the full subscription as data.object, so no API round-trip is
// needed. checkout.session.completed does NOT (its object is the session) —
// the webhook route retrieves the subscription via lib/stripe.ts and feeds it
// back through here. Total: any shape yields a record or null, never a throw.
//
// Period fields live at the top level on classic API versions and on the
// subscription ITEM from 2025-03-31.basil onward — read both.
export function subscriptionRecordFromEvent(event: StripeEventLike): SubscriptionRecord | null {
  if (
    event.type !== 'customer.subscription.updated' &&
    event.type !== 'customer.subscription.deleted'
  ) {
    return null
  }
  const obj = event?.data?.object
  if (!obj || typeof obj !== 'object') return null
  const subscriptionId = str(obj.id)
  if (!subscriptionId) return null

  const item = firstItem(obj)
  const start = isoFromEpoch(obj.current_period_start) ?? isoFromEpoch(item?.current_period_start)
  const end = isoFromEpoch(obj.current_period_end) ?? isoFromEpoch(item?.current_period_end)
  if (!start || !end) return null

  let priceId = ''
  const price = item?.price
  if (price && typeof price === 'object' && !Array.isArray(price)) {
    priceId = str((price as Record<string, unknown>).id) ?? ''
  }

  return {
    subscriptionId,
    priceId,
    status: str(obj.status) ?? 'incomplete',
    currentPeriodStart: start,
    currentPeriodEnd: end,
    cancelAtPeriodEnd: obj.cancel_at_period_end === true,
  }
}
