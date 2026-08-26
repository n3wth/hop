// POST /api/webhooks/stripe — the Stripe webhook: the primary writer of subscription
// tier state (the daily sync-stripe cron reconciles missed deliveries through
// the SAME recordSubscription lane). verify (lib/stripe.ts#verifyStripeEvent)
// → map (lib/billing.ts, pure + unit-tested) → write
// (lib/subscription.ts#recordSubscription). NEVER throws.
//
// Gated on isBillingEnabled(): off → 503 so Stripe retries later rather than
// dropping events (the endpoint shouldn't be registered in Stripe while
// billing is dark, but a mis-timed flag flip must not eat a payment).
//
// Failure semantics, chosen per case:
//  - bad signature            → 400 (attacker/misconfig; not retryable)
//  - unconfigured             → 503 (Stripe retries once keys/flag exist)
//  - no tier signal           → 200 ack (noise; stop the retries)
//  - unattributable customer  → 200 ack + loud log (permanent — retrying
//    can't help; recordSubscription already tried the metadata self-heal)
//  - storage/Stripe hiccup    → 500 (transient — let Stripe retry)

import { eq } from 'drizzle-orm'
import { verifyStripeEvent, retrieveSubscriptionRecord } from '@/lib/stripe'
import {
  tierFromStripeEvent,
  subscriptionRecordFromEvent,
  lifecycleEmailForTransition,
} from '@/lib/billing'
import {
  recordSubscription,
  getUserTier,
  userIdForStripeCustomer,
  type Tier,
} from '@/lib/subscription'
import { sendProWelcomeEmail, sendCancellationEmail, deliverBounded } from '@/lib/email'
import { getDb } from '@/lib/db'
import { user as userTable } from '@/lib/db/schema'
import { isBillingEnabled } from '@/lib/env'

export const runtime = 'nodejs'

// Resolve a user's email for the lifecycle sends. `user` is Better Auth core,
// not behind the withDb Postgrest shim, so this goes direct through Drizzle
// (same precedent as app/api/cron/newsletter-digest). Never throws.
async function userEmailById(userId: string): Promise<string | null> {
  try {
    const db = getDb()
    if (!db) return null
    const rows = await db
      .select({ email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1)
    return rows[0]?.email ?? null
  } catch {
    return null
  }
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export async function POST(request: Request): Promise<Response> {
  if (!isBillingEnabled()) {
    return json({ ok: false, error: 'Billing is not enabled.' }, 503)
  }

  // The RAW body, exactly as received — re-serialization breaks the signature.
  const rawBody = await request.text()
  const verified = await verifyStripeEvent(
    rawBody,
    request.headers.get('stripe-signature'),
  )
  if (!verified.ok) {
    return verified.reason === 'unconfigured'
      ? json({ ok: false, error: 'Billing is not configured.' }, 503)
      : json({ ok: false, error: 'Webhook signature failed' }, 400)
  }
  const event = verified.event

  const update = tierFromStripeEvent(event)
  if (!update) return json({ received: true }) // no tier signal — ack the noise

  // Subscription state: inline on customer.subscription.* events; a
  // checkout.session.completed needs one API retrieve.
  let record = subscriptionRecordFromEvent(event)
  let stripeCustomerId = update.customerId
  if (!record && update.subscriptionId) {
    const fetched = await retrieveSubscriptionRecord(update.subscriptionId)
    if (!fetched.ok) {
      // A completed payment we couldn't read back — transient, make Stripe retry.
      console.error(
        `stripe-webhook: subscription retrieve failed on ${event.type} (${event.id ?? 'no-id'})`,
      )
      return json({ ok: false, error: 'Subscription fetch failed' }, 500)
    }
    record = fetched.record
    stripeCustomerId = stripeCustomerId ?? fetched.customerId
  }
  if (!record || !stripeCustomerId) {
    console.error(
      `stripe-webhook: no actionable subscription state on ${event.type} (${event.id ?? 'no-id'})`,
    )
    return json({ received: true })
  }

  // Lifecycle-email context — read BEFORE the write so priorTier is the
  // pre-event state (free→premium is only detectable against it). Best-effort:
  // both helpers degrade to null/free on a db blip, which can only suppress an
  // email, never fail the webhook.
  let lifecycleUserId: string | null = update.userId
  let priorTier: Tier | null = null
  if (!lifecycleUserId) lifecycleUserId = await userIdForStripeCustomer(stripeCustomerId)
  if (lifecycleUserId) priorTier = await getUserTier(lifecycleUserId)

  const outcome = await recordSubscription({
    userId: update.userId,
    stripeCustomerId,
    record,
  })
  if (outcome === 'db-error') {
    return json({ ok: false, error: 'Storage unavailable' }, 500) // Stripe retries
  }
  if (outcome === 'no-attribution') {
    console.error(
      `stripe-webhook: unattributable Stripe customer ${stripeCustomerId} on ${event.type} — no stored mapping and no metadata user ref`,
    )
  }

  // Lifecycle emails, AFTER the tier write landed: Pro welcome on free→premium,
  // cancellation on customer.subscription.deleted, nothing on premium→premium
  // (lib/billing.ts#lifecycleEmailForTransition, pure + unit-tested). Bounded
  // and never-throwing (deliverBounded) — a slow or dead email provider can
  // delay this 200 by at most 3s and can never turn it into an error, so
  // Stripe never retries (and re-charges attribution work) over email trouble.
  if (outcome === 'ok' && lifecycleUserId) {
    const kind = lifecycleEmailForTransition({
      eventType: event.type,
      newTier: update.tier,
      priorTier,
    })
    if (kind) {
      const email = await userEmailById(lifecycleUserId)
      if (email) {
        await deliverBounded(
          kind === 'pro-welcome' ? sendProWelcomeEmail(email) : sendCancellationEmail(email),
        )
      }
    }
  }

  return json({ received: true })
}
