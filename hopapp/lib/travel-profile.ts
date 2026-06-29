// Persistence for the user's DURABLE personal travel profile, stored as a
// travel_profile jsonb column on hop_user_prefs (same row/identity as home
// airport + travel prefs). Service-role client, server-only; identity is Auth0,
// so we scope every query by user_id in code. All functions degrade gracefully
// — they NEVER throw to the page.
//
// SQL (run manually — this code does NOT run DDL):
//
//   ALTER TABLE public.hop_user_prefs
//     ADD COLUMN IF NOT EXISTS travel_profile jsonb;
//
// RLS already protects hop_user_prefs (service-role bypasses it; we scope in
// code). No new policy is needed for the added column.

import { supabaseAdmin } from '@/utils/supabase/admin'
import {
  validateProfile,
  mergeProfile,
  isEmptyProfile,
  type TravelProfile,
} from '@/lib/travel-profile-model'

const TABLE = 'hop_user_prefs'

// Read the user's profile, clamped back through validateProfile so a hand-edited
// row can never feed unknown fields into the prompt. Returns {} when there's no
// row, no client, or any error.
export async function getProfile(userId: string): Promise<TravelProfile> {
  try {
    const db = supabaseAdmin()
    if (!db) return {}
    const { data, error } = await db
      .from(TABLE)
      .select('travel_profile')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return {}
    return validateProfile(data.travel_profile)
  } catch {
    return {}
  }
}

// Overwrite the profile wholesale (validated/clamped first). Passing {} clears
// it. Used by the "edit / clear" affordance. Returns false on any failure.
export async function setProfile(userId: string, profile: TravelProfile): Promise<boolean> {
  try {
    const db = supabaseAdmin()
    if (!db) return false
    const clean = validateProfile(profile)
    const { error } = await db.from(TABLE).upsert(
      {
        user_id: userId,
        travel_profile: { ...clean },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    return !error
  } catch {
    return false
  }
}

// Merge a PATCH of new facts onto the stored profile (scalars overwrite, lists
// union — see mergeProfile). This is what the save_profile_fact tool calls.
// Returns the resulting, validated profile so the caller can echo it back; on
// failure returns the pre-merge profile (best effort, never throws).
export async function saveProfileFact(
  userId: string,
  patch: TravelProfile,
): Promise<TravelProfile> {
  const clean = validateProfile(patch)
  // Nothing actionable → no write, return whatever's stored.
  if (isEmptyProfile(clean)) return getProfile(userId)
  const current = await getProfile(userId)
  const merged = mergeProfile(current, clean)
  const ok = await setProfile(userId, merged)
  return ok ? merged : current
}
