// GET /api/newsletter-signup/confirm?token=... — the double-opt-in landing
// link from the confirmation email. Flips confirm_token -> confirmed_at (the
// row only counts toward R2.3's digest send list once this fires) and lands
// on a plain confirmation page. A GET performing a state change matches the
// existing email-link precedent in this repo (Better Auth's own
// emailVerification callback is GET too) — the action is a single idempotent
// flip, not a destructive operation, and there is no safe alternative for a
// link a user clicks from their inbox.
//
// NEVER throws, NEVER 500s: an invalid/unknown/already-used token still lands
// on a page (the ok=0 variant), never a crash.

import { NextResponse, type NextRequest } from 'next/server'
import { confirmNewsletterSubscriber } from '@/lib/newsletter'

export const runtime = 'nodejs'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('token') ?? ''
  const ok = await confirmNewsletterSubscriber(token)
  const url = new URL('/newsletter/confirmed', request.url)
  if (!ok) url.searchParams.set('ok', '0')
  return NextResponse.redirect(url, 303)
}
