// Live-merged valuations: the static lib/valuations.ts baseline, overwritten
// per-program by a trusted, fresh live override (lib/valuation-overrides.ts)
// when one exists. lib/valuations.ts itself stays pure/static — this module is
// the ONLY place the two are merged, and it never throws (every failure mode
// degrades to the pure static baseline).

import { PROGRAMS, programById } from '@/lib/programs'
import { clampCpp, listValuations, MAX_CPP, MIN_CPP } from '@/lib/valuations'
import { getValuationOverrides, type ValuationOverride } from '@/lib/valuation-overrides'

// Keep in sync with the Worker's copy (hop-valuations Worker source).
// Exported so the health sentinel's valuation-drift detector
// (lib/health-checks.ts, D5) reuses ADR 0005's trust gate verbatim.
export const MIN_SAMPLES_TO_TRUST = 20
const OVERRIDE_FRESHNESS_DAYS = 14
const OVERRIDE_FRESHNESS_MS = OVERRIDE_FRESHNESS_DAYS * 24 * 60 * 60 * 1000

export interface LiveValuation {
  cpp: number
  sampleSize: number
  asOf: string
  isLive: boolean
}

function isFresh(asOf: string): boolean {
  const ms = Date.parse(asOf)
  if (Number.isNaN(ms)) return false
  return Date.now() - ms <= OVERRIDE_FRESHNESS_MS
}

function isTrusted(o: ValuationOverride): boolean {
  if (o.sampleSize < MIN_SAMPLES_TO_TRUST) return false
  if (!isFresh(o.asOf)) return false
  if (clampCpp(o.cpp) === null) return false
  if (!programById(o.programId)) return false
  return true
}

// Every canonical program id's baseline cpp, overwritten by a trusted + fresh
// live override where one exists. Never throws — getValuationOverrides()
// itself degrades to [] on any failure, so this always resolves to at least
// the pure static baseline.
export async function getLiveValuations(): Promise<Record<string, LiveValuation>> {
  const baseline = listValuations()
  const out: Record<string, LiveValuation> = {}
  for (const [id, cpp] of Object.entries(baseline)) {
    out[id] = { cpp, sampleSize: 0, asOf: '', isLive: false }
  }

  // getValuationOverrides() is withDb-wrapped and should never reject, but this
  // merge is on the hot path for /ask prompt-building — guard anyway so a
  // contract violation upstream can never take this down with it.
  const overrides = await getValuationOverrides().catch(() => [])
  for (const o of overrides) {
    if (!isTrusted(o)) continue
    const clamped = clampCpp(o.cpp)
    if (clamped === null) continue
    out[o.programId] = {
      cpp: clamped,
      sampleSize: o.sampleSize,
      asOf: o.asOf,
      isLive: true,
    }
  }
  return out
}

// Same merge, keyed by canonical program NAME (mirrors
// lib/valuations.ts#valuationsByName()) — the shape prompt-building call sites
// (the /ask concierge) already expect.
export async function liveValuationsByName(): Promise<Record<string, number>> {
  const live = await getLiveValuations()
  const out: Record<string, number> = {}
  for (const p of PROGRAMS) {
    out[p.name] = live[p.id]?.cpp ?? 0
  }
  return out
}

// Re-exported so callers importing only this module still have the band handy.
export { MIN_CPP, MAX_CPP }
