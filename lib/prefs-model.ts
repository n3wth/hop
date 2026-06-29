// Natural-language travel preferences, layered ON TOP of the deterministic cpp
// ranking in lib/cpp.ts. The LLM never originates economics: it only translates
// freeform text into this minimal, validated shape (parseTravelPrefs) and the
// pure applyPrefs() re-ranks/filters the engine's output by it. cpp value stays
// the primary sort; prefs are a filter + tiebreaker on top.

import type { FlightOption } from '@/lib/types'

// Cabin ordering, lowest → highest. Index = rank, used for minCabin comparisons.
export const CABINS = ['economy', 'premium', 'business', 'first'] as const
export type Cabin = (typeof CABINS)[number]

// MINIMAL by design — only prefs that clearly change the verdict ranking.
export interface TravelPrefs {
  // Hard ceiling on connections. 0 = nonstop only. Filters options above it.
  maxStops?: number
  // Lowest acceptable cabin. Options below it are deprioritized (kept, sunk to
  // the bottom — never silently dropped, so the user still sees the trade-off).
  minCabin?: Cabin
  // Soft preference for nonstop: nonstop options float up as a tiebreaker. Does
  // not filter (unlike maxStops: 0).
  preferNonstop?: boolean
}

// True when prefs carry no actionable signal — applyPrefs is then a no-op.
export function isEmptyPrefs(p: TravelPrefs | undefined | null): boolean {
  if (!p) return true
  return p.maxStops === undefined && p.minCabin === undefined && !p.preferNonstop
}

// Normalize an option's cabin to our enum, or undefined when unknown.
// FlightOption.cabin is a free string ("Economy", "Main", "First", …).
export function cabinRank(cabin: string | undefined): number | undefined {
  if (!cabin) return undefined
  const c = cabin.toLowerCase()
  if (c.includes('first')) return CABINS.indexOf('first')
  if (c.includes('business')) return CABINS.indexOf('business')
  if (c.includes('premium')) return CABINS.indexOf('premium')
  // "Main", "Economy", "Saver", "Basic" all map to economy.
  if (c.includes('economy') || c.includes('main') || c.includes('saver') || c.includes('basic'))
    return CABINS.indexOf('economy')
  return undefined
}

// Effective stop count for an option: prefer `stops`, else infer from `direct`.
function stopsOf(o: FlightOption): number | undefined {
  if (typeof o.stops === 'number') return o.stops
  if (o.direct === true) return 0
  return undefined
}

// Is the option nonstop? Only true when we positively know it (stops === 0 or
// direct === true). Unknown → false (don't claim nonstop we can't prove).
function isNonstop(o: FlightOption): boolean {
  return stopsOf(o) === 0
}

// Does the option violate maxStops? Only when we KNOW the stop count and it
// exceeds the ceiling — unknown stops are never filtered out (never throw away
// a real option on missing data).
function violatesMaxStops(o: FlightOption, maxStops: number): boolean {
  const s = stopsOf(o)
  return s !== undefined && s > maxStops
}

// Is the option below the minimum cabin? Only when we KNOW the cabin and it
// ranks below the floor. Unknown cabin → not below (kept in place).
function belowMinCabin(o: FlightOption, minRank: number): boolean {
  const r = cabinRank(o.cabin)
  return r !== undefined && r < minRank
}

// Apply travel prefs to an already-cpp-ranked list. PURE: returns a new array,
// never mutates the input.
//
// Composition with cpp ranking (lib/cpp.rankOptions):
//   1. cpp ranking runs first (caller's input order = best value first).
//   2. maxStops FILTERS: options that provably exceed the ceiling are removed —
//      BUT if that would empty the list, the filter is skipped (a verdict with
//      worse stops beats no verdict at all). Cash baselines are exempt from the
//      filter so the user always keeps a fallback price.
//   3. A STABLE sort then re-orders survivors by, in priority:
//        a. minCabin satisfied (at/above floor) before below-floor,
//        b. preferNonstop / max:0 → nonstop before connecting,
//      with the incoming cpp order preserved within each group (tiebreaker only).
//   Net effect: prefs filter the obviously-unacceptable and bubble preferred
//   options up, while cpp remains the decisive economic signal underneath.
export function applyPrefs(options: FlightOption[], prefs?: TravelPrefs): FlightOption[] {
  if (isEmptyPrefs(prefs) || options.length === 0) return [...options]
  const p = prefs as TravelPrefs

  // --- 1. Filter on maxStops (with safety net) -------------------------------
  let working = options
  if (p.maxStops !== undefined) {
    const max = p.maxStops
    const kept = options.filter(
      (o) => o.kind === 'cash' || !violatesMaxStops(o, max),
    )
    // Never empty the verdict: if filtering removed every redemption AND every
    // cash baseline, keep the original list rather than show nothing.
    working = kept.length > 0 ? kept : options
  }

  const minRank = p.minCabin ? CABINS.indexOf(p.minCabin) : undefined
  const wantNonstop = p.preferNonstop === true || p.maxStops === 0

  // --- 2. Stable re-rank: cabin-floor group, then nonstop, cpp order within ---
  // Decorate-sort-undecorate to guarantee stability across runtimes.
  return working
    .map((o, i) => ({ o, i }))
    .sort((a, b) => {
      if (minRank !== undefined) {
        const aBelow = belowMinCabin(a.o, minRank) ? 1 : 0
        const bBelow = belowMinCabin(b.o, minRank) ? 1 : 0
        if (aBelow !== bBelow) return aBelow - bBelow
      }
      if (wantNonstop) {
        const aNon = isNonstop(a.o) ? 0 : 1
        const bNon = isNonstop(b.o) ? 0 : 1
        if (aNon !== bNon) return aNon - bNon
      }
      return a.i - b.i // preserve incoming cpp order (stable tiebreaker)
    })
    .map((x) => x.o)
}

// --- Parsing: freeform text → TravelPrefs ------------------------------------

// Clamp/validate an arbitrary object (e.g. AI JSON) to a strict TravelPrefs.
// NEVER trusts unknown fields — only maxStops/minCabin/preferNonstop are read,
// each validated to its type/enum. Garbage in → {} out.
export function validatePrefs(raw: unknown): TravelPrefs {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const out: TravelPrefs = {}

  if (typeof r.maxStops === 'number' && Number.isFinite(r.maxStops)) {
    out.maxStops = Math.max(0, Math.min(3, Math.trunc(r.maxStops)))
  }

  if (typeof r.minCabin === 'string') {
    const c = r.minCabin.toLowerCase().trim()
    if ((CABINS as readonly string[]).includes(c)) out.minCabin = c as Cabin
  }

  if (typeof r.preferNonstop === 'boolean') out.preferNonstop = r.preferNonstop
  // maxStops: 0 already implies nonstop; surface the soft flag for consistency.
  if (out.maxStops === 0) out.preferNonstop = true

  return out
}

// Deterministic regex fallback for the common, unambiguous phrasings. Runs
// without the network so prefs work even when the AI is down, and seeds the AI
// path (the AI can only widen, never contradict the obvious). Returns {} when
// nothing matches.
export function parseTravelPrefsFallback(text: string): TravelPrefs {
  const t = (text || '').toLowerCase()
  const out: TravelPrefs = {}

  // Nonstop / direct / "won't connect" / "no layovers".
  if (
    /\bnon[-\s]?stop\b/.test(t) ||
    /\bdirect\b/.test(t) ||
    /\bno (lay\s?overs?|connections?|stops?)\b/.test(t) ||
    /\b(won'?t|wont|don'?t|do not|never) (connect|layover)/.test(t)
  ) {
    out.maxStops = 0
    out.preferNonstop = true
  }

  // "one stop max" / "at most one stop" / "max 1 stop".
  const stopMatch = t.match(/(?:max(?:imum)?\s+|at most\s+|no more than\s+)?(\d+|one|two)\s+stops?\s*(?:max(?:imum)?)?/)
  if (out.maxStops === undefined && stopMatch) {
    const word = stopMatch[1]
    const n = word === 'one' ? 1 : word === 'two' ? 2 : parseInt(word, 10)
    if (Number.isFinite(n)) out.maxStops = Math.max(0, Math.min(3, n))
  }

  // Cabin floor. Highest mentioned wins (a request for "first" overrides "business").
  if (/\bfirst class\b|\bfirst[-\s]?class\b/.test(t)) out.minCabin = 'first'
  else if (/\bbusiness( class)?\b|\blie[-\s]?flat\b/.test(t)) out.minCabin = 'business'
  else if (/\bpremium( economy)?\b/.test(t)) out.minCabin = 'premium'

  return validatePrefs(out)
}
