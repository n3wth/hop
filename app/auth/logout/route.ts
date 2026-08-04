import { type NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

// GET /auth/logout — sign out and land on the front door.
//
// Better Auth's own sign-out endpoint is POST-only (origin-checked), so the
// existing anchor links (AccountMenu, /account) hit this route instead: it
// revokes the session server-side via auth.api and the nextCookies plugin
// clears the session cookie on this response. Never throws — a failed
// revocation still redirects home (worst case the cookie expires naturally).
export async function GET(request: NextRequest) {
  try {
    await auth.api.signOut({ headers: await headers() })
  } catch (error) {
    console.error('[auth] sign-out failed:', error)
  }
  return NextResponse.redirect(new URL('/', request.url), 307)
}
