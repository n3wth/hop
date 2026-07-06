// Travel-history PERSISTENCE + sync. SERVER ONLY. Owns the write path for the
// Gmail seam: store/clear the connection, run a sync (read confirmation emails →
// parse → store ONLY normalized trip facts), and read connection state. Kept
// separate from lib/travel-history.ts (the read path the agent imports) so Gmail
// network/Buffer code never loads into the hot prompt path. NEVER throws.
//
// PRIVACY: we persist ONLY the parsed PastTrip[] + derived favoriteRegions + the
// refresh token needed to re-read on demand. We never write raw email bodies.
//
// STALENESS: a dead/revoked refresh token (or a failed Gmail list call) used to
// be indistinguishable from "0 trips found" — the row still read `connected:
// true` forever with a frozen trip list. We now stamp `syncFailedAt` INSIDE the
// existing `trips` jsonb payload (`{ trips, favoriteRegions, syncFailedAt }`) on
// any failed sync — no schema migration needed — and clear it on the next
// success. isGmailConnected() surfaces it as `syncFailed` for the /account UI.

import { withDb, type Db } from '@/lib/supabase-helpers'
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

// The jsonb shape stored in the `trips` column.
interface StoredTrips {
  trips?: unknown
  favoriteRegions?: unknown
  syncFailedAt?: string | null
}

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
    // Initial sync — best effort; don't fail the connect if it errors (the
    // resulting syncFailedAt is what the /account UI reads to prompt reconnect).
    await syncTravelHistory(userId)
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
// `syncFailed` surfaces a dead/revoked refresh token (or a failed list call)
// instead of asserting "Connected" forever with a frozen trip list.
export async function isGmailConnected(
  userId: string,
): Promise<{ connected: boolean; email: string | null; syncFailed: boolean }> {
  return withDb<{ connected: boolean; email: string | null; syncFailed: boolean }>(
    { connected: false, email: null, syncFailed: false },
    async (db) => {
      const { data, error } = await db
        .from(TABLE)
        .select('connected, google_email, trips')
        .eq('user_id', userId)
        .maybeSingle()
      if (error || !data || !data.connected) return { connected: false, email: null, syncFailed: false }
      const stored = (data.trips ?? {}) as StoredTrips
      return {
        connected: true,
        email: (data.google_email as string | null) ?? null,
        syncFailed: typeof stored.syncFailedAt === 'string' && stored.syncFailedAt.length > 0,
      }
    },
  )
}

// Stamp the failure onto the existing jsonb payload WITHOUT touching the
// previously-synced trips/favoriteRegions — a failed sync must never wipe a
// user's history with an empty result.
async function markSyncFailed(db: Db, userId: string, storedTrips: unknown): Promise<void> {
  const prior = (storedTrips ?? {}) as StoredTrips
  await db
    .from(TABLE)
    .update({
      trips: JSON.parse(
        JSON.stringify({
          trips: prior.trips ?? [],
          favoriteRegions: prior.favoriteRegions ?? [],
          syncFailedAt: new Date().toISOString(),
        }),
      ),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
}

// Distinguishable failure reasons so callers (the resync server action) can
// tell the user something useful instead of a generic error.
export type SyncResult =
  | { ok: true; count: number }
  | { ok: false; reason: 'not-connected' | 'auth-failed' | 'fetch-failed' | 'db-error' }

// Read the user's confirmation emails and store the normalized trips. Uses the
// stored refresh token to mint an access token, runs the tight query, parses,
// and writes ONLY the trip facts. NEVER throws; failures are distinguishable
// (see SyncResult) instead of collapsing to a bare 0.
export async function syncTravelHistory(userId: string): Promise<SyncResult> {
  return withDb<SyncResult>({ ok: false, reason: 'db-error' }, async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select('google_refresh_token, trips')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data?.google_refresh_token) return { ok: false, reason: 'not-connected' }

    const accessToken = await refreshAccessToken(data.google_refresh_token as string)
    if (!accessToken) {
      // Refresh token is dead/revoked/expired — the defining "silent staleness"
      // case this fixes. Preserve the existing trips, just flag the failure.
      await markSyncFailed(db, userId, data.trips)
      return { ok: false, reason: 'auth-failed' }
    }

    const listResult = await listConfirmationMessageIds(accessToken)
    if (!listResult.ok) {
      await markSyncFailed(db, userId, data.trips)
      return { ok: false, reason: listResult.authFailed ? 'auth-failed' : 'fetch-failed' }
    }

    const messages: RawMessage[] = []
    for (const id of listResult.ids) {
      const msg = await getMessage(accessToken, id)
      if (msg) messages.push(msg)
    }

    const trips: PastTrip[] = parseMessages(messages)
    const favoriteRegions = deriveFavoriteRegions(trips)

    const { error: writeErr } = await db
      .from(TABLE)
      .update({
        // Store the facts as a single jsonb object: { trips, favoriteRegions,
        // syncFailedAt }. No raw email is ever persisted. PastTrip[] is plain
        // JSON-serializable; the jsonb column types as a Json index signature
        // our interface doesn't carry, so we cast through unknown (mirrors
        // lib/prefs.ts). A successful sync always clears any prior failure.
        trips: JSON.parse(JSON.stringify({ trips, favoriteRegions, syncFailedAt: null })),
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
    if (writeErr) return { ok: false, reason: 'db-error' }
    return { ok: true, count: trips.length }
  })
}
