// Fire-and-forget degradation telemetry (ADR 0007): records which upstream
// sources degraded on a LIVE search (hop_degradation_events) so the health
// sentinel's D2 detector can spot a spike against the prior week's baseline.
// The single call site is lib/search.ts#assembleSearch, after degraded[] is
// final, guarded by !useMock — mock runs never record.
//
// PRIVACY BY CONSTRUCTION: a row is a source name + an optional VALIDATED
// IATA route pair + an optional SANITIZED failure reason + a timestamp. NO
// user id (the table has no such column), NO balance, NO raw free text — the
// route column only ever stores `AAA-BBB` (both codes must match /^[A-Z]{3}$/;
// anything else persists null), and the reason column only ever stores the
// output of sanitizeReason (printable ASCII, collapsed whitespace, ≤120 chars;
// garbage persists null). No attacker-influenced string can reach the table
// unsanitized. That closes the Phase 1.5/2 prompt-injection surface at the
// WRITE, not the read.
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
const MAX_REASON_LENGTH = 120
// The sentinel prunes events older than this each run — the table stays small.
export const PRUNE_AFTER_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

// A degraded source with the upstream client's {ok:false} reason string
// (e.g. "Duffel responded 429"). reason is optional — plain string sources
// stay accepted for backward compatibility.
export interface DegradedSource {
  source: string
  reason?: string
}

// Reason strings originate from our own clients but can embed upstream error
// text (fetch messages, response bodies) — so they are sanitized on WRITE,
// same paranoid stance as the route validation above: non-strings → null,
// non-printable chars stripped (printable ASCII only), whitespace collapsed,
// clamped to MAX_REASON_LENGTH; empty after cleaning → null.
export function sanitizeReason(reason: unknown): string | null {
  if (typeof reason !== 'string') return null
  const cleaned = reason
    .replace(/[^\x20-\x7E]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned === '') return null
  return cleaned.length > MAX_REASON_LENGTH
    ? cleaned.slice(0, MAX_REASON_LENGTH).trimEnd()
    : cleaned
}

// The one route validator: a validated 'AAA-BBB' IATA pair or null — shared
// with the lib/search.ts PostHog emit so no unvalidated route string leaves
// the process either.
export function iataRouteCode(route?: { from: string; to: string }): string | null {
  return route && IATA.test(route.from) && IATA.test(route.to)
    ? `${route.from}-${route.to}`
    : null
}

// Record one event per degraded source (with its sanitized failure reason, when
// given). No-ops entirely when the self-improve seam is disabled. Synchronous
// (void): the insert is fired internally and every failure is swallowed.
export function recordDegradation(
  sources: Array<string | DegradedSource>,
  route?: { from: string; to: string },
): void {
  if (!isSelfImproveEnabled()) return
  if (!Array.isArray(sources) || sources.length === 0) return
  const valid = sources
    .map((s) => (typeof s === 'string' ? { source: s, reason: undefined } : s))
    .filter(
      (s): s is DegradedSource =>
        !!s && typeof s.source === 'string' && SOURCE.test(s.source),
    )
    .slice(0, MAX_SOURCES)
  if (valid.length === 0) return
  const routeCode = iataRouteCode(route)
  try {
    void withDb(false, async (db) => {
      const { error } = await db
        .from(TABLE)
        .insert(
          valid.map(({ source, reason }) => ({
            source,
            route: routeCode,
            reason: sanitizeReason(reason),
          })),
        )
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
