// Resend email-event webhook — signature verification. Resend signs
// deliveries the Svix way (svix-id / svix-timestamp / svix-signature
// headers, HMAC over "id.timestamp.body" with the whsec_… secret), so we
// verify with the official `svix` SDK rather than hand-rolling HMAC.
//
// Same discriminated-result shape as lib/stripe.ts#verifyStripeEvent: NEVER
// throws, so app/api/webhooks/resend/route.ts stays a pure branch on `ok`.

import { Webhook, WebhookVerificationError } from 'svix'
import { env, hasEnv } from '@/lib/env'

export interface ResendWebhookEvent {
  type: string
  created_at?: string
  data: Record<string, unknown>
}

export type VerifyResendWebhookResult =
  | { ok: true; event: ResendWebhookEvent }
  | { ok: false; reason: 'unconfigured' | 'bad-signature' }

export interface SvixHeaders {
  svixId: string | null
  svixTimestamp: string | null
  svixSignature: string | null
}

export async function verifyResendWebhook(
  rawBody: string,
  headers: SvixHeaders,
): Promise<VerifyResendWebhookResult> {
  if (!hasEnv('RESEND_WEBHOOK_SECRET')) return { ok: false, reason: 'unconfigured' }
  if (!headers.svixId || !headers.svixTimestamp || !headers.svixSignature) {
    return { ok: false, reason: 'bad-signature' }
  }
  try {
    const wh = new Webhook(env.resendWebhookSecret())
    const payload = wh.verify(rawBody, {
      'svix-id': headers.svixId,
      'svix-timestamp': headers.svixTimestamp,
      'svix-signature': headers.svixSignature,
    })
    // A verified signature only proves Resend sent this body — it says
    // nothing about its shape. Validate before trusting `.type`/`.data` so a
    // signed-but-unexpected payload (e.g. a bare JSON literal) can't throw
    // past this boundary.
    if (!payload || typeof payload !== 'object') return { ok: false, reason: 'bad-signature' }
    const type = (payload as Record<string, unknown>).type
    if (typeof type !== 'string') return { ok: false, reason: 'bad-signature' }
    const data = (payload as Record<string, unknown>).data
    return {
      ok: true,
      event: { type, data: data && typeof data === 'object' ? (data as Record<string, unknown>) : {} },
    }
  } catch (error) {
    if (error instanceof WebhookVerificationError) return { ok: false, reason: 'bad-signature' }
    return { ok: false, reason: 'bad-signature' }
  }
}

// Resend's `data.to` is the recipient list (string or string[], depending on
// event); defensive parsing since we never trust upstream shape.
export function extractRecipientEmails(data: Record<string, unknown>): string[] {
  const raw = data?.to
  if (typeof raw === 'string') return [raw]
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string')
  return []
}
