import { type NextRequest, NextResponse } from 'next/server'

// Pass-through middleware for Better Auth.
// Refreshes and session validation are handled natively by Better Auth's
// client-side and server-side utilities on actual query boundaries, so no
// middleware-level session refreshing overhead is needed!
export async function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Skip the MCP transport endpoints (api/mcp, api/sse, api/message) and Stripe webhooks
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/mcp|api/sse|api/message|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
