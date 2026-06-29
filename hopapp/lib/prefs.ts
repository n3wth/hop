import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

// User preferences (home airport, …) persisted in Supabase, keyed by the Auth0
// user id (`sub`). Identity is Auth0, not Supabase Auth, so we scope every query
// by user_id in code. All functions degrade gracefully — a missing table or a
// failed call never throws to the page.

export interface UserPrefs {
  homeAirport?: string
}

const TABLE = 'hop_user_prefs'

export async function getPrefs(userId: string): Promise<UserPrefs> {
  try {
    const supabase = createClient(await cookies())
    const { data, error } = await supabase
      .from(TABLE)
      .select('home_airport')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return {}
    return { homeAirport: data.home_airport ?? undefined }
  } catch {
    return {}
  }
}

export async function setHomeAirport(userId: string, code: string): Promise<boolean> {
  try {
    const supabase = createClient(await cookies())
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        { user_id: userId, home_airport: code.toUpperCase(), updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
    return !error
  } catch {
    return false
  }
}
