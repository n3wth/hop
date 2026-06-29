// GET /auth/gmail/start — begin the Google OAuth handshake for the travel-history
// seam. The signed-in user explicitly consents to let hop read ONLY their
// travel-confirmation emails (gmail.readonly scope, tight server-side query).
//
// Flow:
//   1. We redirect the user to Google's consent screen with our client_id, the
//      read-only scope, a `state` CSRF nonce, and our callback as redirect_uri.
//   2. The user grants access on Google.
//   3. Google redirects back to /auth/gmail/callback with `code` + `state`, which
//      the callback validates, exchanges for tokens, and persists.
//
// GATED: when the seam is off (env.isGmailHistoryEnabled — flag + Google creds),
// this redirects back to /account with an "unconfigured" flag and the UI keeps
// the "coming soon" affordance. See the final report's dashboard-config note for
// what must be registered in Google Cloud to flip this live.

import { NextResponse, type NextRequest } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { isGmailHistoryEnabled } from '@/lib/env'
import { buildAuthUrl } from '@/lib/gmail'

// Short-lived httpOnly cookie carrying the CSRF nonce we hand to Google and
// re-check on the callback. Tied to this browser session only.
export const GMAIL_STATE_COOKIE = 'gmail_oauth_state'

function base(req: NextRequest): string {
  return process.env.APP_BASE_URL ?? req.nextUrl.origin
}

export async function GET(req: NextRequest) {
  const session = await auth0.getSession()
  if (!session?.user?.sub) {
    return NextResponse.redirect(new URL('/auth/login', base(req)))
  }

  // Seam off (flag/creds missing) → fall back to the "coming soon" state.
  if (!isGmailHistoryEnabled()) {
    const backUrl = new URL('/account', base(req))
    backUrl.searchParams.set('gmail', 'unconfigured')
    return NextResponse.redirect(backUrl)
  }

  const state = crypto.randomUUID()
  const redirectUri = `${base(req)}/auth/gmail/callback`
  const authUrl = buildAuthUrl(redirectUri, state)

  const res = NextResponse.redirect(authUrl)
  res.cookies.set(GMAIL_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  })
  return res
}
