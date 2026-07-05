import { createAuthClient } from 'better-auth/react'
import { passkeyClient } from '@better-auth/passkey/client'

/**
 * Typesafe Better Auth client-side SDK.
 * Exposes React hooks and methods (useSession, signIn, signOut) for Client Components.
 * Automatically resolves requests to /api/auth natively.
 */
export const authClient = createAuthClient({
  // baseURL can be omitted when running on the same domain as the Next.js app,
  // which is perfect for preview deploys, local development, and production.
  // passkeyClient adds signIn.passkey/passkey.addPasskey/listUserPasskeys/
  // deletePasskey — harmless to register even when HOP_ENABLE_PASSKEY_AUTH is
  // off server-side, since those calls simply fail closed (server route absent).
  plugins: [passkeyClient()],
})

export const { signIn, signOut, useSession } = authClient
