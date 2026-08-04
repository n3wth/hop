// lib/trust-stats.ts — public trust/reliability stats surfaced at /stats and
// GET /api/stats (docs/growth-hypothesis.md: the "always resolves, never
// fabricates" engine invariant is the product, not an internal detail, so it
// needs a visible surface). Every number here is read straight from existing
// lib/* aggregates — this module computes nothing and fabricates nothing.
//
// Sources:
//   - lib/valuations-live.ts#getLiveValuations — the canonical live-vs-baseline
//     merge. A program counts as "verified" iff its live override cleared the
//     SAME trust gate (MIN_SAMPLES_TO_TRUST + freshness + validity) the engine
//     itself uses to price it — reusing that gate here (instead of re-deriving
//     a second "trust" definition from raw sample counts) keeps this stat
//     honest by construction.
//   - lib/valuations.ts#listValuations — the static baseline table, for the
//     total-known-programs denominator.
//   - lib/degradation-telemetry.ts#getDegradationWindowCounts — counted
//     degradation events in the last 24h. Gated behind
//     isSelfImproveEnabled() and returns null when off/unavailable; per the
//     house rule "unknown is not the same as healthy" (ADR 0007) we surface
//     that as null rather than fabricating a reassuring 0.
//
// Degrades like every other lib/* surface: never throws. Any upstream
// failure falls back to a zeroed/null shape.

import { getLiveValuations } from '@/lib/valuations-live'
import { listValuations } from '@/lib/valuations'
import { getDegradationWindowCounts } from '@/lib/degradation-telemetry'

export interface TrustStats {
  /** Programs with a live, trust-gated cpp override in effect right now. */
  verifiedPrograms: number
  /** Total programs hop knows how to value (the static baseline table). */
  totalPrograms: number
  /** When this snapshot was computed. */
  asOf: string
  /** Counted degradation events in the last 24h, per source. null = unknown
   *  (telemetry disabled or unreadable) — never fabricated as 0. */
  degradation24h: {
    cash: number | null
    awards: number | null
  }
}

function fallback(): TrustStats {
  return {
    verifiedPrograms: 0,
    totalPrograms: Object.keys(listValuations()).length,
    asOf: new Date().toISOString(),
    degradation24h: { cash: null, awards: null },
  }
}

// Public trust snapshot. Never throws — any failure in a source below
// degrades that field to its zero/null state rather than taking the whole
// stat down or fabricating a number.
export async function getTrustStats(): Promise<TrustStats> {
  const totalPrograms = Object.keys(listValuations()).length
  const asOf = new Date().toISOString()

  let verifiedPrograms = 0
  try {
    const live = await getLiveValuations()
    verifiedPrograms = Object.values(live).filter((v) => v.isLive).length
  } catch {
    verifiedPrograms = 0
  }

  let degradation24h: TrustStats['degradation24h'] = { cash: null, awards: null }
  try {
    const counts = await getDegradationWindowCounts(new Date())
    if (counts) {
      degradation24h = {
        cash: counts.last24h.cash ?? 0,
        awards: counts.last24h.awards ?? 0,
      }
    }
  } catch {
    degradation24h = { cash: null, awards: null }
  }

  return { verifiedPrograms, totalPrograms, asOf, degradation24h }
}

// Fallback export for callers that want the shape without awaiting (e.g. an
// error boundary). Not used on the hot path.
export const EMPTY_TRUST_STATS = fallback
