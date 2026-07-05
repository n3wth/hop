// Owner gate — the single check behind the internal /admin surfaces (support
// console + reply send). hop has no team/role model yet, so "owner" is simply the
// signed-in user whose Auth0 email matches HOP_OWNER_EMAIL (defaults to the
// founder inbox — the same address that receives ticket/lead notifications).
//
// Email comes from the IdP after authentication AND must be verified — today
// every session email is transitively verified (Google-only social login;
// the flag-gated email/password path requires verification), but the explicit
// emailVerified check means one added provider or config flip can never turn
// an unverified address into /admin access. Good enough to gate an internal
// tool; a real role model can replace this later. NEVER throws.

import { auth0 } from '@/lib/auth0'

function ownerEmail(): string {
  const a = process.env.HOP_OWNER_EMAIL
  return (a && a.trim() ? a.trim() : 'oliver@newth.ai').toLowerCase()
}

// The owner's session, or null when the visitor isn't signed in as the owner.
// Used by /admin pages (notFound on null) + the admin send route (403 on null).
export async function getOwnerSession(): Promise<{ email: string; sub: string } | null> {
  try {
    const session = await auth0.getSession()
    const email = session?.user?.email
    const sub = session?.user?.sub
    if (
      typeof email === 'string' &&
      typeof sub === 'string' &&
      session?.user?.emailVerified === true &&
      email.trim().toLowerCase() === ownerEmail()
    ) {
      return { email: email.trim(), sub }
    }
  } catch {
    // no/garbled session — not the owner
  }
  return null
}

export async function isOwner(): Promise<boolean> {
  return (await getOwnerSession()) !== null
}
