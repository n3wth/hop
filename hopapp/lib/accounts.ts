import type { Balance } from '@/lib/types'
import { deriveCode, getBalances } from '@/lib/awardwallet'
import { canonicalizeProgram } from '@/lib/programs'
import { supabaseAdmin } from '@/utils/supabase/admin'

// Per-user balance sources persisted in Supabase via the service-role client
// (server-only). Identity is Auth0, so we scope every query by user_id in code.
// All functions degrade gracefully — never throw to the page.
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
  try {
    const db = supabaseAdmin()
    if (!db) return null
    const { data, error } = await db
      .from(TABLE)
      .select('aw_user_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return null
    return (data.aw_user_id as string) ?? null
  } catch {
    return null
  }
}

export async function setUserAwId(userId: string, awUserId: string): Promise<boolean> {
  try {
    const db = supabaseAdmin()
    if (!db) return false
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
  } catch {
    return false
  }
}

export async function clearUserAwId(userId: string): Promise<boolean> {
  try {
    const db = supabaseAdmin()
    if (!db) return false
    const { error } = await db.from(TABLE).delete().eq('user_id', userId)
    return !error
  } catch {
    return false
  }
}

// --- Manual balances (primary path) ----------------------------------------

// This user's hand-entered programs, newest-updated first. Empty on any failure.
export async function getManualBalances(userId: string): Promise<ManualBalance[]> {
  try {
    const db = supabaseAdmin()
    if (!db) return []
    const { data, error } = await db
      .from(MANUAL_TABLE)
      .select('id, program, code, balance, kind, updated_at')
      .eq('user_id', userId)
      .order('balance', { ascending: false })
    if (error || !data) return []
    return data.map((r) => ({
      id: r.id as string,
      program: r.program as string,
      // code may be null in db; derive a monogram so the brand chip always renders.
      code: (r.code as string | null) ?? deriveCode(r.program as string),
      balance: Number(r.balance ?? 0),
      status: (r.kind as string | null) ?? undefined,
    }))
  } catch {
    return []
  }
}

// Find an existing manual program that resolves to the SAME canonical identity
// as `program` (so "amex" and "Membership Rewards" collide on amex-mr). Falls
// back to a normalized exact-name match when the input doesn't canonicalize.
// Returns the matching row, or null if the user has no equivalent program yet.
export async function findManualByProgram(
  userId: string,
  program: string,
): Promise<ManualBalance | null> {
  const target = canonicalizeProgram(program)
  const rows = await getManualBalances(userId)
  if (target) {
    return rows.find((r) => canonicalizeProgram(r.program)?.id === target.id) ?? null
  }
  // No canonical match — compare on a loose normalized name so an exact retype
  // of an unknown program still dedupes.
  const norm = program.trim().toLowerCase()
  return rows.find((r) => r.program.trim().toLowerCase() === norm) ?? null
}

// Add a program. Code is derived from the name when not supplied. Returns the
// new row id, or null on failure.
export async function addManualBalance(
  userId: string,
  program: string,
  balance: number,
  kind?: string,
): Promise<string | null> {
  try {
    const db = supabaseAdmin()
    if (!db) return null
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
  } catch {
    return null
  }
}

// Update a program the user owns. Scoped by BOTH id and user_id so one user can
// never edit another's row. Re-derives the code when the name changes.
export async function updateManualBalance(
  userId: string,
  id: string,
  fields: { program?: string; balance?: number; kind?: string },
): Promise<boolean> {
  try {
    const db = supabaseAdmin()
    if (!db) return false
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
  } catch {
    return false
  }
}

// Remove a program the user owns. Scoped by id AND user_id.
export async function removeManualBalance(userId: string, id: string): Promise<boolean> {
  try {
    const db = supabaseAdmin()
    if (!db) return false
    const { error } = await db
      .from(MANUAL_TABLE)
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    return !error
  } catch {
    return false
  }
}

// --- Unified resolution -----------------------------------------------------

// De-dupe key for merging sources: program code (monogram) is the stable
// identity across manual + AwardWallet (both run through deriveCode).
function mergeKey(b: Balance): string {
  return (b.code || deriveCode(b.program)).toUpperCase()
}

// The ONE balance resolver every caller uses. Merges the user's manual programs
// with their AwardWallet link (when connected): AwardWallet is LIVE, so it wins
// for any program it covers; manual fills the rest. De-duped by program code.
// Never throws. Returns [] when the user has nothing yet — callers decide whether
// to fall back to mock fixtures.
export async function getUserBalances(userId: string): Promise<Balance[]> {
  const [manual, awId] = await Promise.all([
    getManualBalances(userId),
    getUserAwId(userId),
  ])

  let synced: Balance[] = []
  if (awId) {
    const res = await getBalances(awId).catch(() => ({ ok: false as const }))
    if (res.ok) synced = res.data
  }

  // AwardWallet first so it takes precedence; manual fills any gaps.
  const byKey = new Map<string, Balance>()
  for (const b of synced) byKey.set(mergeKey(b), b)
  for (const b of manual) {
    const k = mergeKey(b)
    if (!byKey.has(k)) byKey.set(k, b)
  }
  return [...byKey.values()].sort((a, b) => b.balance - a.balance)
}
