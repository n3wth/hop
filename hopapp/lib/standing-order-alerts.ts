import { withDb } from '@/lib/supabase-helpers'
import type { FlightOption, SearchParams } from '@/lib/types'

// jsonb columns type as this union in the generated Supabase types. A FlightOption
// is json-serializable but its typed interface isn't structurally assignable to
// the union, so we coerce through a JSON round-trip (also strips any undefineds).
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
function toJson(v: unknown): Json {
  return JSON.parse(JSON.stringify(v ?? null)) as Json
}

// Persisted alerts — what the cron writes on a verdict CROSSING and what the
// in-app "Your alerts" surface renders. This is the durable record that replaces
// (and would later back) an actual push channel: even without email/web-push
// infra, a crossing is captured here so the user sees it next time they open hop.
//
// Table: hop_standing_order_alerts
//   id uuid pk default gen_random_uuid()
//   standing_order_id uuid not null   -- fk → hop_standing_orders(id) on delete cascade
//   user_id text not null             -- denormalized for fast per-user reads + RLS
//   route text not null               -- "SFO → NRT" for display
//   pick jsonb not null               -- snapshot of the qualifying FlightOption
//   cpp numeric not null              -- the cpp at crossing
//   fingerprint text not null         -- offer fingerprint (matches last_notified_offer)
//   delivered boolean not null default false  -- TODO: flips true when a push channel sends it
//   seen boolean not null default false       -- user has viewed it in-app
//   created_at timestamptz not null default now()
//
// FULL CREATE TABLE + RLS/policy SQL is reported by the agent (NOT run here).

const TABLE = 'hop_standing_order_alerts'

// One alert as the UI consumes it.
export interface StandingOrderAlert {
  id: string
  standingOrderId: string
  route: string
  pick: FlightOption
  cpp: number
  fingerprint: string
  delivered: boolean
  seen: boolean
  createdAt?: string
}

interface AlertRow {
  id: string
  standing_order_id: string
  user_id: string
  route: string
  pick: unknown
  cpp: number | string
  fingerprint: string
  delivered: boolean
  seen: boolean
  created_at: string | null
}

function rowToAlert(row: AlertRow): StandingOrderAlert {
  return {
    id: row.id,
    standingOrderId: row.standing_order_id,
    route: row.route,
    pick: (row.pick ?? {}) as FlightOption,
    cpp: typeof row.cpp === 'string' ? parseFloat(row.cpp) : row.cpp,
    fingerprint: row.fingerprint,
    delivered: !!row.delivered,
    seen: !!row.seen,
    createdAt: row.created_at ?? undefined,
  }
}

// Write a crossing alert. Called by the cron ONLY when evaluateOrder reports a
// crossing. Returns the new alert id, or null on failure. NEVER throws.
//
// NOTE: this is the DETECTION + RECORD half. Actual push delivery (email/web
// push) is a TODO — see app/api/cron/standing-orders/route.ts. `delivered`
// stays false until a real channel sends it.
export async function recordAlert(args: {
  userId: string
  standingOrderId: string
  params: SearchParams
  pick: FlightOption
  cpp: number
  fingerprint: string
}): Promise<string | null> {
  return withDb<string | null>(null, async (db) => {
    const route = args.pick.route || `${args.params.from} → ${args.params.to}`
    const { data, error } = await db
      .from(TABLE)
      .insert({
        standing_order_id: args.standingOrderId,
        user_id: args.userId,
        route,
        pick: toJson(args.pick),
        cpp: args.cpp,
        fingerprint: args.fingerprint,
        delivered: false,
        seen: false,
      })
      .select('id')
      .maybeSingle()
    if (error || !data) return null
    return (data.id as string) ?? null
  })
}

// This user's alerts, newest first. Empty on any failure.
export async function listAlerts(userId: string, limit = 20): Promise<StandingOrderAlert[]> {
  return withDb<StandingOrderAlert[]>([], async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select(
        'id, standing_order_id, user_id, route, pick, cpp, fingerprint, delivered, seen, created_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return (data as AlertRow[]).map(rowToAlert)
  })
}

// Count of unseen alerts — drives a badge on /account. 0 on any failure.
export async function countUnseenAlerts(userId: string): Promise<number> {
  return withDb(0, async (db) => {
    const { count, error } = await db
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('seen', false)
    if (error || typeof count !== 'number') return 0
    return count
  })
}

// Mark ALL of a user's alerts seen — called when they open the alerts surface.
export async function markAllAlertsSeen(userId: string): Promise<boolean> {
  return withDb(false, async (db) => {
    const { error } = await db
      .from(TABLE)
      .update({ seen: true })
      .eq('user_id', userId)
      .eq('seen', false)
    return !error
  })
}
