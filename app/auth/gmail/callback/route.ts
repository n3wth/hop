// GET /auth/gmail/callback — Google returns the user here after they grant (or
// deny) read-only Gmail access. We validate the CSRF state, exchange the code for
// tokens, persist the connection (refresh token + email), kick off an initial
// sync of confirmation emails into normalized trips, and return to /account.
//
// PRIVACY: only the refresh token + the connected email + parsed trip facts are
// stored (connectGmail → syncTravelHistory). No raw email is ever persisted.

import { NextResponse, type NextRequest } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { isGmailHistoryEnabled } from '@/lib/env'
import { exchangeCodeForTokens, getProfileEmail } from '@/lib/gmail'
import { connectGmail } from '@/lib/travel-history-sync'
import { GMAIL_STATE_COOKIE } from '../start/route'

function base(req: NextRequest): string {
  return process.env.APP_BASE_URL ?? req.nextUrl.origin
}

// Redirect back to /account with an outcome flag, always clearing the nonce.
function backToAccount(req: NextRequest, flag: string): NextResponse {
  const url = new URL('/account', base(req))
  url.searchParams.set('gmail', flag)
  const res = NextResponse.redirect(url)
  res.cookies.delete(GMAIL_STATE_COOKIE)
  return res
}

export async function GET(req: NextRequest) {
  const session = await auth0.getSession()
  const userId = session?.user?.sub
  if (!userId) {
    return NextResponse.redirect(new URL('/auth/login', base(req)))
  }

  if (!isGmailHistoryEnabled()) {
    return backToAccount(req, 'unconfigured')
  }

  const expected = req.cookies.get(GMAIL_STATE_COOKIE)?.value
  const q = req.nextUrl.searchParams
  const state = q.get('state')
  if (!expected || !state || state !== expected) {
    return backToAccount(req, 'state')
  }

  if (q.get('error')) {
    return backToAccount(req, 'denied')
  }

  const code = q.get('code')
  if (!code) {
    return backToAccount(req, 'denied')
  }

  const redirectUri = `${base(req)}/auth/gmail/callback`
  const tokens = await exchangeCodeForTokens(code, redirectUri)
  // We require a refresh token (access_type=offline + prompt=consent guarantees
  // one on first grant). Without it we can't re-read on demand.
  if (!tokens?.refreshToken) {
    return backToAccount(req, 'error')
  }

  const email = await getProfileEmail(tokens.accessToken)
  const ok = await connectGmail(userId, tokens.refreshToken, email)
  return backToAccount(req, ok ? 'connected' : 'error')
}
