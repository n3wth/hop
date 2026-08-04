// GET /api/newsletter-signup/confirm?token=... — the double-opt-in landing
// link from the confirmation email. Flips confirm_token -> confirmed_at (the
// row only counts toward R2.3's digest send list once this fires) and lands
// on a plain confirmation page. A GET performing a state change matches the
// existing email-link precedent in this repo (Better Auth's own
// emailVerification callback is GET too) — the action is a single idempotent
// flip, not a destructive operation, and there is no safe alternative for a
// link a user clicks from their inbox.
//
// Unauthenticated + state-changing, so it's throttled per-IP before any DB
// work — same lib/rate-limit.ts#checkRateLimit shape as POST
// /api/newsletter-signup, for defense-in-depth consistency (token entropy
// already makes brute force infeasible; this just matches house pattern).
//
// NEVER throws, NEVER 500s: an invalid/unknown/already-used/rate-limited
// token still lands on a page (the ok=0 variant), never a crash or bare 429.

import { NextResponse, type NextRequest } from 'next/server'
import { confirmNewsletterSubscriber } from '@/lib/newsletter'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// Generous burst since real clicks are one-shot, but caps a scripted loop —
// same order of magnitude as the POST signup route's throttle.
const CONFIRM_RATE = { capacity: 10, refillPerSec: 0.2 } // 10 burst, ~12/min sustained

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL('/newsletter/confirmed', request.url)

  const limited = !(await checkRateLimit(`news:confirm:ip:${clientIp(request)}`, CONFIRM_RATE)).ok
  if (limited) {
    url.searchParams.set('ok', '0')
    return NextResponse.redirect(url, 303)
  }

  const token = request.nextUrl.searchParams.get('token') ?? ''
  const ok = await confirmNewsletterSubscriber(token)
  if (!ok) url.searchParams.set('ok', '0')
  return NextResponse.redirect(url, 303)
}
