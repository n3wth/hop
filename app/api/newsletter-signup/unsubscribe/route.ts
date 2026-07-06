// GET /api/newsletter-signup/unsubscribe?token=... — the one-click footer link
// on every digest email. No login required (that's the point of a token link).
// Deliberately shows the SAME landing page regardless of whether the token
// matched anything — lib/newsletter.ts#unsubscribeNewsletter is silent about
// match/no-match so a stale or guessed link can't be used to probe which
// addresses are subscribed. NEVER throws, NEVER 500s.

import { NextResponse, type NextRequest } from 'next/server'
import { unsubscribeNewsletter } from '@/lib/newsletter'

export const runtime = 'nodejs'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('token') ?? ''
  await unsubscribeNewsletter(token)
  return NextResponse.redirect(new URL('/newsletter/unsubscribed', request.url), 303)
}
