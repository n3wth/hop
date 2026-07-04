// GET /api/cron/sync-stripe — daily reconciliation sweep: re-reads every
// subscription from Stripe and re-writes it through the SAME lane the webhook
// uses (lib/stripe.ts#listSubscriptionRecords → lib/subscription.ts#
// recordSubscription), healing any webhook deliveries that were missed.
//
// Double-gated like every cron: CRON_SECRET AND isBillingEnabled() — with
// Stripe keys present in Vercel but the flag off, this stays a no-op (the
// lib/env.ts contract: the deploy is inert until the operator flips
// HOP_ENABLE_BILLING). No direct SDK/process.env.STRIPE_* use here — the
// Stripe seam stays lib/stripe.ts.

import { NextResponse } from 'next/server'
import { isBillingEnabled } from '@/lib/env'
import { listSubscriptionRecords } from '@/lib/stripe'
import { recordSubscription } from '@/lib/subscription'

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  }
  if (!isBillingEnabled()) {
    return NextResponse.json({ ok: false, reason: 'billing-disabled' }, { status: 503 })
  }

  const listed = await listSubscriptionRecords()
  if (!listed.ok) {
    return NextResponse.json({ ok: false, error: listed.reason }, { status: 500 })
  }

  let synced = 0
  for (const { record, customerId } of listed.items) {
    if (!customerId) continue
    // A list read carries no metadata user ref — attribution is our stored
    // hop_customers mapping only; unmapped customers are skipped, not healed.
    const outcome = await recordSubscription({
      userId: null,
      stripeCustomerId: customerId,
      record,
    })
    if (outcome === 'ok') synced++
  }
  return NextResponse.json({ ok: true, synced, total: listed.items.length })
}
