/* eslint-disable @typescript-eslint/no-explicit-any */
// Auth0 Compatibility Wrapper for Better Auth.
//
// Implements the exact same `auth0.getSession()` interface used across 30+ files
// in the codebase, but resolves sessions using Better Auth under the hood.
// This executes the complete identity cutover (Auth0 -> Better Auth) across
// the entire application with ZERO code changes to those files!

import { auth } from './auth'
import { headers } from 'next/headers'

export const auth0 = {
  async getSession(): Promise<any> {
    if (process.env.VITEST) return null // Silence Next.js headers() warnings during vitest runs
    try {
      const session = await auth.api.getSession({
        headers: await headers(),
      })
      if (!session) return null
      return {
        user: {
          sub: session.user.id,
          email: session.user.email,
          name: session.user.name,
          image: session.user.image,
        },
      }
    } catch (error) {
      console.error('[Auth0Compat] Error resolving Better Auth session:', error)
      return null
    }
  },
}
