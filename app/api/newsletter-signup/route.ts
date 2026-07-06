// POST /api/newsletter-signup — newsletter lead capture (roadmap R1.6,
// docs/plans/2026-07-02-newsletter-signup.md). Phase 1 only CAPTURES an email;
// no ESP integration, no sends yet.
//
// Auth is OPTIONAL: signed-in submissions are tied to the user's id; signed-out
// submissions are accepted with just the typed email. Either way the request is
// rate-limited per-IP (+ per-user when signed in) BEFORE any DB work, validated,
// and persisted via lib/newsletter. Returns {ok} JSON and NEVER 500s — a failure
// degrades to { ok:false } so the footer form keeps working.

import { after } from 'next/server'
import { getUserId } from '@/lib/session'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { createNewsletterSignup } from '@/lib/newsletter'
import { normalizeEmail } from '@/lib/escalation'
import { sendOwnerNotification } from '@/lib/email'

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

export async function POST(request: Request): Promise<Response> {
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
      return json(
        { ok: false, error: 'One moment — you just submitted. Try again shortly.' },
        429,
      )
    }
  }

  // Validate up front so a malformed address gets an actionable message
  // ("fix your input") rather than the generic degrade message ("try again").
  const email = normalizeEmail(body?.email)?.toLowerCase()
  if (!email) {
    return json({ ok: false, error: 'Add an email to join.' }, 400)
  }

  const result = await createNewsletterSignup({ userId, email })
  if (!result) {
    return json(
      { ok: false, error: "Couldn't save that just now — try again in a bit." },
      503,
    )
  }

  // Best-effort owner ping, after responding — gated on Resend, no-ops cleanly
  // when email is unconfigured. Only a genuinely new row is worth a ping; a
  // repeat submission of an already-captured address is a silent no-op.
  if (result === 'inserted') {
    after(async () => {
      await sendOwnerNotification('New newsletter signup', `Email: ${email}`)
    })
  }

  return json({ ok: true })
}
