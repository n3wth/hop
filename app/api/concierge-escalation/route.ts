// POST /api/concierge-escalation — "Request expert booking" (roadmap §6 / N-290),
// Phase 1. Captures a DEMAND-VALIDATION lead: the user asks hop to book a trip for
// them, and we store it for MANUAL follow-up. No automation, no payment.
//
// Auth is OPTIONAL: signed-in requests are tied to the user's Auth0 sub (and we
// prefer their session email); signed-out requests are accepted with a
// caller-supplied email so a visitor on /ask can still raise their hand. Either
// way the request is rate-limited (per-sub when signed in + per-IP always) BEFORE
// any DB work, validated, and persisted via lib/escalation. Returns {ok} JSON and
// NEVER 500s — a failure degrades to { ok:false } so /ask keeps working.

import { after } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { createEscalation, normalizeEmail, type EscalationTrip } from '@/lib/escalation'
import { sendOwnerNotification } from '@/lib/email'

export const runtime = 'nodejs'

// Lead capture is cheap, but it writes a row and is reachable unauthenticated, so
// throttle it. A small burst, then a steady trickle — enough to blunt a scripted
// loop without blocking a real person correcting a typo'd email.
const ESCALATION_RATE = { capacity: 4, refillPerSec: 0.1 } // 4 burst, ~6/min sustained

interface EscalationRequestBody {
  email?: unknown
  trip?: unknown
}

// JSON helper — always 200-class for the success path; failures use a soft 4xx but
// NEVER a 500 (the never-throw contract). Body is always { ok, ... } JSON.
function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export async function POST(request: Request): Promise<Response> {
  let body: EscalationRequestBody
  try {
    body = (await request.json()) as EscalationRequestBody
  } catch {
    return json({ ok: false, error: "Couldn't read your request." }, 400)
  }

  // Identity (Auth0) is OPTIONAL. getSession never throws here; guard anyway so a
  // session hiccup can't 500 the lead. When signed in we tie the row to the sub
  // and prefer the verified session email; otherwise we rely on the typed email.
  let userId: string | undefined
  let sessionEmail: string | undefined
  try {
    const session = await auth0.getSession()
    userId = session?.user?.sub ?? undefined
    sessionEmail = session?.user?.email ?? undefined
  } catch {
    userId = undefined
    sessionEmail = undefined
  }

  // RATE LIMIT before any DB work. Key on the Auth0 sub when signed in (so a user
  // can't bypass by rotating IPs) AND always on IP (so anonymous abuse is capped).
  // Either bucket being empty limits the request — answered with a calm message,
  // never a hard 429 that breaks the /ask surface.
  const ip = clientIp(request)
  const limitKeys = userId ? [`esc:sub:${userId}`, `esc:ip:${ip}`] : [`esc:ip:${ip}`]
  for (const k of limitKeys) {
    if (!(await checkRateLimit(k, ESCALATION_RATE)).ok) {
      return json(
        { ok: false, error: 'One moment — you just sent a request. Try again shortly.' },
        429,
      )
    }
  }

  // Prefer the verified session email; fall back to what the visitor typed. We
  // still validate either way so a junk address never becomes an un-actionable lead.
  const email = normalizeEmail(sessionEmail) ?? normalizeEmail(body?.email)
  if (!email) {
    return json({ ok: false, error: 'Add an email so we can reach you.' }, 400)
  }

  // Free-form trip context — pass it straight through; lib/escalation clamps it
  // (drops non-primitives, trims, caps size). The client sends what /ask knows
  // (the user's note, optionally a route/dates/totalPoints).
  const trip =
    body?.trip && typeof body.trip === 'object' && !Array.isArray(body.trip)
      ? (body.trip as EscalationTrip)
      : undefined

  // Persist (never throws; returns null on unconfigured db or write error).
  const id = await createEscalation({ userId, email, trip })
  if (!id) {
    return json(
      { ok: false, error: "We couldn't log that just now — please try again in a bit." },
      503,
    )
  }

  // Email the owner the new lead AFTER responding — best-effort, never blocks the
  // user's request (gated on Resend; no-ops cleanly when email is unconfigured).
  after(async () => {
    const ctx = Object.entries(trip ?? {})
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}: ${String(v).slice(0, 400)}`)
    const lines = [
      'New "book it for me" request.',
      `Email: ${email}`,
      userId ? `User: ${userId}` : 'User: (signed out)',
      ...(ctx.length ? ['', ...ctx] : []),
    ]
    await sendOwnerNotification(`New expert-booking request from ${email}`, lines.join('\n'))
  })

  return json({ ok: true, id })
}
