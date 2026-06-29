import { type NextRequest } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { updateSession } from '@/utils/supabase/middleware'

// Runs both auth layers on navigation:
//  1. Auth0 — mounts /auth/* routes and refreshes the Auth0 session. Its response
//     forwards to app routes by default, so we return it for /auth/* paths.
//  2. Supabase — refreshes the Supabase session cookie for everything else.
// (Next 16 calls this `proxy` in new projects, but `middleware` still works.)
export async function middleware(request: NextRequest) {
  const authResponse = await auth0.middleware(request)

  // Auth0 owns the /auth/* routes — return its response untouched there.
  if (request.nextUrl.pathname.startsWith('/auth')) {
    return authResponse
  }

  // For all other routes, refresh the Supabase session too.
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
