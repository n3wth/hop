import { supabaseAdmin } from '@/utils/supabase/admin'
import { validatePrefs, type TravelPrefs } from '@/lib/prefs-model'

// User preferences (home airport, travel prefs, …) persisted in Supabase via
// the service-role client (server-only). Identity is Auth0, so we scope every
// query by user_id in code. All functions degrade gracefully — never throw to
// the page.

export interface UserPrefs {
  homeAirport?: string
  // Natural-language-derived flight constraints, remembered like home airport.
  travelPrefs?: TravelPrefs
}

const TABLE = 'hop_user_prefs'

export async function getPrefs(userId: string): Promise<UserPrefs> {
  try {
    const db = supabaseAdmin()
    if (!db) return {}
    const { data, error } = await db
      .from(TABLE)
      .select('home_airport, travel_prefs')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return {}
    // Clamp whatever is stored back through validatePrefs — defends against a
    // hand-edited row ever feeding unknown fields into the engine.
    const tp = validatePrefs(data.travel_prefs)
    return {
      homeAirport: (data.home_airport as string) ?? undefined,
      travelPrefs: Object.keys(tp).length > 0 ? tp : undefined,
    }
  } catch {
    return {}
  }
}

// Persist the user's travel prefs (validated/clamped before write). Passing {}
// clears them. Returns false on any failure — never throws.
export async function setTravelPrefs(
  userId: string,
  prefs: TravelPrefs,
): Promise<boolean> {
  try {
    const db = supabaseAdmin()
    if (!db) return false
    const clean = validatePrefs(prefs)
    const { error } = await db.from(TABLE).upsert(
      {
        user_id: userId,
        // TravelPrefs is a plain JSON-serializable object; the jsonb column
        // types as a Json index signature, which our interface doesn't carry.
        travel_prefs: { ...clean },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    return !error
  } catch {
    return false
  }
}

export async function setHomeAirport(userId: string, code: string): Promise<boolean> {
  try {
    const db = supabaseAdmin()
    if (!db) return false
    const { error } = await db.from(TABLE).upsert(
      {
        user_id: userId,
        home_airport: code.toUpperCase(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    return !error
  } catch {
    return false
  }
}
