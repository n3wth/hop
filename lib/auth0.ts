/* eslint-disable @typescript-eslint/no-explicit-any */
// Auth0 Compatibility Wrapper for Better Auth.
//
// Implements the exact same `auth0.getSession()` interface used across 30+ files
// in the codebase, but resolves sessions using Better Auth under the hood.
// This executes the complete identity cutover (Auth0 -> Better Auth) across
// the entire application with ZERO code changes to those files!

import { unstable_rethrow } from 'next/navigation'
import { auth } from './auth'

export const auth0 = {
  async getSession(): Promise<any> {
    if (process.env.VITEST) return null
    try {
      const { headers } = await import('next/headers')
      const session = await auth.api.getSession({
        headers: await headers(),
      })
      if (!session) return null
      return {
        user: {
          sub: session.user.id,
          email: session.user.email,
          // Better Auth's verified-email bit — lib/owner.ts requires it so the
          // admin gate never rests on an unverified address.
          emailVerified: session.user.emailVerified === true,
          name: session.user.name,
          // Both spellings: Auth0-era call sites read `picture`, Better Auth
          // supplies `image`.
          picture: session.user.image,
          image: session.user.image,
        },
      }
    } catch (error) {
      // Never swallow Next's control-flow errors: during static prerender
      // headers() THROWS (DynamicServerError) to mark the route dynamic —
      // catching it here logged dozens of scary-but-expected build "errors"
      // (one per session-aware page). unstable_rethrow lets Next's own
      // signals (dynamic bailout, redirect, notFound) propagate; everything
      // else is a real session-resolution failure and degrades to signed-out.
      unstable_rethrow(error)
      console.error('[Auth0Compat] Error resolving Better Auth session:', error)
      return null
    }
  },
}
