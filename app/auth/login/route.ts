import { type NextRequest, NextResponse } from 'next/server'

// Compatibility redirect handler for Auth0 -> Better Auth migration.
// Seamlessly routes legacy /auth/login?returnTo=... requests to /login
// with search parameters fully preserved.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const loginUrl = new URL('/login', request.url)
  searchParams.forEach((value, key) => {
    loginUrl.searchParams.set(key, value)
  })
  return NextResponse.redirect(loginUrl, 307)
}
