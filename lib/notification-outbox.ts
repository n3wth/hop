// Idempotent delivery outbox (docs/decisions/0003-notification-delivery-abstraction.md's
// deferred "outbox ledger"). Pure delivery bookkeeping — reserve / mark / release
// semantics keyed on UNIQUE(user_id, kind, dedupe_key) — so a crossing can never
// be delivered twice even if the caller crashes mid-flow. Holds NO economics (per
// ADR 0002, the engine computes numbers; this module only tracks whether a
// notification has been sent). Every function follows the house withDb contract:
// NEVER throws, degrades to a safe fallback.
//
// Usage (see app/api/cron/standing-orders/route.ts):
//   1. reserve() BEFORE doing any delivery work for a (userId, kind, dedupeKey).
//      A duplicate reserve (row already exists) returns {ok:false,reason:'duplicate'}
//      — the caller skips the send entirely.
//   2. On successful delivery, markSent(id) so the row permanently blocks any
//      future duplicate reserve for the same dedupe key.
//   3. On a failed delivery, release(id) — this DELETES the row so the next
//      sweep can cleanly re-reserve and retry. (A leftover 'released' row would
//      still collide with the unique index and read as a duplicate, which is
//      why release deletes rather than flips a status.)

import { withDb } from '@/lib/supabase-helpers'

const TABLE = 'hop_notification_outbox'

export interface ReserveInput {
  userId: string
  kind: string
  dedupeKey: string
  /** Opaque delivery context (e.g. standingOrderId, route) — no economics. */
  payload?: unknown
}

export type ReserveResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'duplicate' | 'invalid' | 'db-error' }

// Reserve a delivery slot for (userId, kind, dedupeKey). Returns {ok:true, id}
// on a fresh reservation; {ok:false, reason:'duplicate'} when a row already
// exists for that key (the caller must skip sending); {ok:false, reason:'invalid'}
// on missing input; {ok:false, reason:'db-error'} on any db failure. NEVER throws.
export async function reserve(input: ReserveInput): Promise<ReserveResult> {
  const userId = typeof input?.userId === 'string' ? input.userId.trim() : ''
  const kind = typeof input?.kind === 'string' ? input.kind.trim() : ''
  const dedupeKey = typeof input?.dedupeKey === 'string' ? input.dedupeKey.trim() : ''
  if (!userId || !kind || !dedupeKey) return { ok: false, reason: 'invalid' }

  return withDb<ReserveResult>({ ok: false, reason: 'db-error' }, async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .upsert(
        {
          user_id: userId,
          kind,
          dedupe_key: dedupeKey,
          status: 'reserved',
          payload: input.payload ?? null,
        },
        { onConflict: 'user_id,kind,dedupe_key', ignoreDuplicates: true },
      )
      .select('id')
      .maybeSingle()
    if (error) return { ok: false, reason: 'db-error' }
    // ignoreDuplicates means a conflicting row inserts nothing and RETURNING is
    // empty — that's how we detect "already reserved" without a race.
    if (!data?.id) return { ok: false, reason: 'duplicate' }
    return { ok: true, id: data.id as string }
  })
}

// Flip a reservation to 'sent' after a confirmed delivery. Idempotent; false on
// any failure. NEVER throws.
export async function markSent(id: string): Promise<boolean> {
  if (!id) return false
  return withDb(false, async (db) => {
    const { error } = await db
      .from(TABLE)
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', id)
    return !error
  })
}

// Release a reservation after a failed delivery attempt. DELETES the row (not a
// status flip) so a subsequent reserve() for the same dedupe key can succeed —
// the unique index would otherwise treat a lingering 'released' row as a
// duplicate and permanently block retry. NEVER throws.
export async function release(id: string): Promise<boolean> {
  if (!id) return false
  return withDb(false, async (db) => {
    const { error } = await db.from(TABLE).delete().eq('id', id)
    return !error
  })
}
