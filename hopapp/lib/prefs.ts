import { supabaseAdmin } from '@/utils/supabase/admin'

// User preferences (home airport, …) persisted in Supabase via the service-role
// client (server-only). Identity is Auth0, so we scope every query by user_id in
// code. All functions degrade gracefully — never throw to the page.

export interface UserPrefs {
  homeAirport?: string
}

const TABLE = 'hop_user_prefs'

export async function getPrefs(userId: string): Promise<UserPrefs> {
  try {
    const db = supabaseAdmin()
    if (!db) return {}
    const { data, error } = await db
      .from(TABLE)
      .select('home_airport')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return {}
    return { homeAirport: (data.home_airport as string) ?? undefined }
  } catch {
    return {}
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
