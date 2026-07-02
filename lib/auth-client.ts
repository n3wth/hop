import { createAuthClient } from 'better-auth/react'

/**
 * Typesafe Better Auth client-side SDK.
 * Exposes React hooks and methods (useSession, signIn, signOut) for Client Components.
 * Automatically resolves requests to /api/auth natively.
 */
export const authClient = createAuthClient({
  // baseURL can be omitted when running on the same domain as the Next.js app,
  // which is perfect for preview deploys, local development, and production.
})

export const { signIn, signOut, useSession } = authClient
