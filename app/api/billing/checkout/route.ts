// POST /api/billing/checkout — start a premium upgrade. Creates a Stripe-hosted
// Checkout Session and returns its URL for the client to navigate to; the
// hosted page is the human money gate (hop never charges programmatically and
// never touches card data). Auth0 session REQUIRED — the session's sub is the
// user_id ref minted into the Checkout Session, which is the only way a tier
// write is ever attributed (never a caller-supplied id).
//
// Gated on isBillingEnabled(): off → soft 503 {ok:false}, so the deploy is
// inert until the operator flips HOP_ENABLE_BILLING with the Stripe keys set.
// Rate-limited per-sub + per-IP BEFORE any Stripe work (each session create is
// otherwise a free Stripe API call for a scripted caller). NEVER throws.

import { checkBotId } from 'botid/server'
import { auth0 } from '@/lib/auth0'
import { isBillingEnabled } from '@/lib/env'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { createCheckoutSession, createStripeCustomer, type BillingInterval } from '@/lib/stripe'
import { stripeCustomerIdFor, saveStripeCustomer } from '@/lib/subscription'

export const runtime = 'nodejs'

// A small burst then a trickle — a real person picks a plan once, maybe twice.
const CHECKOUT_RATE = { capacity: 4, refillPerSec: 0.05 } // 4 burst, ~3/min

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export async function POST(request: Request): Promise<Response> {
  const verification = await checkBotId()
  if (verification.isBot) {
    return json({ ok: false, error: 'Access denied' }, 403)
  }

  if (!isBillingEnabled()) {
    return json({ ok: false, error: 'Billing is not available yet.' }, 503)
  }

  // Identity is REQUIRED — the sub becomes the Checkout Session's user ref.
  let userId: string | undefined
  let email: string | undefined
  try {
    const session = await auth0.getSession()
    userId = session?.user?.sub ?? undefined
    email = session?.user?.email ?? undefined
  } catch {
    userId = undefined
  }
  if (!userId) return json({ ok: false, error: 'Sign in to upgrade.' }, 401)

  // Throttle before touching Stripe: per-sub (can't rotate IPs past it) + per-IP.
  const ip = clientIp(request)
  for (const k of [`billing:sub:${userId}`, `billing:ip:${ip}`]) {
    if (!(await checkRateLimit(k, CHECKOUT_RATE)).ok) {
      return json({ ok: false, error: 'One moment — try again shortly.' }, 429)
    }
  }

  // Optional { interval: 'monthly' | 'yearly' } body; anything else → monthly.
  let interval: BillingInterval = 'monthly'
  try {
    const body = (await request.json()) as { interval?: unknown }
    if (body?.interval === 'yearly') interval = 'yearly'
  } catch {
    // No/invalid body is fine — default to monthly.
  }

  // Attach the persistent Stripe customer BEFORE minting the session, so the
  // webhook's hop_customers lookup and getUserTier's read both resolve. If any
  // step fails we proceed customer-less — the webhook still self-heals the
  // mapping from the metadata.user_id ref minted below.
  let customerId = (await stripeCustomerIdFor(userId)) ?? undefined
  if (!customerId) {
    const created = await createStripeCustomer({ userId, email })
    if (created.ok) {
      customerId = created.customerId
      await saveStripeCustomer(userId, customerId)
    }
  }

  // Return destination. The ?upgraded=1 param is DISPLAY ONLY — tier truth is
  // written exclusively by the signed webhook, never from this redirect.
  const origin = process.env.APP_BASE_URL?.replace(/\/$/, '') || new URL(request.url).origin
  const result = await createCheckoutSession({
    userId,
    email,
    interval,
    customerId,
    successUrl: `${origin}/account?upgraded=1#billing`,
    cancelUrl: `${origin}/account#billing`,
  })
  if (!result.ok) {
    return json({ ok: false, error: 'Couldn’t reach billing — try again in a minute.' }, 503)
  }
  return json({ ok: true, url: result.url })
}
