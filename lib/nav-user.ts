// The header/account-menu user object, built one way for every page. Adds a
// Gravatar fallback so email/password accounts (no IdP picture) still get an
// avatar when they have one: SHA-256 of the normalized address per Gravatar's
// current docs, with d=404 so "no gravatar" 404s and AccountMenu's onError
// path falls back to the initial — never a stock mystery-person image.

import { createHash } from 'node:crypto'

export interface NavUser {
  /** Opaque Better Auth user.id — used only to identify analytics (R0.5). */
  id?: string
  initial: string
  name?: string
  email?: string
  picture?: string
}

export function gravatarUrl(email: string, size = 160): string {
  const hash = createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
  return `https://gravatar.com/avatar/${hash}?s=${size}&d=404`
}

interface SessionUserLike {
  /** Better Auth user.id — the lib/auth0.ts shim exposes it as `sub`. */
  sub?: string | null
  name?: string | null
  email?: string | null
  picture?: string | null
}

// Session user → header user. Null in, null out (signed-out pages pass through).
// The IdP picture (Google) wins; Gravatar fills in for accounts without one.
export function toNavUser(su: SessionUserLike | null | undefined): NavUser | null {
  if (!su) return null
  const email = su.email ?? undefined
  return {
    id: su.sub ?? undefined,
    initial: (su.name ?? su.email ?? 'U').trim().charAt(0).toUpperCase(),
    name: su.name ?? email ?? undefined,
    email,
    picture: su.picture ?? (email ? gravatarUrl(email) : undefined),
  }
}
