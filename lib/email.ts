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
import type { LedgerDream } from '@/lib/ledger-dream'
import { SITE_URL } from '@/lib/seo'
import { isSuppressed } from '@/lib/email-suppressions'
import { PRO_PRICE_YEARLY_USD } from '@/lib/pricing'

// Discriminated result — mirrors the upstream-client {ok} contract. Never throws.
// 'suppressed' = the recipient bounced or complained before (lib/email-suppressions.ts);
// dispatch() refuses the send for EVERY sender, protecting Resend deliverability.
export type EmailResult =
  | { ok: true; id?: string }
  | { ok: false; reason: 'unconfigured' | 'invalid-recipient' | 'suppressed' | 'send-failed' }

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

// ── Email design system (owner-specified; applies to every template added or
// touched from 2026-08 on) ───────────────────────────────────────────────────
// White background (no cream wash), the bunny mark (44px) at top — never a
// text wordmark — and card-structured content (bordered rounded cards with
// stat rows + small pill chips, like the product's Verdict Card) over
// paragraphs. Sentence case throughout: no kicker labels, no all-caps, no
// fake-warmth phrases. Numbers use the same sans stack as body copy — no
// monospace — differentiated by weight/size/color only. Colors and radii are
// the EXACT site tokens from app/globals.css @theme (do not approximate).
// Table-based HTML for email-client safety; every sender also provides a
// text/plain alternative.
const EMAIL_FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
const BUNNY_SRC = 'https://hop.flights/bunny.svg'
// app/globals.css @theme — exact hex, kept in sync by hand.
const TOK = {
  text: '#14201f', // --color-text
  text2: '#4a5a58', // --color-text2
  text3: '#5f6f6c', // --color-text3
  border: '#e2ddd2', // --color-border
  borderSoft: '#ece9e1', // --color-border-soft
  brand: '#0d6e6e', // --color-brand
  goodText: '#0d6e6e', // --color-good
  goodBg: '#e3f1ef', // --color-good-bg
  okText: '#8f5618', // --color-ok
  okBg: '#f6ecd9', // --color-ok-bg
  weakText: '#a8513a', // --color-weak
  weakBg: '#f4e7e3', // --color-weak-bg
} as const
const RADIUS = { sm: 10, md: 14, lg: 20 } as const // --radius-sm / --radius / --radius-lg

// The outer table shell: white ground, bunny mark, body, quiet footer line.
function emailShell(bodyHtml: string, footerHtml: string): string {
  return [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff">`,
    `<tr><td align="center" style="padding:32px 16px 40px">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:${EMAIL_FONT};color:${TOK.text};font-size:15px;line-height:1.5;text-align:left">`,
    `<tr><td style="padding:0 0 20px"><img src="${BUNNY_SRC}" width="44" height="44" alt="hop" style="display:block;border:0" /></td></tr>`,
    `<tr><td>${bodyHtml}</td></tr>`,
    `<tr><td style="padding:28px 0 0;color:${TOK.text3};font-size:13px;line-height:1.5">${footerHtml}</td></tr>`,
    `</table></td></tr></table>`,
  ].join('')
}

// A bordered rounded card — the email cousin of the product's Verdict Card.
function emailCard(inner: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${TOK.border};border-radius:${RADIUS.lg}px"><tr><td style="padding:6px 20px">${inner}</td></tr></table>`
}

// One label/value stat row inside a card. Values render in the body sans
// stack (never monospace), weight-differentiated. Pre-escaped HTML is allowed
// in `valueHtml` (for pills); `label` is escaped here.
function statRow(label: string, valueHtml: string, opts?: { last?: boolean }): string {
  const border = opts?.last ? '' : `border-bottom:1px solid ${TOK.borderSoft};`
  return [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${border}"><tr>`,
    `<td style="padding:12px 0;font-size:13px;color:${TOK.text2}">${escapeHtml(label)}</td>`,
    `<td align="right" style="padding:12px 0;font-size:14px;font-weight:600;color:${TOK.text}">${valueHtml}</td>`,
    `</tr></table>`,
  ].join('')
}

// Small tier pill — same tone mapping as the product's value tiers.
function pill(label: string, tone: 'good' | 'ok' | 'weak'): string {
  const c =
    tone === 'good'
      ? { fg: TOK.goodText, bg: TOK.goodBg }
      : tone === 'ok'
        ? { fg: TOK.okText, bg: TOK.okBg }
        : { fg: TOK.weakText, bg: TOK.weakBg }
  return `<span style="display:inline-block;border-radius:999px;background:${c.bg};color:${c.fg};padding:2px 10px;font-size:12px;font-weight:600">${escapeHtml(label)}</span>`
}

// Primary CTA — solid brand button, site --radius.
function ctaButton(href: string, label: string): string {
  return `<a href="${escapeAttr(href)}" style="display:inline-block;border-radius:${RADIUS.md}px;background:${TOK.brand};color:#ffffff;padding:12px 22px;font-size:15px;font-weight:600;text-decoration:none">${escapeHtml(label)}</a>`
}

function textLink(href: string, label: string): string {
  return `<a href="${escapeAttr(href)}" style="color:${TOK.brand};font-weight:600;text-decoration:underline">${escapeHtml(label)}</a>`
}

function heading(text: string): string {
  return `<p style="margin:0 0 8px;font-size:22px;font-weight:600;letter-spacing:-0.01em;color:${TOK.text}">${escapeHtml(text)}</p>`
}

// List-Unsubscribe / List-Unsubscribe-Post headers. Newsletter/digest sends
// pass their real per-recipient HMAC unsubscribe URL (RFC 8058 one-click);
// senders without one (standing-order alerts) fall back to a mailto +
// account-manage pair — no Post header, since that fallback isn't one-click.
function unsubscribeHeaders(url?: string): Record<string, string> {
  if (url && url.trim()) {
    return {
      'List-Unsubscribe': `<${url.trim()}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    }
  }
  return {
    'List-Unsubscribe': `<mailto:support@hop.flights?subject=unsubscribe>, <${SITE_URL}/account>`,
  }
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

  const isChart = alert.pick?.availability === 'chart'
  // Chart rows are not space. Never "Award space opened" / "book now" on a table.
  const subjectParts = [
    isChart ? `Cash vs chart: ${route}` : `Award space opened: ${route}`,
  ]
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
    isChart ? `${subject}.` : `${subject} — book now.`,
    '',
    milesLine ? `${route} · ${milesLine}${rate ? ` · ${rate}` : ''}` : `${route}`,
  ]
  if (bookingUrl) {
    textLines.push('', isChart ? `Check space: ${bookingUrl}` : `Book: ${bookingUrl}`)
  }
  textLines.push(
    '',
    'You set this watch on hop. Manage it at hop.flights/account.',
    `Unsubscribe from these alerts: ${SITE_URL}/account`,
  )
  const text = textLines.join('\n')

  // Card-structured HTML in the email design system (see the block above):
  // route/points/value stat rows with a tier pill, one CTA. Inline styles
  // only (email clients strip <style>).
  const tier = alert.pick?.tier
  const rateValue = rate
    ? tier === 'green'
      ? `${escapeHtml(rate)} &nbsp;${pill('Great value', 'good')}`
      : tier === 'amber'
        ? `${escapeHtml(rate)} &nbsp;${pill('Fair value', 'ok')}`
        : escapeHtml(rate)
    : null
  const rows: string[] = [statRow('Route', escapeHtml(route))]
  if (milesLine) rows.push(statRow('Points', escapeHtml(milesLine)))
  if (rateValue) rows.push(statRow('Value', rateValue))
  if (via) rows.push(statRow('Program', escapeHtml(via)))
  // Re-mark the final row so the card doesn't end on a divider.
  rows[rows.length - 1] = rows[rows.length - 1].replace(
    `border-bottom:1px solid ${TOK.borderSoft};`,
    '',
  )
  const cta = bookingUrl
    ? `<p style="margin:20px 0 0">${ctaButton(bookingUrl, isChart ? 'Check for space' : 'Book now')}</p>`
    : ''
  const body = [
    heading(subject),
    `<p style="margin:0 0 16px;color:${TOK.text2}">${isChart ? 'Published saver rate. Space not confirmed.' : 'Live award space at the rate you asked to watch for.'}</p>`,
    emailCard(rows.join('')),
    cta,
  ].join('')
  const footer = `You set this watch on hop. Manage or ${textLink(`${SITE_URL}/account`, 'unsubscribe from these alerts')} at hop.flights/account.`
  const html = emailShell(body, footer)

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
    `<p style="margin:24px 0 0;color:#767676;font-size:13px">If you didn’t request this, ignore it.</p>`,
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
    `<p style="margin:24px 0 0;color:#767676;font-size:13px">This link expires in 1 hour. If you didn’t request this, ignore it.</p>`,
    `</div>`,
  ].join('')
  return { subject, text, html }
}

// Render the newsletter double-opt-in confirmation link (R1.6). Terse, no
// marketing — state the action, one link, done, same shape as
// renderVerificationEmail.
export function renderNewsletterConfirmationEmail(url: string): {
  subject: string
  text: string
  html: string
} {
  const subject = 'Confirm your hop newsletter signup'
  const text = [
    'One click to start getting your wallet’s best redemption, weekly.',
    '',
    `Confirm: ${url}`,
    '',
    'If you didn’t request this, ignore it — nothing sends until you confirm.',
  ].join('\n')
  const html = [
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.5;max-width:480px">`,
    `<p style="margin:0 0 8px;font-size:17px;font-weight:600">Confirm your hop newsletter signup</p>`,
    `<p style="margin:0 0 16px;color:#555">One click to start getting your wallet’s best redemption, weekly.</p>`,
    `<p style="margin:0"><a href="${escapeAttr(url)}" style="color:#0f6f6a;font-weight:600;text-decoration:underline">Confirm</a></p>`,
    `<p style="margin:24px 0 0;color:#767676;font-size:13px">If you didn’t request this, ignore it — nothing sends until you confirm.</p>`,
    `</div>`,
  ].join('')
  return { subject, text, html }
}

// Render the R2.3 weekly digest — "your wallet's best redemption this week".
// dream is lib/ledger-dream.ts#ledgerDream's output: the SAME engine
// (computeCpp/topValue/affordableWith over lib/destinations.ts) the signed-in
// home page runs, so every number here is computed, never generated.
// dream.saveToward distinguishes a personalized pick (real balances reach it
// now) from the honest sample fallback (nothing reaches yet — save toward
// this), and the subject/copy say which, never blurring the two.
export function renderWeeklyDigestEmail(
  dream: LedgerDream,
  unsubscribeUrl: string,
): { subject: string; text: string; html: string } {
  const city = dream.destination.city
  const country = dream.destination.country
  const cpp = fmtCpp(dream.cpp)
  const rate = cpp ? `${cpp}¢/pt` : null
  const miles = `${dream.milesNeeded.toLocaleString('en-US')} pts`
  const cash = `$${Math.round(dream.cashValue).toLocaleString('en-US')}`
  const program = dream.proof.program

  const headline = dream.saveToward
    ? `Worth saving toward: ${city}`
    : `This week's best redemption: ${city}`
  const subjectParts = [headline]
  if (rate) subjectParts.push(`at ${rate}`)
  const subject = subjectParts.join(' ')

  const detail = `${city}, ${country} · ${miles} via ${program}${rate ? ` · ${rate}` : ''} · cash price ${cash}`

  const textLines = [`${subject}.`, '', detail]
  if (!dream.saveToward) textLines.push('', dream.proof.path)
  textLines.push(
    '',
    dream.saveToward
      ? 'You don’t hold enough toward this one yet — it’s the best value in reach as your balance grows.'
      : 'You can book this with the points you hold right now.',
    '',
    `See more: ${SITE_URL}/ask`,
    '',
    `Unsubscribe: ${unsubscribeUrl}`,
  )
  const text = textLines.join('\n')

  const pathLine = !dream.saveToward
    ? `<p style="margin:8px 0 0;color:#767676;font-size:13px">${escapeHtml(dream.proof.path)}</p>`
    : ''
  const html = [
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.5;max-width:480px">`,
    `<p style="margin:0 0 8px;font-size:17px;font-weight:600">${escapeHtml(subject)}</p>`,
    `<p style="margin:0;color:#555">${escapeHtml(detail)}</p>`,
    pathLine,
    `<p style="margin:16px 0 0"><a href="${escapeAttr(`${SITE_URL}/ask`)}" style="color:#0f6f6a;font-weight:600;text-decoration:underline">See more</a></p>`,
    `<p style="margin:24px 0 0;color:#767676;font-size:13px">You get this because you subscribed on hop. <a href="${escapeAttr(unsubscribeUrl)}" style="color:#767676">Unsubscribe</a>.</p>`,
    `</div>`,
  ].join('')

  return { subject, text, html }
}

// Send the newsletter double-opt-in confirmation link. Gated; never throws.
export async function sendNewsletterConfirmationEmail(to: string, url: string): Promise<EmailResult> {
  const { subject, text, html } = renderNewsletterConfirmationEmail(url)
  return dispatch({ from: fromAddress(), to, subject, text, html })
}

// Send one subscriber's weekly digest. Gated; never throws.
export async function sendWeeklyDigestEmail(
  to: string,
  dream: LedgerDream,
  unsubscribeUrl: string,
): Promise<EmailResult> {
  const { subject, text, html } = renderWeeklyDigestEmail(dream, unsubscribeUrl)
  return dispatch({
    from: fromAddress(),
    to,
    subject,
    text,
    html,
    // The real per-recipient HMAC unsubscribe URL — one-click (RFC 8058).
    headers: unsubscribeHeaders(unsubscribeUrl),
  })
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
// absent; {ok:false, reason:'invalid-recipient'} for junk addresses;
// {ok:false, reason:'suppressed'} for addresses that bounced or complained
// (lib/email-suppressions.ts, written by the Resend webhook) — the suppression
// check lives HERE so every sender inherits it and no new send path can forget
// it. Any SDK/network failure is caught and reported as 'send-failed' — NEVER
// thrown — so a dead provider degrades the feature instead of crashing the caller.
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
  // Compliance gate for EVERY sender: an address that bounced or complained
  // never receives another hop email from any path. Fails OPEN on a db error
  // (isSuppressed's own contract), so a storage blip can't block real sends.
  if (await isSuppressed(to)) return { ok: false, reason: 'suppressed' }
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
  return dispatch({
    from: fromAddress(),
    to,
    subject,
    text,
    html,
    // No per-recipient unsubscribe URL exists for alerts — mailto/manage fallback.
    headers: unsubscribeHeaders(),
  })
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

// ── Lifecycle emails (welcome / Pro welcome / cancellation) ─────────────────

// The signup welcome. Numbers are the CANONICAL worked example from
// docs/design/copy-spec.md (the SFO→LAX round-trip mock through the real
// engine: cash $254, 9,000 miles + $22 taxes, 2.6¢/pt, save $232) — labeled a
// sample, never presented as the recipient's own economics.
export function renderWelcomeEmail(): { subject: string; text: string; html: string } {
  const subject = 'Your points have a cash value'
  const searchUrl = `${SITE_URL}/search`
  const accountUrl = `${SITE_URL}/account`
  const text = [
    'Your points have a cash value. Let’s find it.',
    '',
    'hop prices any route in ¢/pt — cash fares vs published saver charts — and tells you when points beat cash. Every number is computed, never guessed.',
    '',
    'Sample verdict — SFO → LAX round trip:',
    'Cash $254 · Alaska 9,000 miles + $22 taxes · 2.6¢/pt · save $232',
    '',
    `Run a search: ${searchUrl}`,
    `Add your balances: ${accountUrl}`,
  ].join('\n')
  const body = [
    heading('Your points have a cash value. Let’s find it.'),
    `<p style="margin:0 0 16px;color:${TOK.text2}">hop prices any route in ¢/pt — cash fares vs published saver charts — and tells you when points beat cash. Every number is computed, never guessed.</p>`,
    `<p style="margin:0 0 8px;font-size:13px;color:${TOK.text3}">Sample verdict — SFO → LAX round trip</p>`,
    emailCard(
      [
        statRow('Cash price', '$254'),
        statRow('Alaska miles', '9,000 + $22 taxes'),
        statRow('Value', `2.6¢/pt &nbsp;${pill('Great value', 'good')}`),
        statRow('You save', '$232', { last: true }),
      ].join(''),
    ),
    `<p style="margin:20px 0 0">${ctaButton(searchUrl, 'Run a search')}</p>`,
    `<p style="margin:14px 0 0;font-size:14px">${textLink(accountUrl, 'Add your balances')} and the verdict uses your real points.</p>`,
  ].join('')
  const footer = 'You’re getting this because you created a hop account at hop.flights.'
  return { subject, text, html: emailShell(body, footer) }
}

// The free→premium upgrade welcome. $49/yr grandfathered per lib/pricing.ts.
export function renderProWelcomeEmail(): { subject: string; text: string; html: string } {
  const subject = 'hop Pro is on'
  const searchUrl = `${SITE_URL}/search`
  const price = `$${PRO_PRICE_YEARLY_USD}/yr`
  const text = [
    'hop Pro is on. Watches are now unlimited.',
    '',
    'Set a watch on any route and hop checks it around the clock, then emails you when award space opens at a rate worth booking.',
    '',
    `Your price: ${price}, grandfathered — it never goes up while you stay subscribed.`,
    '',
    `Set a watch: ${searchUrl}`,
  ].join('\n')
  const body = [
    heading('hop Pro is on.'),
    `<p style="margin:0 0 16px;color:${TOK.text2}">Set a watch on any route and hop checks it around the clock, then emails you when award space opens at a rate worth booking.</p>`,
    emailCard(
      [
        statRow('Watches', `Unlimited &nbsp;${pill('Pro', 'good')}`),
        statRow('Search + verdict', 'Included'),
        statRow('Your price', `${price}, grandfathered`, { last: true }),
      ].join(''),
    ),
    `<p style="margin:20px 0 0">${ctaButton(searchUrl, 'Set a watch')}</p>`,
    `<p style="margin:14px 0 0;font-size:14px;color:${TOK.text2}">Grandfathered means ${price} for as long as you stay subscribed, even after the price rises.</p>`,
  ].join('')
  const footer = `You’re getting this because you upgraded to hop Pro. Manage billing at ${textLink(`${SITE_URL}/account`, 'hop.flights/account')}.`
  return { subject, text, html: emailShell(body, footer) }
}

// The subscription-ended note. Terse: what stays free, one come-back link.
export function renderCancellationEmail(): { subject: string; text: string; html: string } {
  const subject = 'hop Pro is canceled'
  const pricingUrl = `${SITE_URL}/pricing`
  const price = `$${PRO_PRICE_YEARLY_USD}/yr`
  const text = [
    'hop Pro is canceled. No more charges.',
    '',
    'What stays free: full search and the verdict, plus 3 watches.',
    '',
    `Come back anytime: ${pricingUrl}`,
  ].join('\n')
  const body = [
    heading('hop Pro is canceled.'),
    `<p style="margin:0 0 16px;color:${TOK.text2}">No more charges. Here’s what stays on the free plan:</p>`,
    emailCard(
      [
        statRow('Search + verdict', 'Included'),
        statRow('Watches', '3'),
        statRow('Pro', `${price} when you want it back`, { last: true }),
      ].join(''),
    ),
    `<p style="margin:20px 0 0;font-size:14px">Come back anytime: ${textLink(pricingUrl, 'hop.flights/pricing')}.</p>`,
  ].join('')
  const footer = 'You’re getting this because your hop Pro subscription ended.'
  return { subject, text, html: emailShell(body, footer) }
}

// Send the signup welcome. Gated; never throws.
export async function sendWelcomeEmail(to: string | null | undefined): Promise<EmailResult> {
  const { subject, text, html } = renderWelcomeEmail()
  return dispatch({ from: fromAddress(), to, subject, text, html })
}

// Send the free→premium upgrade welcome (Stripe webhook). Gated; never throws.
export async function sendProWelcomeEmail(to: string | null | undefined): Promise<EmailResult> {
  const { subject, text, html } = renderProWelcomeEmail()
  return dispatch({ from: fromAddress(), to, subject, text, html })
}

// Send the subscription-ended note (Stripe webhook). Gated; never throws.
export async function sendCancellationEmail(to: string | null | undefined): Promise<EmailResult> {
  const { subject, text, html } = renderCancellationEmail()
  return dispatch({ from: fromAddress(), to, subject, text, html })
}

// Bounded, never-rejecting await for callers that must not let email delivery
// throw or stall them — the Better Auth signup hook (where a rejection FAILS
// the signup: docs/solutions/2026-07-04-better-auth-after-hooks-propagate-
// errors.md) and the Stripe webhook (where it would delay the 200). dispatch()
// already never rejects; the race just caps a slow provider. Same contract as
// lib/posthog-server.ts#captureServerEvent: never throws, never rejects,
// bounded time.
const BOUNDED_SEND_TIMEOUT_MS = 3000
export async function deliverBounded(
  send: Promise<EmailResult>,
  ms = BOUNDED_SEND_TIMEOUT_MS,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      send.then(
        () => undefined,
        () => undefined,
      ),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms)
      }),
    ])
  } catch {
    // Unreachable — both branches resolve. Belt and braces for the auth hook.
  } finally {
    if (timer) clearTimeout(timer)
  }
}

// The signup hook's welcome send: safe to AWAIT from databaseHooks.user.create
// .after precisely because it carries the never-throws/never-rejects/bounded
// contract above — a Resend outage or slow provider can never fail or hang a
// sign-up.
export async function sendWelcomeEmailFromSignup(email: string | null | undefined): Promise<void> {
  if (typeof email !== 'string' || !email.trim()) return
  try {
    await deliverBounded(sendWelcomeEmail(email))
  } catch {
    // Unreachable; the signup hook must never see a rejection.
  }
}
