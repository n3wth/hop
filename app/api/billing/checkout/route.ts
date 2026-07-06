// POST /api/billing/checkout — start a premium upgrade. Creates a Stripe-hosted
// Checkout Session and 303-redirects the browser straight to it; the hosted
// page is the human money gate (hop never charges programmatically and never
// touches card data). Auth0 session REQUIRED — the session's sub is the
// user_id ref minted into the Checkout Session, which is the only way a tier
// write is ever attributed (never a caller-supplied id).
//
// Invoked by a plain `<form method="POST" action="/api/billing/checkout">`
// (components/BillingSection.tsx) — deliberately NOT a client fetch()/onClick
// handler: it works with JS disabled, needs no popup-blocker workaround, and
// keeps the whole flow a single browser navigation. That means every outcome,
// success or failure, has to be a redirect (never bare JSON) — failures land
// back on /pricing with a `billingError` code the page turns into copy.
//
// Gated on isBillingEnabled(): off → redirect to /pricing (billingError=
// unavailable), so the deploy is inert until the operator flips
// HOP_ENABLE_BILLING with the Stripe keys set. Rate-limited per-sub + per-IP
// BEFORE any Stripe work (each session create is otherwise a free Stripe API
// call for a scripted caller). NEVER throws.

import { checkBotId } from 'botid/server'
import { auth0 } from '@/lib/auth0'
import { isBillingEnabled } from '@/lib/env'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { createCheckoutSession, createStripeCustomer, type BillingInterval } from '@/lib/stripe'
import { stripeCustomerIdFor, saveStripeCustomer } from '@/lib/subscription'

export const runtime = 'nodejs'

// A small burst then a trickle — a real person picks a plan once, maybe twice.
const CHECKOUT_RATE = { capacity: 4, refillPerSec: 0.05 } // 4 burst, ~3/min

type BillingErrorCode = 'bot' | 'unavailable' | 'rate-limited' | 'stripe'

export async function POST(request: Request): Promise<Response> {
  const origin = process.env.APP_BASE_URL?.replace(/\/$/, '') || new URL(request.url).origin
  const toPricing = (error: BillingErrorCode) =>
    Response.redirect(`${origin}/pricing?billingError=${error}`, 303)

  const verification = await checkBotId()
  if (verification.isBot) return toPricing('bot')

  if (!isBillingEnabled()) return toPricing('unavailable')

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
  // A signed-out visitor shouldn't be able to reach this form (the page only
  // renders it when signed in), but a direct POST degrades to login, not an
  // error page.
  if (!userId) {
    return Response.redirect(`${origin}/login?returnTo=${encodeURIComponent('/pricing')}`, 303)
  }

  // Throttle before touching Stripe: per-sub (can't rotate IPs past it) + per-IP.
  const ip = clientIp(request)
  for (const k of [`billing:sub:${userId}`, `billing:ip:${ip}`]) {
    if (!(await checkRateLimit(k, CHECKOUT_RATE)).ok) return toPricing('rate-limited')
  }

  // `interval` comes from a hidden form field (BillingSection posts a plain
  // <form>, not JSON). hop is annual-only at launch (business plan §3.1) —
  // 'yearly' is the default and the only value the current UI ever sends;
  // 'monthly' stays reachable for when that changes.
  let interval: BillingInterval = 'yearly'
  try {
    const form = await request.formData()
    if (form.get('interval') === 'monthly') interval = 'monthly'
  } catch {
    // No/invalid body is fine — default to yearly.
  }

  // Attach the persistent Stripe customer BEFORE minting the session, so the
  // webhook's hop_customers lookup and getUserTier's read both resolve. Mint a
  // NEW Stripe customer only on a clean "no customer yet" read — on a lookup
  // failure (DB blip) proceed customer-less instead, so a repeat customer never
  // gets a duplicate Stripe customer; the webhook self-heals the mapping from
  // the metadata.user_id ref minted below.
  const lookup = await stripeCustomerIdFor(userId)
  let customerId = lookup.ok ? (lookup.customerId ?? undefined) : undefined
  if (lookup.ok && !customerId) {
    const created = await createStripeCustomer({ userId, email })
    if (created.ok) {
      customerId = created.customerId
      await saveStripeCustomer(userId, customerId)
    }
  }

  // Return destination. The ?upgraded=1 param is DISPLAY ONLY — tier truth is
  // written exclusively by the signed webhook, never from this redirect.
  const result = await createCheckoutSession({
    userId,
    email,
    interval,
    customerId,
    successUrl: `${origin}/account?upgraded=1#billing`,
    cancelUrl: `${origin}/account#billing`,
  })
  if (!result.ok) return toPricing('stripe')
  return Response.redirect(result.url, 303)
}
