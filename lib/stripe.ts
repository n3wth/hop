// Stripe I/O seam — the ONLY module that talks to the Stripe SDK. Everything
// else (the pure event mapper in lib/billing.ts, the tier writes in
// lib/subscription.ts) is Stripe-free. Mirrors the lib/email.ts pattern:
//
//  - GATED on config: every function checks its keys FIRST and resolves
//    { ok:false, reason:'unconfigured' } when they're absent — never throws.
//  - The `stripe` SDK is imported DYNAMICALLY inside the functions, so the
//    unconfigured path (tests, previews, billing-off prod) never even loads it.
//  - Discriminated { ok } results, the house contract for upstream clients.
//
// Money-safety notes:
//  - Checkout is Stripe-HOSTED: the session URL we return is the human money
//    gate. hop never charges programmatically and never touches card data.
//  - `subscription_data.metadata.user_id` is set at session creation because
//    subscription objects do NOT inherit session metadata — without it, later
//    customer.subscription.updated/deleted events would arrive with no user ref
//    and downgrades could be silently dropped. Belt: lib/subscription.ts's
//    userIdForStripeCustomer covers events that still arrive without it.
//  - This module has NOTHING to do with Duffel — Stripe charges subscription
//    fees only; it never books travel.

import { env, hasEnv, isBillingEnabled } from '@/lib/env'

export type BillingInterval = 'monthly' | 'yearly'

export type CheckoutSessionResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'unconfigured' | 'stripe-error' }

// A verified Stripe event. We keep the type structural (not the SDK's) so the
// pure mapper in lib/billing.ts stays importable without the SDK.
export interface StripeEventLike {
  id?: string
  type: string
  created?: number
  data: { object: Record<string, unknown> }
}

export type VerifyResult =
  | { ok: true; event: StripeEventLike }
  | { ok: false; reason: 'unconfigured' | 'bad-signature' }

// Create a Stripe-hosted Checkout Session for the premium subscription.
// The user_id ref is minted HERE, from the caller's Auth0 session — it is never
// attacker-supplied. Set in three places: client_reference_id + session
// metadata (checkout.session.completed) and subscription_data.metadata
// (customer.subscription.updated/deleted lifecycle events).
export async function createCheckoutSession(args: {
  userId: string
  email?: string | null
  interval: BillingInterval
  /** The persistent Stripe customer minted for this user (lib/subscription.ts
      mapping). Attaching it is what lets the webhook and getUserTier attribute
      the resulting subscription via hop_customers; when absent, the webhook
      still self-heals from metadata.user_id. */
  customerId?: string
  successUrl: string
  cancelUrl: string
}): Promise<CheckoutSessionResult> {
  if (!isBillingEnabled()) return { ok: false, reason: 'unconfigured' }
  // Yearly is optional config — fall back to monthly when it isn't set up.
  const priceId =
    args.interval === 'yearly' && hasEnv('STRIPE_PRICE_ID_PRO_YEARLY')
      ? env.stripePriceIdProYearly()
      : env.stripePriceIdProMonthly()
  try {
    const { default: Stripe } = await import('stripe')
    const stripe = new Stripe(env.stripeSecretKey())
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: args.userId,
      // Stripe rejects customer + customer_email together — the persistent
      // customer wins when we have one.
      customer: args.customerId,
      customer_email: args.customerId ? undefined : args.email || undefined,
      metadata: { user_id: args.userId },
      subscription_data: { metadata: { user_id: args.userId } },
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
    })
    if (!session.url) return { ok: false, reason: 'stripe-error' }
    return { ok: true, url: session.url }
  } catch {
    return { ok: false, reason: 'stripe-error' }
  }
}

export type CustomerResult =
  | { ok: true; customerId: string }
  | { ok: false; reason: 'unconfigured' | 'stripe-error' }

// Mint the persistent Stripe customer for a user. The caller (the checkout
// route) stores the mapping via lib/subscription.ts#saveStripeCustomer.
export async function createStripeCustomer(args: {
  userId: string
  email?: string | null
}): Promise<CustomerResult> {
  if (!isBillingEnabled()) return { ok: false, reason: 'unconfigured' }
  try {
    const { default: Stripe } = await import('stripe')
    const stripe = new Stripe(env.stripeSecretKey())
    const customer = await stripe.customers.create({
      email: args.email || undefined,
      metadata: { user_id: args.userId },
    })
    return { ok: true, customerId: customer.id }
  } catch {
    return { ok: false, reason: 'stripe-error' }
  }
}

export type SubscriptionFetchResult =
  | { ok: true; record: import('@/lib/billing').SubscriptionRecord; customerId?: string }
  | { ok: false; reason: 'unconfigured' | 'stripe-error' }

// Fetch a subscription's stored-state fields by id. Needed only for
// checkout.session.completed, whose event object is the session (no period
// fields) — the customer.subscription.* events carry everything inline.
// Reuses the pure extractor in lib/billing.ts so there is exactly ONE
// field-walk over Stripe's subscription shape.
export async function retrieveSubscriptionRecord(
  subscriptionId: string,
): Promise<SubscriptionFetchResult> {
  if (!isBillingEnabled()) return { ok: false, reason: 'unconfigured' }
  try {
    const { default: Stripe } = await import('stripe')
    const stripe = new Stripe(env.stripeSecretKey())
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    const raw = sub as unknown as Record<string, unknown>
    const { subscriptionRecordFromEvent } = await import('@/lib/billing')
    const record = subscriptionRecordFromEvent({
      type: 'customer.subscription.updated',
      data: { object: raw },
    })
    if (!record) return { ok: false, reason: 'stripe-error' }
    return {
      ok: true,
      record,
      customerId: typeof raw.customer === 'string' ? raw.customer : undefined,
    }
  } catch {
    return { ok: false, reason: 'stripe-error' }
  }
}

// Verify a webhook payload against its `stripe-signature` header using the
// SDK's constructEventAsync (no hand-rolled HMAC). The RAW request body must be
// passed exactly as received — any re-serialization breaks the signature.
export async function verifyStripeEvent(
  rawBody: string,
  signature: string | null,
): Promise<VerifyResult> {
  if (!isBillingEnabled()) return { ok: false, reason: 'unconfigured' }
  if (!signature) return { ok: false, reason: 'bad-signature' }
  try {
    const { default: Stripe } = await import('stripe')
    const stripe = new Stripe(env.stripeSecretKey())
    const event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      env.stripeWebhookSecret(),
    )
    return { ok: true, event: event as unknown as StripeEventLike }
  } catch {
    return { ok: false, reason: 'bad-signature' }
  }
}
