// GET /auth/awardwallet/start — begin the AwardWallet "Connect Users" handshake.
//
// Flow (per AwardWallet's Account Access model, https://awardwallet.com/api/account):
//   1. We redirect the signed-in user to our business account's hosted connect
//      URL with a `state` nonce and our `redirect_uri` (the callback below).
//   2. The user logs into THEIR OWN AwardWallet and grants our business account
//      access, choosing what to share.
//   3. AwardWallet redirects back to our callback with the connectedUser id and
//      our `state`, which the callback validates and persists.
//
// IMPORTANT — config required to flip this live (see final report):
//   - AWARDWALLET_CONNECT_URL must be set to the hosted authorization URL from
//     the AwardWallet business dashboard (Profile → API / Connect Users). The
//     PUBLIC API reference does not document this URL or its exact param names;
//     the connect URL + the redirect-URI allow-list are configured in the
//     business account settings, which need dashboard access we don't have here.
//   - Our callback URL ({APP_BASE_URL}/auth/awardwallet/callback) must be
//     registered as an allowed redirect URI in that dashboard.
// Until AWARDWALLET_CONNECT_URL is set, this route redirects back to /account
// with an error flag and the UI keeps manual entry as the primary path.

import { NextResponse, type NextRequest } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { hasEnv, env } from '@/lib/env'

// Short-lived httpOnly cookie carrying the CSRF nonce we hand to AwardWallet and
// re-check on the callback. Tied to this browser session only.
export const STATE_COOKIE = 'aw_oauth_state'

function base(req: NextRequest): string {
  return process.env.APP_BASE_URL ?? req.nextUrl.origin
}

export async function GET(req: NextRequest) {
  const session = await auth0.getSession()
  if (!session?.user?.sub) {
    return NextResponse.redirect(new URL('/auth/login', base(req)))
  }

  // No hosted connect URL configured yet → fall back to manual entry (the
  // primary path) and tell /account why auto-sync is unavailable.
  if (!hasEnv('AWARDWALLET_CONNECT_URL')) {
    const back = new URL('/account', base(req))
    back.searchParams.set('aw', 'unconfigured')
    return NextResponse.redirect(back)
  }

  // CSRF nonce — random, opaque, validated on return. Web Crypto (edge-safe).
  const state = crypto.randomUUID()
  const redirectUri = `${base(req)}/auth/awardwallet/callback`

  // Build the authorization redirect. Param names follow the common OAuth-style
  // shape AwardWallet's hosted connect uses; confirm exact names against the
  // business dashboard's Connect-Users settings before going live.
  const authUrl = new URL(env.awardWalletConnectUrl())
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', state)

  // Set the nonce cookie directly on the redirect response (reliable in route
  // handlers, unlike mutating the cookies() store alongside a redirect).
  const res = NextResponse.redirect(authUrl)
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  })
  return res
}
