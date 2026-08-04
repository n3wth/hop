import type { SearchParams } from '@/lib/types'
import { withDb } from '@/lib/supabase-helpers'
import {
  validateDraft,
  type StandingOrder,
  type StandingOrderDraft,
  MAX_PROGRAMS,
} from '@/lib/standing-orders-model'
import type { Cabin } from '@/lib/prefs-model'

// Standing Orders persisted in Supabase via the service-role client (server-only).
// Identity is Auth0, so we scope EVERY query by user_id in code (the table also
// carries RLS — see the CREATE TABLE notes below). All functions degrade
// gracefully — never throw to the page or the cron.
//
// Table: hop_standing_orders
//   id uuid pk default gen_random_uuid()
//   user_id text not null            -- Auth0 sub
//   params jsonb not null            -- SearchParams (lib/types)
//   min_cpp numeric not null         -- verdict threshold, >= 2.5 (clamped)
//   seats int not null default 1     -- award seats required
//   eligible_programs text[] not null default '{}'  -- empty = any program
//   min_cabin text                   -- optional cabin floor (prefs-model.Cabin)
//   notify_email text                -- alert delivery address (Auth0 email at
//                                       create time); null = in-app only
//   last_notified_offer text         -- dedupe fingerprint; null until first crossing
//   active boolean not null default true
//   created_at timestamptz not null default now()
//
// FULL CREATE TABLE + RLS/policy SQL is reported by the agent (NOT run here).
// notify_email was added later:
//   ALTER TABLE hop_standing_orders ADD COLUMN IF NOT EXISTS notify_email text;

const TABLE = 'hop_standing_orders'

// The db row shape (snake_case jsonb columns), kept local so the query builder
// has real types. Mirrors the admin.ts HopDatabase pattern.
interface OrderRow {
  id: string
  user_id: string
  params: unknown
  min_cpp: number | string
  seats: number
  eligible_programs: string[] | null
  min_cabin: string | null
  notify_email: string | null
  last_notified_offer: string | null
  active: boolean
  created_at: string | null
}

// The select column list, shared so list queries stay in sync with OrderRow.
const SELECT_COLS =
  'id, user_id, params, min_cpp, seats, eligible_programs, min_cabin, notify_email, last_notified_offer, active, created_at'

// The cron's per-order shape: a domain StandingOrder plus the owning user and the
// (optional) delivery address. notifyEmail lives here rather than on the model's
// StandingOrder so the pure model stays free of delivery concerns.
export type ActiveStandingOrder = StandingOrder & {
  userId: string
  notifyEmail: string | null
}

// Normalize a stored notify address: trim, drop empties, cap length. Returns null
// for anything unusable so the cron treats it as "no address" (skip send).
function cleanNotifyEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  if (!t || t.length > 320) return null
  return t
}

// A generous per-user ceiling — watches are cheap but cron cost scales with them.
const MAX_ORDERS_PER_USER = 25

// Map a db row to the domain StandingOrder, re-clamping the stored params/draft
// through validateDraft so a hand-edited row can never feed garbage into the
// engine. Returns null when the row is unusable (e.g. corrupt params).
function rowToOrder(row: OrderRow): StandingOrder | null {
  const draft = validateDraft({
    params: row.params,
    minCpp: typeof row.min_cpp === 'string' ? parseFloat(row.min_cpp) : row.min_cpp,
    seats: row.seats,
    eligiblePrograms: row.eligible_programs ?? [],
    minCabin: row.min_cabin ?? undefined,
  })
  if (!draft) return null
  return {
    id: row.id,
    params: draft.params,
    minCpp: draft.minCpp,
    seats: draft.seats,
    eligiblePrograms: draft.eligiblePrograms,
    minCabin: draft.minCabin,
    lastNotifiedOffer: row.last_notified_offer ?? null,
    active: row.active,
    createdAt: row.created_at ?? undefined,
  }
}

// This user's watches, newest first. Empty on any failure.
export async function listStandingOrders(userId: string): Promise<StandingOrder[]> {
  return withDb<StandingOrder[]>([], async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select(SELECT_COLS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error || !data) return []
    return (data as OrderRow[])
      .map(rowToOrder)
      .filter((o): o is StandingOrder => o !== null)
  })
}

// Count this user's ACTIVE watches — the tier cap reads this before allowing a
// new one. 0 on any failure (so a degraded read never falsely blocks a create —
// the engine's own MAX_ORDERS_PER_USER ceiling still backstops).
export async function countActiveStandingOrders(userId: string): Promise<number> {
  return withDb(0, async (db) => {
    const { count, error } = await db
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('active', true)
    if (error || typeof count !== 'number') return 0
    return count
  })
}

// ALL active watches across users — the cron's input. Scoped to active only so a
// paused watch never runs (or charges). Carries the owning user + notify address
// for delivery. Empty on any failure.
export async function listActiveStandingOrders(): Promise<ActiveStandingOrder[]> {
  return withDb<ActiveStandingOrder[]>([], async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select(SELECT_COLS)
      .eq('active', true)
      .order('created_at', { ascending: true })
    if (error || !data) return []
    const out: ActiveStandingOrder[] = []
    for (const row of data as OrderRow[]) {
      const order = rowToOrder(row)
      if (order) {
        out.push({ ...order, userId: row.user_id, notifyEmail: cleanNotifyEmail(row.notify_email) })
      }
    }
    return out
  })
}

// Create a watch from a validated draft. Re-clamps defensively. Enforces a
// per-user count ceiling. `notifyEmail` (optional) is the alert delivery address,
// seeded by the server action from the Auth0 session — stored so the cron can
// reach the user without a session. Returns the new row id, or null on
// failure/over-limit.
export async function createStandingOrder(
  userId: string,
  draft: StandingOrderDraft,
  notifyEmail?: string | null,
): Promise<string | null> {
  return withDb<string | null>(null, async (db) => {
    const clean = validateDraft(draft)
    if (!clean) return null

    // Count guard — cheap pre-check (the cron cost scales with active watches).
    const { count } = await db
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    if (typeof count === 'number' && count >= MAX_ORDERS_PER_USER) return null

    const { data, error } = await db
      .from(TABLE)
      .insert({
        user_id: userId,
        params: { ...clean.params },
        min_cpp: clean.minCpp,
        seats: clean.seats,
        eligible_programs: clean.eligiblePrograms.slice(0, MAX_PROGRAMS),
        min_cabin: clean.minCabin ?? null,
        notify_email: cleanNotifyEmail(notifyEmail),
        active: clean.active ?? true,
      })
      .select('id')
      .maybeSingle()
    if (error || !data) return null
    return (data.id as string) ?? null
  })
}

// Pause/resume a watch the user owns. Scoped by id AND user_id.
export async function setStandingOrderActive(
  userId: string,
  id: string,
  active: boolean,
): Promise<boolean> {
  return withDb(false, async (db) => {
    const { error } = await db
      .from(TABLE)
      .update({ active })
      .eq('id', id)
      .eq('user_id', userId)
    return !error
  })
}

// Remove a watch the user owns. Scoped by id AND user_id.
export async function deleteStandingOrder(userId: string, id: string): Promise<boolean> {
  return withDb(false, async (db) => {
    const { error } = await db.from(TABLE).delete().eq('id', id).eq('user_id', userId)
    return !error
  })
}

// Record the offer we just alerted on (dedupe). Called by the cron ONLY after a
// crossing. Scoped by id AND user_id. Idempotent. NEVER throws.
export async function recordNotifiedOffer(
  userId: string,
  id: string,
  fingerprint: string,
): Promise<boolean> {
  return withDb(false, async (db) => {
    const { error } = await db
      .from(TABLE)
      .update({ last_notified_offer: fingerprint })
      .eq('id', id)
      .eq('user_id', userId)
    return !error
  })
}

const ALERTS_TABLE = 'hop_standing_order_alerts'

// Flip a recorded alert's `delivered` flag after a successful send. Called by the
// cron ONLY on a confirmed email send — a failed send leaves delivered=false so
// the next run retries. Scoped by alert id AND user_id. Idempotent. NEVER throws.
export async function markAlertDelivered(userId: string, alertId: string): Promise<boolean> {
  return withDb(false, async (db) => {
    const { error } = await db
      .from(ALERTS_TABLE)
      .update({ delivered: true })
      .eq('id', alertId)
      .eq('user_id', userId)
    return !error
  })
}

// Convenience for the cron summary / tests — re-export the param shape callers use.
export type { SearchParams, StandingOrder, StandingOrderDraft, Cabin }
