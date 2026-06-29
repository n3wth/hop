import { type NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { updateSession } from '@/utils/supabase/middleware'

// Runs both auth layers on navigation:
//  1. Auth0 — mounts /auth/* routes and refreshes the Auth0 session. Its response
//     forwards to app routes by default, so we return it for /auth/* paths.
//  2. Supabase — refreshes the Supabase session cookie for everything else.
// (Next 16 calls this `proxy` in new projects, but `middleware` still works.)
//
// Both layers are skipped gracefully when their env vars are absent (e.g. preview
// deployments without secrets configured) so the app loads instead of 500ing.
export async function middleware(request: NextRequest) {
  // Auth0 requires AUTH0_DOMAIN at minimum — skip its layer if unconfigured.
  if (process.env.AUTH0_DOMAIN) {
    const authResponse = await auth0.middleware(request)
    if (request.nextUrl.pathname.startsWith('/auth')) {
      return authResponse
    }
  } else if (request.nextUrl.pathname.startsWith('/auth')) {
    return NextResponse.next()
  }

  // Supabase requires the URL — skip its layer if unconfigured.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return await updateSession(request)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Skip the MCP transport endpoints (api/mcp, api/sse, api/message): MCP
    // clients authenticate with a Bearer hop token (lib/api-tokens), not the
    // Auth0/Supabase session cookies this middleware refreshes. Running session
    // middleware there is pointless and could mutate cookies on a stateless,
    // cross-origin transport. All OTHER /api/* routes still pass through.
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/mcp|api/sse|api/message|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
