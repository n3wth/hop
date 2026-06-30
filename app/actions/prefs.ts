'use server'

import { auth0 } from '@/lib/auth0'
import { setHomeAirport } from '@/lib/prefs'
import { getProfile, setProfile } from '@/lib/travel-profile'
import { validateProfile, type AirlineStatus } from '@/lib/travel-profile-model'
import { airportByCode } from '@/lib/airports'

// Server Action: save the signed-in user's home airport. Validates the IATA code
// against the known airport list. Returns a simple result for the client form.
export async function saveHomeAirport(code: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth0.getSession()
  const userId = session?.user?.sub
  if (!userId) return { ok: false, error: 'Not signed in' }

  const c = code.trim().toUpperCase()
  if (!airportByCode(c)) return { ok: false, error: 'Pick an airport from the list' }

  const saved = await setHomeAirport(userId, c)
  return saved ? { ok: true } : { ok: false, error: "Couldn't save — try again" }
}

// Server Action: save the signed-in user's airline/hotel elite statuses into the
// durable travel profile (travel_profile jsonb on hop_user_prefs). The client
// owns the full list, so we REPLACE airlineStatuses wholesale — passing [] clears
// it — while leaving every other profile field untouched. Identity is the Auth0
// sub, so a user can only ever write their own row. validateProfile clamps the
// payload server-side (length/count/shape), and the cleaned list is echoed back
// so the UI reflects any dedupe/trim. Never throws — degrades to an error result.
export async function saveAirlineStatuses(
  statuses: AirlineStatus[],
): Promise<{ ok: boolean; statuses?: AirlineStatus[]; error?: string }> {
  const session = await auth0.getSession()
  const userId = session?.user?.sub
  if (!userId) return { ok: false, error: 'Not signed in' }

  // Clean the incoming rows the same way a stored row is clamped, then splice the
  // result onto the current profile so nothing else the concierge knows is lost.
  const clean = validateProfile({ airlineStatuses: statuses }).airlineStatuses ?? []
  const current = await getProfile(userId)
  const next = validateProfile({ ...current, airlineStatuses: clean })

  const saved = await setProfile(userId, next)
  return saved
    ? { ok: true, statuses: next.airlineStatuses ?? [] }
    : { ok: false, error: "Couldn't save — try again" }
}
