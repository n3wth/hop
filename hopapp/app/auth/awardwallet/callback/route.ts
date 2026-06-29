// GET /auth/awardwallet/callback — AwardWallet returns the user here after they
// grant our business account access. We validate the CSRF state, read the
// connectedUser id, persist it for this Auth0 user, and return to /account.
//
// Return params (per AwardWallet's Account Access model): the connectedUser id
// plus the `state` we sent. The PUBLIC API reference does not pin the exact
// param name, so we read the common candidates (userId / connectedUserId / id).
// Confirm the real name against the business dashboard before going live.

import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { setUserAwId } from '@/lib/accounts'
import { STATE_COOKIE, stateCookieValue } from '../start/route'

// Constant-time string compare that never throws on length mismatch.
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

function base(req: NextRequest): string {
  return process.env.APP_BASE_URL ?? req.nextUrl.origin
}

// Redirect back to /account with an outcome flag, always clearing the nonce.
function backToAccount(req: NextRequest, flag: string): NextResponse {
  const url = new URL('/account', base(req))
  url.searchParams.set('aw', flag)
  const res = NextResponse.redirect(url)
  res.cookies.delete(STATE_COOKIE)
  return res
}

export async function GET(req: NextRequest) {
  const session = await auth0.getSession()
  const userId = session?.user?.sub
  if (!userId) {
    return NextResponse.redirect(new URL('/auth/login', base(req)))
  }

  // The cookie binds the nonce to the user who STARTED the flow:
  // `state.hmac(state|userId)`. Recompute the expected cookie value against the
  // returned state AND the CURRENT session sub; require an exact, constant-time
  // match. This rejects a captured callback replayed into a different session
  // (the attacker's tag was bound to their sub, not the victim's).
  const cookie = req.cookies.get(STATE_COOKIE)?.value
  const q = req.nextUrl.searchParams
  const state = q.get('state')
  if (!cookie || !state || !safeEqual(cookie, stateCookieValue(state, userId))) {
    return backToAccount(req, 'state')
  }

  if (q.get('error')) {
    return backToAccount(req, 'denied')
  }

  // The connectedUser id under any of the plausible param names AwardWallet uses.
  const awUserId =
    q.get('userId') ??
    q.get('connectedUserId') ??
    q.get('connectedUser') ??
    q.get('id')
  if (!awUserId || awUserId.trim() === '') {
    return backToAccount(req, 'noid')
  }

  const saved = await setUserAwId(userId, awUserId.trim())
  return backToAccount(req, saved ? 'connected' : 'error')
}
