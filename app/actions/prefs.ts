'use server'

import { auth0 } from '@/lib/auth0'
import { setHomeAirport } from '@/lib/prefs'
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
