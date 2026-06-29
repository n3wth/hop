// GET / PUT / DELETE /api/profile — the SIGNED-IN user's durable travel profile.
// Lets the user VIEW (GET), EDIT (PUT a whole validated profile), and CLEAR
// (DELETE → PUT {}) the facts the concierge remembers about them. Session-gated
// and scoped to session.user.sub so it can never read or write another user's
// profile. Every write is clamped through validateProfile (server-side), so the
// client can never inject unknown fields or out-of-range values.

import { auth0 } from '@/lib/auth0'
import { getProfile, setProfile } from '@/lib/travel-profile'
import { validateProfile } from '@/lib/travel-profile-model'

export const runtime = 'nodejs'

export async function GET(): Promise<Response> {
  const session = await auth0.getSession()
  const userId = session?.user?.sub
  if (!userId) {
    return Response.json({ ok: false, reason: 'Not signed in' }, { status: 401 })
  }
  const profile = await getProfile(userId)
  return Response.json({ ok: true, profile })
}

export async function PUT(request: Request): Promise<Response> {
  const session = await auth0.getSession()
  const userId = session?.user?.sub
  if (!userId) {
    return Response.json({ ok: false, reason: 'Not signed in' }, { status: 401 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  // Accept either { profile: {...} } or the bare profile object.
  const raw =
    body && typeof body === 'object' && 'profile' in (body as Record<string, unknown>)
      ? (body as Record<string, unknown>).profile
      : body
  const clean = validateProfile(raw)
  const ok = await setProfile(userId, clean)
  return Response.json({ ok, profile: clean })
}

// Clear the profile (forget everything). Implemented as a write of {}.
export async function DELETE(): Promise<Response> {
  const session = await auth0.getSession()
  const userId = session?.user?.sub
  if (!userId) {
    return Response.json({ ok: false, reason: 'Not signed in' }, { status: 401 })
  }
  const ok = await setProfile(userId, {})
  return Response.json({ ok, profile: {} })
}
