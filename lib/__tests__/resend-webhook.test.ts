import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Webhook } from 'svix'
import { verifyResendWebhook, extractRecipientEmails } from '@/lib/resend-webhook'

// The Resend webhook seam is GATED + graceful, like every hop upstream client:
//  - keyless (RESEND_WEBHOOK_SECRET unset) → {ok:false,'unconfigured'}, never
//    throws
//  - configured + a genuinely valid Svix signature → {ok:true, event}
//  - configured + forged/missing signature → {ok:false,'bad-signature'}
//
// Unlike Stripe (whose SDK owns the signing key), we own the HMAC here via
// the same `svix` package Resend signs with, so we can mint a REAL valid
// signature in tests, not just exercise the rejection paths.

const SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'
const ORIGINAL = process.env.RESEND_WEBHOOK_SECRET

beforeEach(() => {
  delete process.env.RESEND_WEBHOOK_SECRET
})
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.RESEND_WEBHOOK_SECRET
  else process.env.RESEND_WEBHOOK_SECRET = ORIGINAL
})

function signPayload(payload: string) {
  const wh = new Webhook(SECRET)
  const svixId = 'msg_test_123'
  const timestamp = new Date()
  const signature = wh.sign(svixId, timestamp, payload)
  return {
    svixId,
    svixTimestamp: String(Math.floor(timestamp.getTime() / 1000)),
    svixSignature: signature,
  }
}

describe('verifyResendWebhook — unconfigured', () => {
  it('resolves {ok:false, unconfigured} without a secret, even with headers present', async () => {
    const res = await verifyResendWebhook('{}', {
      svixId: 'msg_1',
      svixTimestamp: '1700000000',
      svixSignature: 'v1,deadbeef',
    })
    expect(res).toEqual({ ok: false, reason: 'unconfigured' })
  })
})

describe('verifyResendWebhook — configured', () => {
  beforeEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = SECRET
  })

  it('accepts a genuinely valid Svix signature and returns the parsed event', async () => {
    const payload = JSON.stringify({
      type: 'email.bounced',
      data: { to: ['bounced@example.com'] },
    })
    const headers = signPayload(payload)
    const res = await verifyResendWebhook(payload, headers)
    expect(res).toEqual({
      ok: true,
      event: { type: 'email.bounced', data: { to: ['bounced@example.com'] } },
    })
  })

  it('rejects a forged signature', async () => {
    const payload = JSON.stringify({ type: 'email.bounced', data: {} })
    const res = await verifyResendWebhook(payload, {
      svixId: 'msg_1',
      svixTimestamp: String(Math.floor(Date.now() / 1000)),
      svixSignature: 'v1,not-a-real-signature',
    })
    expect(res).toEqual({ ok: false, reason: 'bad-signature' })
  })

  it('rejects a valid signature reused on a DIFFERENT payload (tamper)', async () => {
    const payload = JSON.stringify({ type: 'email.bounced', data: {} })
    const headers = signPayload(payload)
    const tampered = JSON.stringify({ type: 'email.delivered', data: {} })
    const res = await verifyResendWebhook(tampered, headers)
    expect(res).toEqual({ ok: false, reason: 'bad-signature' })
  })

  it('rejects when any Svix header is missing', async () => {
    const payload = JSON.stringify({ type: 'email.bounced', data: {} })
    const headers = signPayload(payload)
    expect(
      await verifyResendWebhook(payload, { ...headers, svixSignature: null }),
    ).toEqual({ ok: false, reason: 'bad-signature' })
    expect(
      await verifyResendWebhook(payload, { ...headers, svixId: null }),
    ).toEqual({ ok: false, reason: 'bad-signature' })
    expect(
      await verifyResendWebhook(payload, { ...headers, svixTimestamp: null }),
    ).toEqual({ ok: false, reason: 'bad-signature' })
  })
})

describe('extractRecipientEmails', () => {
  it('reads a string `to`', () => {
    expect(extractRecipientEmails({ to: 'a@example.com' })).toEqual(['a@example.com'])
  })

  it('reads an array `to`, dropping non-string entries', () => {
    expect(extractRecipientEmails({ to: ['a@example.com', 42, 'b@example.com'] })).toEqual([
      'a@example.com',
      'b@example.com',
    ])
  })

  it('returns [] for absent or malformed `to`', () => {
    expect(extractRecipientEmails({})).toEqual([])
    expect(extractRecipientEmails({ to: null })).toEqual([])
    expect(extractRecipientEmails({ to: 42 })).toEqual([])
  })
})
