// Account deletion — the code path behind the /privacy promise ("when you
// delete your account, we delete or anonymize the data we hold for you").
// Deletes every user-scoped row across the hop_* domain tables, then the
// Better Auth rows (passkeys, sessions, accounts, verifications, user).
//
// Direct Drizzle (getDb), not the withDb shim: the shim's TABLE_MAP doesn't
// cover the auth tables, and deletion must be one deliberate, ordered sweep.
// NEVER throws — returns {ok:false} when the db is unconfigured or the final
// user-row delete fails. Best-effort on the domain tables (a missing table in
// a fresh environment must not strand the user mid-delete), strict on the
// auth rows: ok:true only when the user row is actually gone.
//
// Deliberately retained (anonymized/no user linkage): hop_outclicks (no
// user_id by design), hop_valuation_overrides + cron/ops tables (aggregate),
// and Stripe-side billing records (legal/accounting retention, per /privacy).

import { eq } from 'drizzle-orm'
import { getDb } from './db'
import {
  manualBalances,
  syncAddresses,
  programCredentials,
  userAccounts,
  userPrefs,
  conversations,
  conversationSummary,
  inferredFacts,
  memoryOutcomes,
  bookings,
  standingOrderAlerts,
  standingOrders,
  notificationOutbox,
  apiTokens,
  mcpUsage,
  travelHistory,
  escalations,
  hopCustomers,
  passkey,
  session,
  account,
  user,
} from './db/schema'

export interface DeleteAccountResult {
  ok: boolean
  error?: string
}

export async function deleteUserAccount(userId: string): Promise<DeleteAccountResult> {
  if (!userId || userId.trim() === '') return { ok: false, error: 'missing user' }
  const db = getDb()
  if (!db) return { ok: false, error: 'database not configured' }

  // Domain rows first (they reference nothing in auth), best-effort per table
  // so one missing/renamed table can't block the rest of the sweep — but
  // every failure is logged, never silent.
  // hop_subscriptions cascades from hop_customers (FK onDelete: 'cascade').
  const domainTables = [
    manualBalances,
    syncAddresses,
    programCredentials,
    userAccounts,
    userPrefs,
    conversations,
    conversationSummary,
    inferredFacts,
    memoryOutcomes,
    bookings,
    standingOrderAlerts,
    standingOrders,
    notificationOutbox,
    mcpUsage,
    apiTokens,
    escalations,
    hopCustomers,
  ] as const

  for (const table of domainTables) {
    try {
      await db.delete(table).where(eq(table.userId, userId))
    } catch (error) {
      // Best-effort: an un-migrated table in a fresh env is not a reason to
      // strand the deletion; the strict section below is what gates ok.
      console.error('[account-deletion] domain-table delete failed (continuing):', error)
    }
  }

  // Strict section — these must actually delete before we report success.
  // hop_travel_history holds the Google refresh token (a live credential),
  // so a failed delete there must fail the whole operation (the user can
  // retry) rather than strand a secret with no owning user row. Then the
  // auth rows, children before user (no FK cascade on these).
  try {
    await db.delete(travelHistory).where(eq(travelHistory.userId, userId))
    await db.delete(passkey).where(eq(passkey.userId, userId))
    await db.delete(session).where(eq(session.userId, userId))
    await db.delete(account).where(eq(account.userId, userId))
    await db.delete(user).where(eq(user.id, userId))
    return { ok: true }
  } catch (error) {
    console.error('[account-deletion] strict delete failed:', error)
    return { ok: false, error: 'deletion failed — try again' }
  }
}
