import { auth } from './auth'
import { headers } from 'next/headers'

/**
 * Typesafe server-side session resolver for Better Auth.
 * Returns the logged-in user's ID (user.id) or null if unauthenticated.
 * NEVER throws — graceful fallback.
 */
export async function getUserId(): Promise<string | null> {
  try {
    // Better Auth reads the session cookies directly from the headers
    const session = await auth.api.getSession({
      headers: await headers(),
    })
    return session?.user?.id ?? null
  } catch (error) {
    console.error('[Session] Error resolving Better Auth session:', error)
    return null
  }
}
