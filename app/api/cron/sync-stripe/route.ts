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
import { isAuthorizedCron } from '@/lib/cron-auth'
import { recordHeartbeat } from '@/lib/cron-heartbeat'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  }
  if (!isBillingEnabled()) {
    // Liveness record (ADR 0007): being off is an owner choice, not an outage.
    await recordHeartbeat('sync-stripe', false, 'disabled')
    return NextResponse.json({ ok: false, reason: 'billing-disabled' }, { status: 503 })
  }

  const listed = await listSubscriptionRecords()
  if (!listed.ok) {
    // Still a completed run — the cron itself worked; Stripe didn't (same
    // convention as valuation-sync's 'worker-unreachable').
    await recordHeartbeat('sync-stripe', true, `stripe-unreachable: ${listed.reason}`)
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
  // Liveness record (ADR 0007): after the work — ran to completion.
  await recordHeartbeat('sync-stripe', true, `synced:${synced} total:${listed.items.length}`)
  return NextResponse.json({ ok: true, synced, total: listed.items.length })
}
