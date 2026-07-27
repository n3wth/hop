// POST /api/newsletter-signup — newsletter foundation (R1.6 capture, feeding
// R2.3's weekly digest). Unlike hop_escalations' single-step lead capture,
// this seam eventually SENDS mail to the address, so it's double opt-in: a
// fresh signup gets a confirmation email and isn't a real subscriber (won't
// receive the digest) until GET /api/newsletter-signup/confirm is hit.
//
// GATED as a whole unit behind isNewsletterEnabled() (HOP_ENABLE_NEWSLETTER
// AND RESEND_API_KEY) — until BOTH are set this is a full no-op: no DB write,
// no email, just a generic {ok:true} so the footer form never renders a
// broken state in dev/local or before Oliver flips the feature on.
//
// Auth is OPTIONAL: signed-in submissions are tied to the user's id; signed-out
// submissions are accepted with just the typed email. Either way the request is
// rate-limited per-IP (+ per-user when signed in) BEFORE any DB work, validated,
// and persisted via lib/newsletter. Returns {ok} JSON and NEVER 500s.

import { after } from 'next/server'
import { getUserId } from '@/lib/session'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { createNewsletterSignup, normalizeEmail } from '@/lib/newsletter'
import { sendNewsletterConfirmationEmail } from '@/lib/email'
import { isNewsletterEnabled } from '@/lib/env'
import { SITE_URL } from '@/lib/seo'

export const runtime = 'nodejs'

// Lead capture is cheap, but it writes a row and is reachable unauthenticated, so
// throttle it — same shape as the escalation intake.
const NEWSLETTER_RATE = { capacity: 4, refillPerSec: 0.1 } // 4 burst, ~6/min sustained

interface NewsletterRequestBody {
  email?: unknown
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function confirmUrl(token: string): string {
  return `${SITE_URL}/api/newsletter-signup/confirm?token=${encodeURIComponent(token)}`
}

export async function POST(request: Request): Promise<Response> {
  // Full no-op while the feature is off — no DB write, no email, generic
  // success. Keeps the footer form's UI honest in dev/local (no RESEND_API_KEY)
  // and before the feature is deliberately turned on for real subscribers.
  if (!isNewsletterEnabled()) {
    return json({ ok: true })
  }

  let body: NewsletterRequestBody
  try {
    body = (await request.json()) as NewsletterRequestBody
  } catch {
    return json({ ok: false, error: "Couldn't read your request." }, 400)
  }

  // Identity is OPTIONAL. getUserId never throws; guard anyway so a session
  // hiccup can't 500 the signup.
  let userId: string | undefined
  try {
    userId = (await getUserId()) ?? undefined
  } catch {
    userId = undefined
  }

  // RATE LIMIT before any DB work — same per-user + per-IP shape as the
  // escalation intake.
  const ip = clientIp(request)
  const limitKeys = userId ? [`news:user:${userId}`, `news:ip:${ip}`] : [`news:ip:${ip}`]
  for (const k of limitKeys) {
    if (!(await checkRateLimit(k, NEWSLETTER_RATE)).ok) {
      return json({ ok: false, error: 'One moment — you just submitted. Try again shortly.' }, 429)
    }
  }

  // Validate up front so a malformed address gets an actionable message
  // ("fix your input") rather than the generic degrade message ("try again").
  const email = normalizeEmail(body?.email)
  if (!email) {
    return json({ ok: false, error: 'Add an email to join.' }, 400)
  }

  const result = await createNewsletterSignup({ userId, email })
  if (!result.ok) {
    return json({ ok: false, error: "Couldn't save that just now — try again in a bit." }, 503)
  }

  // Only a genuinely new row gets a confirmation email — a repeat submission
  // of an already-pending/confirmed address is a silent no-op (never resend,
  // never re-notify).
  if (result.isNew) {
    after(async () => {
      await sendNewsletterConfirmationEmail(email, confirmUrl(result.confirmToken))
    })
  }

  return json({ ok: true })
}
