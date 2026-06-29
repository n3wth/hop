import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

// Keeps the Supabase auth session fresh on navigation. Skips static assets.
export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // everything except Next internals, static files, and image optimization
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
