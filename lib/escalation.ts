// Concierge escalation — "Request expert booking" (roadmap §6 / N-290), Phase 1.
//
// Point.me charges ~$200/pax for done-for-you award bookings. Phase 1 only
// VALIDATES DEMAND: a user can ask hop to book a trip for them and we STORE the
// request for manual follow-up. No automation, no payment, no SLA. This module
// is the persistence seam — types + create/list against hop_escalations.
//
// Service-role client, server-only; identity is Auth0, so we scope reads by
// user_id in code (writes carry it too). Mirrors lib/standing-orders.ts exactly:
// every function degrades gracefully via withDb and NEVER throws to the route or
// the page — failures return {ok:false}/[]/null fallbacks (the admin list returns
// null on failure so "db down" never reads as "no leads").
//
// SQL (run manually — this code does NOT run DDL). The CREATE TABLE lives in the
// Drizzle migration (drizzle/0001_hop_escalations.sql, generated from the
// hop_escalations table added to lib/db/schema.ts). Summary:
//
//   CREATE TABLE public.hop_escalations (
//     id          uuid primary key default gen_random_uuid(),
//     user_id     text,                       -- Auth0 sub; NULL when signed out
//     email       text not null,              -- where to reach them
//     trip        jsonb not null default '{}'::jsonb,  -- free-form context
//     status      text not null default 'new',
//     created_at  timestamptz not null default now()
//   );
//   ALTER TABLE public.hop_escalations ENABLE ROW LEVEL SECURITY;
//   -- service-role bypasses RLS; no anon/auth policy (we scope in code).

import { withDb } from '@/lib/supabase-helpers'

const TABLE = 'hop_escalations'

// Caps so a hostile/scripted caller can't store unbounded blobs. The route also
// rate-limits, but defense-in-depth keeps the row small regardless of caller.
const MAX_EMAIL = 200
const MAX_NOTE = 2000
const MAX_FIELD = 400 // any single free-form context string (route, dates, …)

// Free-form trip context captured with the request — deliberately loose so the
// concierge surface can pass whatever it has (a parsed route, the user's typed
// note, their live points total) without a schema migration per field. Everything
// is optional; the agent stores what it knows.
export interface EscalationTrip {
  /** Plain-text route, e.g. "SFO → NRT" or "somewhere warm in March". */
  route?: string
  /** Plain-text dates / timeframe, e.g. "late March 2026, ~10 days". */
  dates?: string
  /** The user's own note about what they want. */
  notes?: string
  /** The user's live total points at request time (context for the human agent). */
  totalPoints?: number
  // Open-ended: callers may attach extra primitive context. Kept JSON-safe.
  [key: string]: string | number | boolean | null | undefined
}

export interface EscalationInput {
  /** Auth0 sub when signed in; omitted/undefined for a signed-out request. */
  userId?: string
  /** Where to reach the requester — required (it's the whole point of the lead). */
  email: string
  /** Free-form trip context. */
  trip?: EscalationTrip
}

// The escalation lifecycle: 'new' (stored, untouched) → 'done' (handled). The db
// column is free text, so reads stay `string`; writes accept only this union.
export type EscalationStatus = 'new' | 'done'
export const ESCALATION_STATUSES: readonly EscalationStatus[] = ['new', 'done']

// A stored escalation as the manual-follow-up surface / tests read it.
export interface Escalation {
  id: string
  userId: string | null
  email: string
  trip: EscalationTrip
  status: string
  createdAt?: string
}

// The db row shape (snake_case columns), kept local so the query builder has real
// types. Mirrors the admin.ts HopDatabase pattern used across the owner libs.
interface EscalationRow {
  id: string
  user_id: string | null
  email: string | null
  trip: unknown
  status: string | null
  created_at: string | null
}

// Minimal email sanity — NOT full RFC validation (that's a fool's errand), just
// enough to reject obvious junk before we store a lead a human will email back.
// Pure + total. Returns the trimmed address, or null when it can't be a contact.
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().slice(0, MAX_EMAIL)
  // one @, no spaces, a dot in the domain, non-empty local part.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

// Clamp arbitrary incoming trip context into a clean, bounded EscalationTrip.
// NEVER trusts the shape: drops non-primitive values, trims strings, coerces a
// finite totalPoints, and caps total size. Pure + total. The free-form `notes`
// gets a longer ceiling than other fields (it's the user's own message).
export function normalizeTrip(raw: unknown): EscalationTrip {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: EscalationTrip = {}
  let keys = 0
  const LONG_FIELDS = new Set(['notes', 'transcript'])
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (keys >= 24) break // bound the key count regardless of caller
    if (v == null) continue
    const key = k.slice(0, 60)
    if (typeof v === 'string') {
      const cap = LONG_FIELDS.has(key) ? MAX_NOTE : MAX_FIELD
      const s = v.trim().slice(0, cap)
      if (s) {
        out[key] = s
        keys++
      }
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = v
      keys++
    } else if (typeof v === 'boolean') {
      out[key] = v
      keys++
    }
    // objects/arrays/functions are dropped — context stays flat + JSON-safe.
  }
  return out
}

function rowToEscalation(row: EscalationRow): Escalation | null {
  const email = normalizeEmail(row.email)
  if (!email) return null
  return {
    id: row.id,
    userId: row.user_id ?? null,
    email,
    trip: normalizeTrip(row.trip),
    status: row.status ?? 'new',
    createdAt: row.created_at ?? undefined,
  }
}

// Store an expert-booking request. Validates + clamps defensively. Returns the
// new row id, or null on failure (unconfigured db, bad email, or write error).
// NEVER throws — mirrors the standing-orders create contract.
export async function createEscalation(input: EscalationInput): Promise<string | null> {
  return withDb<string | null>(null, async (db) => {
    const email = normalizeEmail(input?.email)
    if (!email) return null // no contact → no usable lead
    const trip = normalizeTrip(input?.trip)
    const userId =
      typeof input?.userId === 'string' && input.userId.trim() ? input.userId.trim() : null

    const { data, error } = await db
      .from(TABLE)
      .insert({
        user_id: userId,
        email,
        trip,
        // status defaults to 'new' at the db; set explicitly so a row is always
        // in a known state even if the default is ever dropped.
        status: 'new',
      })
      .select('id')
      .maybeSingle()
    if (error || !data) return null
    return (data.id as string) ?? null
  })
}

// This user's escalation requests, newest first. Empty on any failure or when the
// db is unconfigured. Scoped by user_id in code. NEVER throws.
export async function listEscalations(userId: string): Promise<Escalation[]> {
  if (!userId) return []
  return withDb<Escalation[]>([], async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select('id, user_id, email, trip, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error || !data) return []
    return (data as EscalationRow[])
      .map(rowToEscalation)
      .filter((e): e is Escalation => e !== null)
  })
}

// ALL recent escalations, newest first — the owner-gated admin console reads this
// (no user scoping; the route gates on owner). null when the db is unconfigured
// or the read fails ("unknown"); [] only when genuinely empty. Mirrors
// lib/cron-heartbeat.ts#listHeartbeats. NEVER throws.
export async function listRecentEscalations(limit = 100): Promise<Escalation[] | null> {
  return withDb<Escalation[] | null>(null, async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select('id, user_id, email, trip, status, created_at')
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(1, limit), 250))
    if (error || !data) return null
    return (data as EscalationRow[])
      .map(rowToEscalation)
      .filter((e): e is Escalation => e !== null)
  })
}

// Flip an escalation's status — the owner marking a lead handled ('done') or
// putting it back ('new'). Accepts only the modeled statuses. Returns false on a
// bad id/status, unconfigured db, or write error; NEVER throws.
export async function setEscalationStatus(id: string, status: EscalationStatus): Promise<boolean> {
  if (!id) return false
  if (!ESCALATION_STATUSES.includes(status)) return false
  return withDb(false, async (db) => {
    const { error } = await db.from(TABLE).update({ status }).eq('id', id)
    return !error
  })
}
