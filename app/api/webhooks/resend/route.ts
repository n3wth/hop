// POST /api/webhooks/resend — Resend email-event webhook. Verify (Svix
// signature via lib/resend-webhook.ts) → route by event type → write
// (lib/email-suppressions.ts for bounced/complained). NEVER throws.
//
// Subscribed events (see the registered endpoint in Resend): email.bounced,
// email.complained, email.delivered, email.delivery_delayed, email.opened,
// email.clicked.
//
// Failure semantics:
//  - RESEND_WEBHOOK_SECRET unset (dev/local)  → log + 200 ack, no processing
//    (the route must still exist so a build/deploy without the secret
//    doesn't crash; it just can't verify anything until the secret exists)
//  - bad/missing signature                    → 401, never processed
//  - bounced / complained                     → upsert into the suppression
//    list (lib/email-suppressions.ts#recordSuppression — idempotent on
//    email, so a Svix retry of the same delivery is a no-op)
//  - delivered / opened / clicked / delayed   → logged only. There's no
//    existing cheap storage for per-message engagement signals
//    (hop_notification_outbox is keyed by user_id/kind/dedupeKey for
//    OUTBOUND delivery bookkeeping, not a fit for arbitrary inbound Resend
//    events keyed by raw email address). Deliberate scope cut — persist
//    these only once there's a real consumer for the data.
//
// Idempotency: recordSuppression's upsert is naturally idempotent (a
// redelivered bounced/complained event for the same address just re-writes
// the same row), so no separate processed-event dedup table is needed — the
// only side effects here are that idempotent upsert and a log line.

import { verifyResendWebhook, extractRecipientEmails } from '@/lib/resend-webhook'
import { recordSuppression } from '@/lib/email-suppressions'

export const runtime = 'nodejs'

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text()
  const verified = await verifyResendWebhook(rawBody, {
    svixId: request.headers.get('svix-id'),
    svixTimestamp: request.headers.get('svix-timestamp'),
    svixSignature: request.headers.get('svix-signature'),
  })

  if (!verified.ok) {
    if (verified.reason === 'unconfigured') {
      console.warn('resend-webhook: RESEND_WEBHOOK_SECRET not set — skipping verification')
      return json({ received: true, skipped: 'unconfigured' })
    }
    return json({ ok: false, error: 'Webhook signature failed' }, 401)
  }

  const { event } = verified
  const emails = extractRecipientEmails(event.data)

  switch (event.type) {
    case 'email.bounced':
      await Promise.all(emails.map((email) => recordSuppression(email, 'bounced')))
      break
    case 'email.complained':
      await Promise.all(emails.map((email) => recordSuppression(email, 'complained')))
      break
    case 'email.delivered':
    case 'email.opened':
    case 'email.clicked':
    case 'email.delivery_delayed':
      console.log(`resend-webhook: ${event.type}`, { emails })
      break
    default:
      console.log(`resend-webhook: unhandled event type ${event.type}`)
  }

  return json({ received: true })
}
