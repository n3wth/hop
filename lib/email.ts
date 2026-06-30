// Transactional email — the delivery channel for proactive standing-order alerts
// (lib/standing-order-alerts.ts). Resend-backed, but GATED on RESEND_API_KEY:
// when the key is absent the sender NO-OPS gracefully ({ok:false, reason:
// 'unconfigured'}) and NEVER throws, so the cron degrades to the in-app record
// exactly like every other hop seam (graceful degradation is the house style).
//
// Numbers are NEVER invented here. The subject/body render straight from the
// engine-computed alert fields (cpp, program, route) — the same values the
// verdict UI shows. This module only formats and sends; it computes nothing.
//
// Env is LAZY (lib/env.ts reads process.env at call time), so importing this
// file never requires a key, and the `resend` SDK is imported dynamically inside
// send() so a missing/absent key path never even loads it.

import { env, hasEnv } from '@/lib/env'
import type { StandingOrderAlert } from '@/lib/standing-order-alerts'

// Discriminated result — mirrors the upstream-client {ok} contract. Never throws.
export type EmailResult =
  | { ok: true; id?: string }
  | { ok: false; reason: 'unconfigured' | 'invalid-recipient' | 'send-failed' }

// The From identity. Configurable for when a verified sending domain lands;
// falls back to a sensible hop default. (A bare default still requires the
// domain to be verified in Resend before real mail flows — see the report.)
function fromAddress(): string {
  const configured = process.env.HOP_ALERT_EMAIL_FROM
  if (configured && configured.trim()) return configured.trim()
  return 'hop alerts <alerts@hop.travel>'
}

// True when email delivery is wired (a Resend key is present). Lets callers
// (the cron) skip the whole delivery step cheaply instead of attempting a send
// that's guaranteed to no-op.
export function isEmailEnabled(): boolean {
  return hasEnv('RESEND_API_KEY')
}

// Loose RFC-ish recipient check — enough to refuse obvious garbage without
// pretending to fully validate. We never throw on a bad address; we report it.
function looksLikeEmail(to: string | null | undefined): to is string {
  if (!to) return false
  const t = to.trim()
  return t.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

// Round a cpp for display the way the verdict copy does (1 decimal). Defensive:
// non-finite → no number rendered (we never fabricate one).
function fmtCpp(cpp: number | undefined): string | null {
  if (typeof cpp !== 'number' || !Number.isFinite(cpp)) return null
  return `${Math.round(cpp * 10) / 10}`
}

// The program/airline label for "via …". Empty when the option carries neither
// (it won't, for a redemption — but we stay defensive).
function viaLabel(alert: StandingOrderAlert): string | null {
  const program = alert.pick?.program?.trim()
  if (program) return program
  const airline = alert.pick?.airline?.trim()
  return airline || null
}

// Render the alert into a terse subject + plain-text + minimal HTML body. On
// brand: state the answer and the number, no slop, no emoji. e.g.
//   "Award space opened: SFO → TYO at 3.1¢/pt via ANA"
export function renderAlertEmail(alert: StandingOrderAlert): {
  subject: string
  text: string
  html: string
} {
  const route = alert.route?.trim() || 'your route'
  const cpp = fmtCpp(alert.cpp ?? alert.pick?.cpp)
  const via = viaLabel(alert)
  const rate = cpp ? `${cpp}¢/pt` : null

  // Subject: route + rate + program, dropping any piece we genuinely don't have.
  const subjectParts = [`Award space opened: ${route}`]
  if (rate) subjectParts.push(`at ${rate}`)
  if (via) subjectParts.push(`via ${via}`)
  const subject = subjectParts.join(' ')

  const miles = typeof alert.pick?.miles === 'number' ? alert.pick.miles : undefined
  const milesLine =
    miles != null ? `${miles.toLocaleString('en-US')} pts` : null
  const bookingUrl = alert.pick?.bookingUrl?.trim() || ''

  // Plain text — the canonical body. One line for the verdict, one for the
  // detail, one CTA. Terse.
  const textLines: string[] = [
    `${subject} — book now.`,
    '',
    milesLine ? `${route} · ${milesLine}${rate ? ` · ${rate}` : ''}` : `${route}`,
  ]
  if (bookingUrl) {
    textLines.push('', `Book: ${bookingUrl}`)
  }
  textLines.push('', 'You set this watch on hop. Manage it at hop.travel/account.')
  const text = textLines.join('\n')

  // Minimal, flat HTML — no shadows/gradients, system type, just the facts and a
  // single link. Inline styles only (email clients strip <style>).
  const detail = milesLine
    ? `${escapeHtml(route)} &middot; ${escapeHtml(milesLine)}${rate ? ` &middot; ${escapeHtml(rate)}` : ''}`
    : escapeHtml(route)
  const cta = bookingUrl
    ? `<p style="margin:16px 0 0"><a href="${escapeAttr(bookingUrl)}" style="color:#0f6f6a;font-weight:600;text-decoration:underline">Book now</a></p>`
    : ''
  const html = [
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.5;max-width:480px">`,
    `<p style="margin:0 0 8px;font-size:17px;font-weight:600">${escapeHtml(subject)}</p>`,
    `<p style="margin:0;color:#555">${detail}</p>`,
    cta,
    `<p style="margin:24px 0 0;color:#888;font-size:13px">You set this watch on hop. Manage it at hop.travel/account.</p>`,
    `</div>`,
  ].join('')

  return { subject, text, html }
}

// Minimal HTML escaping for the few user/engine-derived strings we interpolate.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
function escapeAttr(s: string): string {
  return escapeHtml(s)
}

// Send one alert email. GATED: returns {ok:false, reason:'unconfigured'} (no
// network, no throw) when RESEND_API_KEY is absent. Validates the recipient,
// renders from engine fields, and sends via Resend. Any SDK/network failure is
// caught and reported as {ok:false, reason:'send-failed'} — NEVER thrown — so a
// dead provider leaves the alert undelivered (to retry) instead of crashing the
// cron batch.
export async function sendAlertEmail(
  to: string | null | undefined,
  alert: StandingOrderAlert,
): Promise<EmailResult> {
  if (!isEmailEnabled()) return { ok: false, reason: 'unconfigured' }
  if (!looksLikeEmail(to)) return { ok: false, reason: 'invalid-recipient' }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(env.resendApiKey())
    const { subject, text, html } = renderAlertEmail(alert)

    const { data, error } = await resend.emails.send({
      from: fromAddress(),
      to,
      subject,
      text,
      html,
    })
    if (error) return { ok: false, reason: 'send-failed' }
    return { ok: true, id: data?.id }
  } catch {
    // Import failure, malformed key, or network error — degrade, never throw.
    return { ok: false, reason: 'send-failed' }
  }
}
