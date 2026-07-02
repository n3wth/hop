// Fire-and-forget degradation telemetry (ADR 0007): records which upstream
// sources degraded on a LIVE search (hop_degradation_events) so the health
// sentinel's D2 detector can spot a spike against the prior week's baseline.
// The single call site is lib/search.ts#assembleSearch, after degraded[] is
// final, guarded by !useMock — mock runs never record.
//
// PRIVACY BY CONSTRUCTION: a row is a source name + an optional VALIDATED
// IATA route pair + a timestamp. NO user id (the table has no such column),
// NO balance, NO free text — the route column only ever stores `AAA-BBB`
// (both codes must match /^[A-Z]{3}$/; anything else persists null), so no
// attacker-influenced string can reach the table. That closes the Phase 1.5/2
// prompt-injection surface at the WRITE, not the read.
//
// Same contract as lib/valuation-telemetry.ts#recordCppObservations: void,
// GATED behind isSelfImproveEnabled(), and can NEVER throw or reject to the
// caller — a telemetry bug must never fail a user's search.

import { isSelfImproveEnabled } from '@/lib/env'
import { withDb } from '@/lib/supabase-helpers'

const TABLE = 'hop_degradation_events'
const IATA = /^[A-Z]{3}$/
// degraded[] values come from our own engine ('cash'/'awards'/'balances') but
// we validate shape anyway so junk can never persist.
const SOURCE = /^[a-z][a-z-]{0,31}$/
const MAX_SOURCES = 8
// The sentinel prunes events older than this each run — the table stays small.
export const PRUNE_AFTER_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

// Record one event per degraded source. No-ops entirely when the self-improve
// seam is disabled. Synchronous (void): the insert is fired internally and
// every failure is swallowed.
export function recordDegradation(sources: string[], route?: { from: string; to: string }): void {
  if (!isSelfImproveEnabled()) return
  if (!Array.isArray(sources) || sources.length === 0) return
  const valid = sources
    .filter((s) => typeof s === 'string' && SOURCE.test(s))
    .slice(0, MAX_SOURCES)
  if (valid.length === 0) return
  const routeCode =
    route && IATA.test(route.from) && IATA.test(route.to) ? `${route.from}-${route.to}` : null
  try {
    void withDb(false, async (db) => {
      const { error } = await db
        .from(TABLE)
        .insert(valid.map((source) => ({ source, route: routeCode })))
      return !error
    })
  } catch {
    // Unreachable in practice (withDb never throws) — guarded anyway per the
    // fire-and-forget contract.
  }
}

export interface DegradationWindowCounts {
  /** Events per source in the 24h ending at `now`. */
  last24h: Record<string, number>
  /** Daily mean per source over the 7 days BEFORE that 24h window. */
  priorWeekDailyMean: Record<string, number>
}

// D2's input: counted rows in two windows. GATED; null (unknown) on any
// failure — a dead table must never read as an all-clear.
export async function getDegradationWindowCounts(
  now: Date = new Date(),
): Promise<DegradationWindowCounts | null> {
  if (!isSelfImproveEnabled()) return null
  return withDb<DegradationWindowCounts | null>(null, async (db) => {
    const since = new Date(now.getTime() - 8 * DAY_MS).toISOString()
    const { data, error } = await db
      .from(TABLE)
      .select('source, created_at')
      .gte('created_at', since)
    if (error || !data) return null
    const cutoff24h = now.getTime() - DAY_MS
    const last24h: Record<string, number> = {}
    const priorWeek: Record<string, number> = {}
    for (const row of data) {
      if (typeof row.source !== 'string') continue
      const t = Date.parse(row.created_at ?? '')
      if (!Number.isFinite(t) || t > now.getTime()) continue
      if (t >= cutoff24h) last24h[row.source] = (last24h[row.source] ?? 0) + 1
      else priorWeek[row.source] = (priorWeek[row.source] ?? 0) + 1
    }
    const priorWeekDailyMean: Record<string, number> = {}
    for (const [source, count] of Object.entries(priorWeek)) {
      priorWeekDailyMean[source] = count / 7
    }
    return { last24h, priorWeekDailyMean }
  })
}

// Housekeeping: drop events older than PRUNE_AFTER_DAYS. false = prune
// skipped (the sentinel reports it in its body; never thrown).
export async function pruneDegradationEvents(now: Date = new Date()): Promise<boolean> {
  return withDb(false, async (db) => {
    const cutoff = new Date(now.getTime() - PRUNE_AFTER_DAYS * DAY_MS).toISOString()
    const { error } = await db.from(TABLE).delete().lt('created_at', cutoff)
    return !error
  })
}
