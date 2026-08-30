/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Balance } from '@/lib/types'
import { deriveCode, getBalances } from '@/lib/awardwallet'
import { canonicalizeProgram, programById } from '@/lib/programs'
import { withDb } from '@/lib/supabase-helpers'

// Per-user balance sources persisted via withDb to Neon (lib/supabase-helpers.ts,
// server-only). Identity is Better Auth's user.id, so we scope every query by
// user_id in code. All functions degrade gracefully — never throw to the page.
//
// Two sources:
//   - hop_manual_balances: programs the user typed in by hand (PRIMARY path).
//   - hop_user_accounts: an optional AwardWallet link for live auto-sync.
// getUserBalances() merges both into the shared Balance model so every caller
// (home, deals, ask, search) consumes one list.

const TABLE = 'hop_user_accounts'
const MANUAL_TABLE = 'hop_manual_balances'

// A manual program row, with its db id so the UI can edit/remove it. Extends the
// shared Balance contract so it renders identically to a synced balance.
export interface ManualBalance extends Balance {
  id: string
}

// The AwardWallet connected-user id this user linked, or null if not connected.
export async function getUserAwId(userId: string): Promise<string | null> {
  return withDb<string | null>(null, async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select('aw_user_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return null
    return (data.aw_user_id as string) ?? null
  })
}

export async function setUserAwId(userId: string, awUserId: string): Promise<boolean> {
  return withDb(false, async (db) => {
    const now = new Date().toISOString()
    const { error } = await db.from(TABLE).upsert(
      {
        user_id: userId,
        aw_user_id: awUserId,
        connected_at: now,
        updated_at: now,
      },
      { onConflict: 'user_id' },
    )
    return !error
  })
}

export async function clearUserAwId(userId: string): Promise<boolean> {
  return withDb(false, async (db) => {
    const { error } = await db.from(TABLE).delete().eq('user_id', userId)
    return !error
  })
}

// --- AwardWallet balance cache ----------------------------------------------
// getUserBalances() reads THIS cache instead of calling AwardWallet live on
// every request (home/deals/ask/search/account). refreshAwCache is the only
// place that makes the live call: at connect-time (bootstrap), on a
// user-initiated Refresh, and from the periodic cron
// (app/api/cron/awardwallet-sync). See docs/ops-runbook.md's AwardWallet
// section for the flip-live steps.

export interface CachedAwBalances {
  balances: Balance[]
  syncedAt: string | null
  ok: boolean
}

const EMPTY_CACHE: CachedAwBalances = { balances: [], syncedAt: null, ok: false }

// This user's last-synced AwardWallet snapshot. Never live — a pure cache
// read. Empty/absent (no row, no link, pre-migration null cache) all read
// identically: no cached balances, fall back to manual-only upstream.
export async function getCachedAwBalances(userId: string): Promise<CachedAwBalances> {
  return withDb<CachedAwBalances>(EMPTY_CACHE, async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select('cached_balances, last_synced_at, last_sync_ok')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return EMPTY_CACHE
    const balances = Array.isArray(data.cached_balances) ? (data.cached_balances as Balance[]) : []
    return {
      balances,
      syncedAt: (data.last_synced_at as string | null) ?? null,
      ok: Boolean(data.last_sync_ok),
    }
  })
}

// Pull a fresh live snapshot from AwardWallet and persist it as this user's
// cache. Called from bootstrap (connect), the manual Refresh action, and the
// periodic cron — never from a page render. On failure, the write omits
// cached_balances entirely so a bad pull can never clobber a good prior
// snapshot; only last_synced_at/last_sync_ok are stamped, so staleness is
// still honestly surfaced. Never throws; returns whether the LIVE pull AND
// the cache write both succeeded — a persisted-but-unread write is as good
// as no refresh at all, so callers (cron heartbeat, Refresh button) must not
// see it as a clean success.
export async function refreshAwCache(userId: string, awUserId: string): Promise<boolean> {
  const res = await getBalances(awUserId).catch(() => ({ ok: false as const, reason: 'request failed' }))
  const now = new Date().toISOString()
  const wrote = await withDb(false, async (db) => {
    const patch: Record<string, unknown> = {
      user_id: userId,
      last_synced_at: now,
      last_sync_ok: res.ok,
    }
    if (res.ok) patch.cached_balances = res.data
    const { error } = await db.from(TABLE).upsert(patch, { onConflict: 'user_id' })
    return !error
  })
  if (res.ok && !wrote) {
    console.error(`refreshAwCache: live pull ok but cache write failed for user ${userId}`)
  }
  return res.ok && wrote
}

// Every user with an AwardWallet link, for the periodic cron to iterate. The
// Postgrest-compat shim has no "is not null" filter, so we read every row and
// filter in JS rather than risk a filter that silently matches nothing (or
// everything). Empty on any failure — the cron just processes nobody that tick.
export async function listConnectedAwUsers(): Promise<Array<{ userId: string; awUserId: string }>> {
  return withDb<Array<{ userId: string; awUserId: string }>>([], async (db) => {
    const { data, error } = await db.from(TABLE).select('user_id, aw_user_id')
    if (error || !data) return []
    return (data as Array<{ user_id: string; aw_user_id: string | null }>)
      .filter((r) => typeof r.aw_user_id === 'string' && r.aw_user_id.trim() !== '')
      .map((r) => ({ userId: r.user_id, awUserId: r.aw_user_id as string }))
  })
}

// --- Manual balances (primary path) ----------------------------------------

// This user's hand-entered programs, newest-updated first. Empty on any failure.
export async function getManualBalances(userId: string): Promise<ManualBalance[]> {
  return withDb<ManualBalance[]>([], async (db) => {
    const { data, error } = await db
      .from(MANUAL_TABLE)
      .select('id, program, code, balance, kind, updated_at')
      .eq('user_id', userId)
      .order('balance', { ascending: false })
    if (error || !data) return []
    return data.map((r: any) => ({
      id: r.id as string,
      program: r.program as string,
      // code may be null in db; derive a monogram so the brand chip always renders.
      code: (r.code as string | null) ?? deriveCode(r.program as string),
      balance: Number(r.balance ?? 0),
      status: (r.kind as string | null) ?? undefined,
    }))
  })
}

// Pure matcher shared by findManualByProgram (single lookup) and
// seedQuickStartPrograms (checks all 5 against one already-fetched list) so
// both apply IDENTICAL dedupe semantics: same canonical identity as `program`
// (so "amex" and "Membership Rewards" collide on amex-mr), falling back to a
// normalized exact-name match when the input doesn't canonicalize.
function matchManualByProgram(rows: ManualBalance[], program: string): ManualBalance | null {
  const target = canonicalizeProgram(program)
  if (target) {
    return rows.find((r) => canonicalizeProgram(r.program)?.id === target.id) ?? null
  }
  // No canonical match — compare on a loose normalized name so an exact retype
  // of an unknown program still dedupes.
  const norm = program.trim().toLowerCase()
  return rows.find((r) => r.program.trim().toLowerCase() === norm) ?? null
}

// Find an existing manual program that resolves to the SAME canonical identity
// as `program`. Returns the matching row, or null if the user has no
// equivalent program yet.
export async function findManualByProgram(
  userId: string,
  program: string,
): Promise<ManualBalance | null> {
  const rows = await getManualBalances(userId)
  return matchManualByProgram(rows, program)
}

// Add a program. Code is derived from the name when not supplied. Returns the
// new row id, or null on failure.
export async function addManualBalance(
  userId: string,
  program: string,
  balance: number,
  kind?: string,
): Promise<string | null> {
  return withDb<string | null>(null, async (db) => {
    const { data, error } = await db
      .from(MANUAL_TABLE)
      .insert({
        user_id: userId,
        program,
        code: deriveCode(program),
        balance,
        kind: kind ?? null,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle()
    if (error || !data) return null
    return (data.id as string) ?? null
  })
}

// Update a program the user owns. Scoped by BOTH id and user_id so one user can
// never edit another's row. Re-derives the code when the name changes.
export async function updateManualBalance(
  userId: string,
  id: string,
  fields: { program?: string; balance?: number; kind?: string },
): Promise<boolean> {
  return withDb(false, async (db) => {
    const patch: { program?: string; code?: string; balance?: number; kind?: string; updated_at: string } = {
      updated_at: new Date().toISOString(),
    }
    if (fields.program != null) {
      patch.program = fields.program
      patch.code = deriveCode(fields.program)
    }
    if (fields.balance != null) patch.balance = fields.balance
    if (fields.kind != null) patch.kind = fields.kind
    const { error } = await db
      .from(MANUAL_TABLE)
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)
    return !error
  })
}

// Remove a program the user owns. Scoped by id AND user_id.
export async function removeManualBalance(userId: string, id: string): Promise<boolean> {
  return withDb(false, async (db) => {
    const { error } = await db
      .from(MANUAL_TABLE)
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    return !error
  })
}

// The five transferable bank currencies (R1.4 "add the 5 majors" quick-start) —
// the highest-reach starting point for a new user, and the same five that head
// lib/valuations.ts' BASELINE_CPP table. Pulled by canonical id from PROGRAMS
// (lib/programs.ts) so a future registry edit stays the single source of truth.
export const QUICK_START_PROGRAM_IDS = ['amex-mr', 'chase-ur', 'citi-typ', 'capital-one', 'bilt']

export interface SeedQuickStartResult {
  added: string[]
  // Already held (by canonical identity) — distinct from a mid-loop insert
  // failure, which is neither added nor alreadyHeld. Callers must not
  // attribute a failure to "already had" (see app/actions/accounts.ts#
  // addQuickStartPrograms).
  alreadyHeld: string[]
}

// Seed the 5 majors as zero-balance rows so a signed-in user can reach a real
// verdict without knowing an exact balance yet (0 is the engine's existing
// "don't claim ownership" representation — see
// docs/plans/2026-07-05-r14-balance-optional-quickstart.md §2).
// Idempotent: skips any of the 5 the user already holds (by canonical identity)
// rather than overwriting a real balance. Never throws — each insert already
// goes through withDb, and a mid-loop failure just leaves `added` short.
//
// Fetches the user's manual balances ONCE and checks all 5 in memory (via
// matchManualByProgram) instead of 5 sequential findManualByProgram round trips.
export async function seedQuickStartPrograms(userId: string): Promise<SeedQuickStartResult> {
  const rows = await getManualBalances(userId)
  const added: string[] = []
  const alreadyHeld: string[] = []
  for (const id of QUICK_START_PROGRAM_IDS) {
    const def = programById(id)
    if (!def) continue
    if (matchManualByProgram(rows, def.name)) {
      alreadyHeld.push(id)
      continue
    }
    const rowId = await addManualBalance(userId, def.name, 0, def.kind)
    if (rowId) added.push(id)
  }
  return { added, alreadyHeld }
}

// --- Unified resolution -----------------------------------------------------

// De-dupe key for merging sources: program code (monogram) is the stable
// identity across manual + AwardWallet (both run through deriveCode).
function mergeKey(b: Balance): string {
  return (b.code || deriveCode(b.program)).toUpperCase()
}

// The ONE balance resolver every caller uses. Merges the user's manual programs
// with their AwardWallet link (when connected): AwardWallet's cached snapshot
// wins for any program it covers; manual fills the rest. De-duped by program
// code. Reads the CACHE, never a live AwardWallet call (see refreshAwCache for
// the only code paths that hit AwardWallet). Never throws. Returns [] when the
// user has nothing yet — callers decide whether to fall back to mock fixtures.
export async function getUserBalances(userId: string): Promise<Balance[]> {
  const [manual, cached] = await Promise.all([
    getManualBalances(userId),
    getCachedAwBalances(userId),
  ])

  const synced = cached.balances

  // AwardWallet first so it takes precedence; manual fills any gaps.
  const byKey = new Map<string, Balance>()
  for (const b of synced) byKey.set(mergeKey(b), b)
  for (const b of manual) {
    const k = mergeKey(b)
    if (!byKey.has(k)) byKey.set(k, b)
  }
  return [...byKey.values()].sort((a, b) => b.balance - a.balance)
}
