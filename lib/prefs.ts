import { withDb } from '@/lib/supabase-helpers'
import { validatePrefs, type TravelPrefs } from '@/lib/prefs-model'

// User preferences (home airport, travel prefs, …) persisted via withDb to
// Neon (lib/supabase-helpers.ts, server-only). Identity is Better Auth's
// user.id, so we scope every query by user_id in code. All functions degrade
// gracefully — never throw to the page.

export interface UserPrefs {
  homeAirport?: string
  // Natural-language-derived flight constraints, remembered like home airport.
  travelPrefs?: TravelPrefs
}

const TABLE = 'hop_user_prefs'

export async function getPrefs(userId: string): Promise<UserPrefs> {
  return withDb({}, async (db) => {
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
  })
}

export async function setHomeAirport(userId: string, code: string): Promise<boolean> {
  return withDb(false, async (db) => {
    const { error } = await db.from(TABLE).upsert(
      {
        user_id: userId,
        home_airport: code.toUpperCase(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    return !error
  })
}

// Unset the saved home airport (e.g. the origin pill's "Clear") without
// touching travel_prefs/travel_profile. A no-op (not an error) when the user
// has no row yet.
export async function clearHomeAirport(userId: string): Promise<boolean> {
  return withDb(false, async (db) => {
    const { error } = await db
      .from(TABLE)
      .update({ home_airport: null, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    return !error
  })
}
