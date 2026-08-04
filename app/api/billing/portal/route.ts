// POST /api/billing/portal — open the Stripe-hosted Billing Portal so a Pro
// subscriber can update their payment method or cancel without hop ever
// touching card data or writing tier state itself (a cancellation here only
// takes effect once Stripe's customer.subscription.deleted webhook fires —
// see app/api/webhooks/stripe/route.ts).
//
// Same shape as app/api/billing/checkout/route.ts: a plain
// `<form method="POST" action="/api/billing/portal">` (components/
// BillingSection.tsx, the /account status line), every outcome a redirect,
// never bare JSON. New code — uses lib/session.ts#getUserId per CLAUDE.md's
// convention, unlike the older auth0-based checkout/account call sites this
// change deliberately leaves alone.
//
// Gated on isBillingEnabled(): off → redirect with billingError=unavailable.
// Rate-limited per-user + per-IP before any Stripe work. NEVER throws.
//
// NOT behind checkBotId(): botid's client SDK (instrumentation-client.ts)
// only patches window.fetch/XMLHttpRequest to attach the x-is-human challenge
// header — it never intercepts a native HTMLFormElement submit. Since this
// route is deliberately invoked via a plain <form method="POST"> (see
// above), the browser can never send that header, so checkBotId() here would
// just hit its "possible misconfiguration" fallback on every legitimate
// request and silently downgrade bot classification. The auth requirement
// (getUserId() below) plus the per-user/per-IP rate limit are the defense on
// this route instead.

import { getUserId } from '@/lib/session'
import { isBillingEnabled } from '@/lib/env'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { createBillingPortalSession } from '@/lib/stripe'
import { stripeCustomerIdFor } from '@/lib/subscription'

export const runtime = 'nodejs'

// Same shape as checkout's throttle — a real person opens the portal rarely.
const PORTAL_RATE = { capacity: 4, refillPerSec: 0.05 } // 4 burst, ~3/min

type BillingErrorCode = 'unavailable' | 'rate-limited' | 'no-customer' | 'stripe'

export async function POST(request: Request): Promise<Response> {
  const origin = process.env.APP_BASE_URL?.replace(/\/$/, '') || new URL(request.url).origin
  const toAccount = (error: BillingErrorCode) =>
    Response.redirect(`${origin}/account?billingError=${error}#billing`, 303)

  if (!isBillingEnabled()) return toAccount('unavailable')

  const userId = await getUserId()
  if (!userId) {
    return Response.redirect(`${origin}/login?returnTo=${encodeURIComponent('/account')}`, 303)
  }

  const ip = clientIp(request)
  for (const k of [`billing-portal:sub:${userId}`, `billing-portal:ip:${ip}`]) {
    if (!(await checkRateLimit(k, PORTAL_RATE)).ok) return toAccount('rate-limited')
  }

  const lookup = await stripeCustomerIdFor(userId)
  const customerId = lookup.ok ? lookup.customerId : null
  if (!customerId) return toAccount('no-customer')

  const result = await createBillingPortalSession({
    customerId,
    returnUrl: `${origin}/account#billing`,
  })
  if (!result.ok) return toAccount('stripe')
  return Response.redirect(result.url, 303)
}
