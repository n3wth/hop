// POST /api/webhooks/stripe — the ONLY writer of subscription tier. The flow is
// exactly: verify (signature) → map (pure lib/billing.ts) → attribute (our
// metadata, else our stored stripe_customer_id) → write (setUserTier). Tier
// NEVER changes from the checkout redirect (?upgraded=1 is display only).
//
// Response contract (what Stripe's retry machinery sees):
//  - bad signature / unreadable        → 400 (drop it; a forger learns nothing)
//  - billing unconfigured              → 503 (endpoint exists, seam is off)
//  - event with no tier signal         → 200-ack, no write (stop retrying)
//  - event we can't attribute to a user → 200-ack, no write (stop retrying —
//    it isn't ours to apply, and retrying won't change that)
//  - tier write FAILED                 → 500, the one deliberate non-200 in the
//    house style: Stripe retries for days, and retry IS the recovery mechanism
//    for a transient DB blip on a money-truth write.
//
// Idempotent by construction: setUserTier is a pure upsert with a
// last_event_at guard, so replays are no-ops and out-of-order events are
// dropped (a late `updated` can't resurrect premium after `deleted`).
//
// runtime = 'nodejs' (matches the escalation route; avoids edge raw-body/crypto
// surprises). The raw body via request.text() is REQUIRED for signature
// verification — App Router route handlers give it to us untouched (no
// body-parser config; see node_modules/next/dist/docs route.md). This path is
// also excluded from the session middleware matcher: it's a cookie-less
// server-to-server POST from Stripe.

import { verifyStripeEvent } from '@/lib/stripe'
import { tierFromStripeEvent } from '@/lib/billing'
import { setUserTier, userIdForStripeCustomer } from '@/lib/subscription'

export const runtime = 'nodejs'

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export async function POST(request: Request): Promise<Response> {
  let raw: string
  try {
    raw = await request.text()
  } catch {
    return json({ ok: false }, 400)
  }

  const verified = await verifyStripeEvent(raw, request.headers.get('stripe-signature'))
  if (!verified.ok) {
    return json({ ok: false }, verified.reason === 'unconfigured' ? 503 : 400)
  }

  // Pure mapping — null means the event says nothing about tier.
  const update = tierFromStripeEvent(verified.event)
  if (!update) return json({ ok: true, ignored: true })

  // Attribute: prefer the ref WE minted at session creation; fall back to our
  // own stripe_customer_id mapping (written by an earlier attributed event).
  // No attacker-controlled user_id can reach the upsert — both sources are ours.
  let userId = update.userId
  if (!userId && update.customerId) {
    userId = await userIdForStripeCustomer(update.customerId)
  }
  if (!userId) return json({ ok: true, ignored: true })

  const written = await setUserTier(userId, update.tier, {
    customerId: update.customerId,
    subscriptionId: update.subscriptionId,
    eventAt: update.eventAt,
  })
  if (!written) return json({ ok: false }, 500)

  return json({ ok: true })
}
