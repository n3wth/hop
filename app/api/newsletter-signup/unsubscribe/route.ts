// GET /api/newsletter-signup/unsubscribe?token=... — the one-click footer link
// on every digest email. No login required (that's the point of a token link).
// Deliberately shows the SAME landing page regardless of whether the token
// matched anything — lib/newsletter.ts#unsubscribeNewsletter is silent about
// match/no-match so a stale or guessed link can't be used to probe which
// addresses are subscribed.
//
// Unauthenticated + state-changing, so it's throttled per-IP before any DB
// work — same lib/rate-limit.ts#checkRateLimit shape as POST
// /api/newsletter-signup, for defense-in-depth consistency (token entropy
// already makes brute force infeasible; this just matches house pattern). A
// rate-limited hit still lands on the SAME unsubscribed page (never a bare
// 429) so it can't be used to distinguish "limited" from "matched/unmatched".
//
// NEVER throws, NEVER 500s.

import { NextResponse, type NextRequest } from 'next/server'
import { unsubscribeNewsletter } from '@/lib/newsletter'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// Same shape as the confirm route's throttle — generous for real one-shot
// clicks, capping a scripted loop.
const UNSUBSCRIBE_RATE = { capacity: 10, refillPerSec: 0.2 } // 10 burst, ~12/min sustained

export async function GET(request: NextRequest): Promise<NextResponse> {
  const limited = !(await checkRateLimit(`news:unsub:ip:${clientIp(request)}`, UNSUBSCRIBE_RATE)).ok
  if (!limited) {
    const token = request.nextUrl.searchParams.get('token') ?? ''
    await unsubscribeNewsletter(token)
  }
  return NextResponse.redirect(new URL('/newsletter/unsubscribed', request.url), 303)
}
