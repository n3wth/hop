// Travel-history PERSISTENCE + sync. SERVER ONLY. Owns the write path for the
// Gmail seam: store/clear the connection, run a sync (read confirmation emails →
// parse → store ONLY normalized trip facts), and read connection state. Kept
// separate from lib/travel-history.ts (the read path the agent imports) so Gmail
// network/Buffer code never loads into the hot prompt path. NEVER throws.
//
// PRIVACY: we persist ONLY the parsed PastTrip[] + derived favoriteRegions + the
// refresh token needed to re-read on demand. We never write raw email bodies.

import { withDb } from '@/lib/supabase-helpers'
import {
  listConfirmationMessageIds,
  getMessage,
  refreshAccessToken,
  revokeToken,
  type RawMessage,
} from '@/lib/gmail'
import { parseMessages, deriveFavoriteRegions } from '@/lib/gmail-parser'
import type { PastTrip } from '@/lib/travel-history'

const TABLE = 'hop_travel_history'

// Persist a fresh Gmail connection for this user (refresh token + email), then
// run an initial sync. Returns true on a successful connect (sync failures are
// non-fatal — the row still records the connection). NEVER throws.
export async function connectGmail(
  userId: string,
  refreshToken: string,
  email: string | null,
): Promise<boolean> {
  return withDb(false, async (db) => {
    const now = new Date().toISOString()
    const { error } = await db.from(TABLE).upsert(
      {
        user_id: userId,
        connected: true,
        google_refresh_token: refreshToken,
        google_email: email,
        connected_at: now,
        updated_at: now,
      },
      { onConflict: 'user_id' },
    )
    if (error) return false
    // Initial sync — best effort; don't fail the connect if it errors.
    await syncTravelHistory(userId).catch(() => {})
    return true
  })
}

// Disconnect: revoke the token upstream (best effort) and DELETE the row, which
// removes the stored trips + refresh token. Returns true if the row is gone.
export async function disconnectGmail(userId: string): Promise<boolean> {
  return withDb(false, async (db) => {
    const { data } = await db
      .from(TABLE)
      .select('google_refresh_token')
      .eq('user_id', userId)
      .maybeSingle()
    const token = (data?.google_refresh_token as string | null) ?? null
    if (token) await revokeToken(token)
    const { error } = await db.from(TABLE).delete().eq('user_id', userId)
    return !error
  })
}

// Whether this user has a connected Gmail row (for the /account UI state).
export async function isGmailConnected(
  userId: string,
): Promise<{ connected: boolean; email: string | null }> {
  return withDb<{ connected: boolean; email: string | null }>(
    { connected: false, email: null },
    async (db) => {
      const { data, error } = await db
        .from(TABLE)
        .select('connected, google_email')
        .eq('user_id', userId)
        .maybeSingle()
      if (error || !data || !data.connected) return { connected: false, email: null }
      return { connected: true, email: (data.google_email as string | null) ?? null }
    },
  )
}

// Read the user's confirmation emails and store the normalized trips. Uses the
// stored refresh token to mint an access token, runs the tight query, parses,
// and writes ONLY the trip facts. Returns the count stored, or 0 on any failure.
export async function syncTravelHistory(userId: string): Promise<number> {
  return withDb(0, async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select('google_refresh_token')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data?.google_refresh_token) return 0

    const accessToken = await refreshAccessToken(data.google_refresh_token as string)
    if (!accessToken) return 0

    const ids = await listConfirmationMessageIds(accessToken)
    const messages: RawMessage[] = []
    for (const id of ids) {
      const msg = await getMessage(accessToken, id)
      if (msg) messages.push(msg)
    }

    const trips: PastTrip[] = parseMessages(messages)
    const favoriteRegions = deriveFavoriteRegions(trips)

    const { error: writeErr } = await db
      .from(TABLE)
      .update({
        // Store the facts as a single jsonb object: { trips, favoriteRegions }.
        // No raw email is ever persisted. PastTrip[] is plain JSON-serializable;
        // the jsonb column types as a Json index signature our interface doesn't
        // carry, so we cast through unknown (mirrors lib/prefs.ts).
        trips: JSON.parse(JSON.stringify({ trips, favoriteRegions })),
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
    if (writeErr) return 0
    return trips.length
  })
}
