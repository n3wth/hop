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

// The From identity. Override via HOP_ALERT_EMAIL_FROM; defaults to hop.flights.
// NOTE: the From domain must be VERIFIED in Resend for mail to flow — verify
// hop.flights (add Resend's DKIM/SPF records to Cloudflare DNS), or set
// HOP_ALERT_EMAIL_FROM to an already-verified domain as a stopgap.
function fromAddress(): string {
  const configured = process.env.HOP_ALERT_EMAIL_FROM
  if (configured && configured.trim()) return configured.trim()
  return 'hop <alerts@hop.flights>'
}

// Where new support tickets + escalation leads are emailed for human review.
// Configurable; defaults to the founder inbox.
function ownerAddress(): string {
  const a = process.env.HOP_OWNER_EMAIL
  return a && a.trim() ? a.trim() : 'oliver@newth.ai'
}

// The From identity for support REPLIES (support@ answering a user). Defaults to
// the support mailbox on the product domain — must be verified in Resend to send.
function supportFromAddress(): string {
  const a = process.env.HOP_SUPPORT_EMAIL_FROM
  return a && a.trim() ? a.trim() : 'hop support <support@hop.flights>'
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
  textLines.push('', 'You set this watch on hop. Manage it at hop.flights/account.')
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
    `<p style="margin:24px 0 0;color:#888;font-size:13px">You set this watch on hop. Manage it at hop.flights/account.</p>`,
    `</div>`,
  ].join('')

  return { subject, text, html }
}

// Render the "verify your email" message Better Auth requests on signup
// (emailVerification.sendVerificationEmail, lib/auth.ts). Terse, no marketing —
// state the action, one link, done.
export function renderVerificationEmail(url: string): { subject: string; text: string; html: string } {
  const subject = 'Verify your hop email'
  const text = [
    'Confirm this email to finish setting up hop.',
    '',
    `Verify: ${url}`,
    '',
    'If you didn’t request this, ignore it.',
  ].join('\n')
  const html = [
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.5;max-width:480px">`,
    `<p style="margin:0 0 8px;font-size:17px;font-weight:600">Verify your hop email</p>`,
    `<p style="margin:0 0 16px;color:#555">Confirm this email to finish setting up hop.</p>`,
    `<p style="margin:0"><a href="${escapeAttr(url)}" style="color:#0f6f6a;font-weight:600;text-decoration:underline">Verify email</a></p>`,
    `<p style="margin:24px 0 0;color:#888;font-size:13px">If you didn’t request this, ignore it.</p>`,
    `</div>`,
  ].join('')
  return { subject, text, html }
}

// Render the reset-password link (emailAndPassword.sendResetPassword, lib/auth.ts).
export function renderResetPasswordEmail(url: string): { subject: string; text: string; html: string } {
  const subject = 'Reset your hop password'
  const text = [
    'Reset your password.',
    '',
    `Reset: ${url}`,
    '',
    'This link expires in 1 hour. If you didn’t request this, ignore it.',
  ].join('\n')
  const html = [
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.5;max-width:480px">`,
    `<p style="margin:0 0 8px;font-size:17px;font-weight:600">Reset your password</p>`,
    `<p style="margin:0"><a href="${escapeAttr(url)}" style="color:#0f6f6a;font-weight:600;text-decoration:underline">Reset password</a></p>`,
    `<p style="margin:24px 0 0;color:#888;font-size:13px">This link expires in 1 hour. If you didn’t request this, ignore it.</p>`,
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

// Low-level Resend dispatch shared by every sender below. GATED: returns
// {ok:false, reason:'unconfigured'} (no network, no throw) when RESEND_API_KEY is
// absent; {ok:false, reason:'invalid-recipient'} for junk addresses. Any
// SDK/network failure is caught and reported as 'send-failed' — NEVER thrown — so
// a dead provider degrades the feature instead of crashing the caller.
interface Dispatch {
  from: string
  to: string | null | undefined
  subject: string
  text: string
  html?: string
  replyTo?: string
  headers?: Record<string, string>
}
async function dispatch(opts: Dispatch): Promise<EmailResult> {
  if (!isEmailEnabled()) return { ok: false, reason: 'unconfigured' }
  const { to } = opts
  if (!looksLikeEmail(to)) return { ok: false, reason: 'invalid-recipient' } // narrows `to` to string
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(env.resendApiKey())
    const { data, error } = await resend.emails.send({
      from: opts.from,
      to,
      subject: opts.subject,
      text: opts.text,
      ...(opts.html ? { html: opts.html } : {}),
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      ...(opts.headers ? { headers: opts.headers } : {}),
    })
    if (error) {
      // Resend refused the send — most commonly the From domain isn't verified
      // (DKIM/SPF) in Resend. Log the provider's reason (never the recipient or
      // the key): without this line, "no email arrived" is undiagnosable from
      // Vercel logs because this seam deliberately never throws.
      const e = error as { name?: string; message?: string }
      console.error('[email] resend send failed', {
        from: opts.from,
        subject: opts.subject,
        error: e.name,
        message: e.message,
      })
      return { ok: false, reason: 'send-failed' }
    }
    return { ok: true, id: data?.id }
  } catch (err) {
    console.error('[email] resend dispatch threw', {
      from: opts.from,
      subject: opts.subject,
      message: err instanceof Error ? err.message : String(err),
    })
    return { ok: false, reason: 'send-failed' }
  }
}

// Send one proactive standing-order alert email (subject/body rendered from the
// engine-computed alert fields). Gated; never throws.
export async function sendAlertEmail(
  to: string | null | undefined,
  alert: StandingOrderAlert,
): Promise<EmailResult> {
  const { subject, text, html } = renderAlertEmail(alert)
  return dispatch({ from: fromAddress(), to, subject, text, html })
}

// Email the owner/team a notification (new support ticket, new escalation lead)
// for human review. Gated; never throws.
export async function sendOwnerNotification(
  subject: string,
  text: string,
  html?: string,
): Promise<EmailResult> {
  return dispatch({ from: fromAddress(), to: ownerAddress(), subject, text, html })
}

// Send a support reply to a user from support@hop.flights, optionally threaded to
// the original inbound message (In-Reply-To/References from its Message-ID).
// Gated; never throws.
export async function sendSupportReply(
  to: string,
  subject: string,
  text: string,
  opts?: { inReplyTo?: string | null; html?: string },
): Promise<EmailResult> {
  const id = opts?.inReplyTo?.trim()
  const headers = id ? { 'In-Reply-To': id, References: id } : undefined
  return dispatch({ from: supportFromAddress(), to, subject, text, html: opts?.html, headers })
}

// Send the signup email-verification link (Better Auth's
// emailVerification.sendVerificationEmail callback). Gated; never throws.
export async function sendVerificationEmail(to: string, url: string): Promise<EmailResult> {
  const { subject, text, html } = renderVerificationEmail(url)
  return dispatch({ from: fromAddress(), to, subject, text, html })
}

// Send the password-reset link (Better Auth's
// emailAndPassword.sendResetPassword callback). Gated; never throws.
export async function sendResetPasswordEmail(to: string, url: string): Promise<EmailResult> {
  const { subject, text, html } = renderResetPasswordEmail(url)
  return dispatch({ from: fromAddress(), to, subject, text, html })
}
