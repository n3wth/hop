// Standing Orders — "the verdict that watches". A plain-English watch that hop
// re-runs the UNCHANGED verdict engine (lib/search.assembleSearch) on a
// schedule and surfaces an alert only when YOUR verdict crosses the line you set.
//
// This module is PURE: types, clamping/validation, the deterministic crossing
// rule, and a dedupe key. No network, no Supabase, no AI. The LLM (in
// standing-orders-parser.ts) only TRANSLATES freeform text into this validated
// shape — it never invents economics. Everything here is unit-testable offline
// and NEVER throws.

import type { FlightOption, SearchParams, SearchResult } from '@/lib/types'

// Cabin floor reuses the prefs enum so the parser and engine speak one language.
import { CABINS, type Cabin } from '@/lib/prefs-model'
// lib/cpp.ts is pure (types only, no network/DB) — safe to import here without
// pulling in lib/search.ts's upstream clients, unlike importing POINTS_THRESHOLD_CPP
// from lib/search directly would.
import { POINTS_THRESHOLD_CPP } from '@/lib/cpp'

// A persisted watch. `params` is a plain SearchParams (the same contract the
// search box and /api/search use), so assembleSearch consumes it verbatim — the
// watch runs the EXACT engine the user would run by hand.
export interface StandingOrder {
  id: string
  // The route/dates/pax to re-run. Identical shape to a manual search.
  params: SearchParams
  // The verdict threshold: notify only when the pick's cpp is at/above this.
  minCpp: number
  // Minimum award seats required at that price (defaults to params.adults).
  seats: number
  // Loyalty programs the user will accept the redemption in. Empty = any
  // program. Canonical program ids/names (matched loosely by the engine).
  eligiblePrograms: string[]
  // Cabin floor for the watch (independent of the user's global prefs). The
  // engine deprioritizes/filters below this exactly like TravelPrefs.minCabin.
  minCabin?: Cabin
  // The last offer fingerprint we alerted on, so we fire on the VERDICT crossing
  // and never re-alert the same seat twice. null until the first crossing.
  lastNotifiedOffer: string | null
  // Paused watches are kept but skipped by the cron.
  active: boolean
  createdAt?: string
}

// What the NL parser produces and the server persists — everything except the
// db-owned fields (id, lastNotifiedOffer, createdAt). active defaults true.
export interface StandingOrderDraft {
  params: SearchParams
  minCpp: number
  seats: number
  eligiblePrograms: string[]
  minCabin?: Cabin
  active?: boolean
}

// hop's verdict line. A watch can't ask for less than this — below the
// POINTS_THRESHOLD it's never a "use points" verdict, so a sub-threshold watch
// would alert on a verdict hop itself calls pay-cash. We CLAMP up to it.
// Sourced from lib/cpp.ts (the same constant lib/search.ts uses for the real
// verdict) rather than hand-typed, so a re-tune of the line can't silently
// leave this watch floor pointed at the old value.
export const MIN_CPP_FLOOR = POINTS_THRESHOLD_CPP
// A sane ceiling — nobody is waiting for 12 cpp; it would never fire. Clamp so a
// fat-fingered or model-hallucinated value can't create a dead watch.
export const MAX_CPP_CEIL = 10
// Seats are bounded to what the engine/awards realistically return.
export const MAX_SEATS = 9
// Cap eligible programs so a runaway parse can't bloat the row.
export const MAX_PROGRAMS = 12
const MAX_PROGRAM_LEN = 80

// IATA codes are exactly three letters. Anything else is rejected at validation.
function isIata(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z]{3}$/.test(v.trim())
}

// ISO date YYYY-MM-DD, loosely. We don't assert it's a real calendar day here —
// the engine tolerates odd dates and degrades — but we reject obvious garbage.
function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())
}

// Clamp an arbitrary cpp number into [MIN_CPP_FLOOR, MAX_CPP_CEIL], 1 decimal.
// Non-finite/garbage → the floor (a safe, fires-on-real-value default).
export function clampCpp(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''))
  if (!Number.isFinite(n)) return MIN_CPP_FLOOR
  const clamped = Math.max(MIN_CPP_FLOOR, Math.min(MAX_CPP_CEIL, n))
  return Math.round(clamped * 10) / 10
}

// Clamp seats into [1, MAX_SEATS]. Garbage → 1.
export function clampSeats(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.min(MAX_SEATS, Math.trunc(n)))
}

// Clamp/validate a SearchParams candidate. Returns null when the route is
// unusable (no valid origin/destination) — the caller refuses to persist a watch
// it could never run. Dates default forward; the engine tolerates them.
export function validateParams(raw: unknown): SearchParams | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!isIata(r.from) || !isIata(r.to)) return null
  const from = (r.from as string).trim().toUpperCase()
  const to = (r.to as string).trim().toUpperCase()
  if (from === to) return null
  const depart = isIsoDate(r.depart) ? (r.depart as string).trim() : undefined
  if (!depart) return null
  const ret = isIsoDate(r.return) ? (r.return as string).trim() : undefined
  const adults = clampSeats(r.adults)
  const params: SearchParams = { from, to, depart, adults }
  if (ret) params.return = ret
  return params
}

// Clamp a list of program names: trim, drop empties, length-cap, de-dupe
// (case-insensitive), cap count. Never trusts unknown types.
export function clampPrograms(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const name = item.trim().slice(0, MAX_PROGRAM_LEN)
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
    if (out.length >= MAX_PROGRAMS) break
  }
  return out
}

// Clamp a cabin to the enum, or undefined.
function clampCabin(raw: unknown): Cabin | undefined {
  if (typeof raw !== 'string') return undefined
  const c = raw.toLowerCase().trim()
  return (CABINS as readonly string[]).includes(c) ? (c as Cabin) : undefined
}

// CLAMP an arbitrary object (AI JSON or a hand-edited row) into a strict draft.
// Returns null when there's no usable route — a watch with no route is not a
// watch. Everything else gets a safe default. NEVER throws.
export function validateDraft(raw: unknown): StandingOrderDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const params = validateParams(r.params)
  if (!params) return null
  const seats = clampSeats(r.seats ?? params.adults)
  const draft: StandingOrderDraft = {
    params,
    minCpp: clampCpp(r.minCpp),
    seats,
    eligiblePrograms: clampPrograms(r.eligiblePrograms),
  }
  const cabin = clampCabin(r.minCabin)
  if (cabin) draft.minCabin = cabin
  if (typeof r.active === 'boolean') draft.active = r.active
  return draft
}

// A watch's stored depart date has already passed. The cron re-runs `params`
// VERBATIM (it's "the exact engine the user would run by hand"), so an unpaused
// watch whose date has lapsed would otherwise send Duffel/seats.aero a
// known-invalid past departure on EVERY tick forever — a permanent 422, not a
// graceful degrade, and a standing paid-API cost with no chance of ever
// crossing. The cron skips these before calling the engine (see
// app/api/cron/standing-orders/route.ts) rather than rolling the date forward:
// rolling forward would change offerFingerprint's `date` component daily,
// re-alerting on the SAME persistent deal every tick instead of dedupe-ing it.
// PURE: bare "YYYY-MM-DD" string compare, no Date parsing.
export function isOrderExpired(depart: string, todayIso: string): boolean {
  return depart < todayIso
}

// --- Crossing rule (the heart of "fire on the VERDICT") ----------------------

// A stable fingerprint for the picked redemption. Used as lastNotifiedOffer so a
// re-run that lands on the SAME seat/price/program doesn't re-alert — we fire on
// a NEW crossing, not on every cron tick. Coarse on purpose: program + miles +
// taxes + route + date identifies "the same deal" without depending on a volatile
// upstream offer id. Returns '' for a non-redemption pick (cash) — those never
// cross a points threshold.
export function offerFingerprint(o: FlightOption | undefined): string {
  if (!o) return ''
  if (o.kind !== 'award' && o.kind !== 'transfer') return ''
  return [
    o.program ?? o.airline ?? '',
    o.miles ?? '',
    Math.round((o.taxes ?? 0) * 100),
    o.route ?? '',
    o.date ?? '',
  ].join('|')
}

// Does this option satisfy the watch's eligible-program filter? Empty list = any
// program qualifies. Loose, case-insensitive substring match either direction so
// "Alaska" matches "Alaska Mileage Plan" and a stored canonical name matches a
// shorter display program. Cash options never qualify (they carry no program).
export function programEligible(o: FlightOption, eligible: string[]): boolean {
  if (eligible.length === 0) return true
  const hay = `${o.program ?? ''} ${o.airline ?? ''}`.toLowerCase()
  return eligible.some((p) => {
    const needle = p.toLowerCase().trim()
    if (!needle) return false
    return hay.includes(needle) || needle.includes((o.program ?? '').toLowerCase())
  })
}

// The outcome of evaluating one watch against one fresh SearchResult.
export interface OrderEvaluation {
  // True when the verdict CROSSES the watch's line on a NEW offer:
  //   - there is a redemption pick (award/transfer),
  //   - it satisfies the eligible-program filter,
  //   - its cpp is at/above minCpp,
  //   - it has at least `seats` available (when the source reports seats),
  //   - and its fingerprint differs from lastNotifiedOffer (dedupe).
  crossed: boolean
  // The qualifying pick (when crossed) — what an alert/notification describes.
  pick?: FlightOption
  // The pick's fingerprint — persist as the new lastNotifiedOffer when crossed.
  fingerprint: string
  // The pick's cpp at evaluation time (for the alert record / UI).
  cpp?: number
  // Why it didn't cross (for logs / "your alerts" diagnostics). undefined when crossed.
  reason?:
    | 'no-redemption'
    | 'program-ineligible'
    | 'below-cpp'
    | 'not-enough-seats'
    | 'already-notified'
}

// Award seats available on an option, when the upstream reported it. We don't
// invent a number: FlightOption carries no explicit seat count today, so we
// treat "seats" as a soft check that only fails when we can POSITIVELY know
// fewer are available. Today that's never (no field), so seats never blocks — but
// the hook is here for when seatsaero seat counts are threaded through. Returns
// undefined when unknown (→ not blocked).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function seatsAvailable(_o: FlightOption): number | undefined {
  return undefined
}

// PURE crossing evaluation. Given a watch and a freshly assembled SearchResult,
// decide whether to fire. Reads result.pick — the SAME pick the verdict UI shows
// — so the watch fires on hop's actual verdict, not a parallel computation.
// NEVER throws.
export function evaluateOrder(
  order: Pick<StandingOrder, 'minCpp' | 'seats' | 'eligiblePrograms' | 'lastNotifiedOffer'>,
  result: SearchResult,
): OrderEvaluation {
  const pick = result.pick
  const isRedemption = pick != null && (pick.kind === 'award' || pick.kind === 'transfer')
  if (!pick || !isRedemption) {
    return { crossed: false, fingerprint: '', reason: 'no-redemption' }
  }

  const fingerprint = offerFingerprint(pick)
  const cpp = pick.cpp

  if (!programEligible(pick, order.eligiblePrograms)) {
    return { crossed: false, pick, fingerprint, cpp, reason: 'program-ineligible' }
  }

  if (cpp == null || cpp < order.minCpp) {
    return { crossed: false, pick, fingerprint, cpp, reason: 'below-cpp' }
  }

  const avail = seatsAvailable(pick)
  if (avail !== undefined && avail < order.seats) {
    return { crossed: false, pick, fingerprint, cpp, reason: 'not-enough-seats' }
  }

  if (fingerprint && fingerprint === order.lastNotifiedOffer) {
    return { crossed: false, pick, fingerprint, cpp, reason: 'already-notified' }
  }

  return { crossed: true, pick, fingerprint, cpp }
}

// Deterministic, offline NL fallback: regex out a route, cabin, cpp and a couple
// of obvious program hints from freeform text. Mirrors prefs-model's fallback —
// it always runs first so watches parse even when the AI Gateway is down, and it
// seeds the AI path (the AI widens, never contradicts the obvious). Returns null
// when no usable route is found. NEVER throws.
//
// `homeAirport` (the user's saved origin) backs the origin when the text only
// names a destination ("watch flights to Tokyo").
export function parseStandingOrderFallback(
  text: string,
  homeAirport?: string,
): StandingOrderDraft | null {
  const t = (text || '').trim()
  if (!t) return null
  const lower = t.toLowerCase()

  // Route: "SFO -> NRT", "SFO to NRT", "from SFO to NRT". Bare IATA pair.
  let from: string | undefined
  let to: string | undefined
  const pair = t.match(/\b([A-Za-z]{3})\b\s*(?:->|→|to|–|-|>)\s*\b([A-Za-z]{3})\b/)
  if (pair) {
    from = pair[1].toUpperCase()
    to = pair[2].toUpperCase()
  } else {
    // "to NRT" alone → destination only, origin from home airport.
    const dest = t.match(/\bto\s+([A-Za-z]{3})\b/i)
    if (dest) {
      to = dest[1].toUpperCase()
      if (homeAirport && /^[A-Za-z]{3}$/.test(homeAirport)) from = homeAirport.toUpperCase()
    }
  }
  if (!from || !to) return null

  // cpp threshold: "above 2.5 cpp", "2.5 cpp", "over 3".
  let minCpp = MIN_CPP_FLOOR
  const cppMatch = lower.match(/(?:above|over|at least|>=?|≥)?\s*(\d+(?:\.\d+)?)\s*cpp/)
  if (cppMatch) minCpp = clampCpp(parseFloat(cppMatch[1]))

  // Cabin floor.
  let minCabin: Cabin | undefined
  if (/\bfirst class\b|\bfirst[-\s]?class\b/.test(lower)) minCabin = 'first'
  else if (/\bbusiness( class)?\b|\blie[-\s]?flat\b/.test(lower)) minCabin = 'business'
  else if (/\bpremium( economy)?\b/.test(lower)) minCabin = 'premium'

  // "points I hold" / "points I have" → leave eligiblePrograms empty (any held
  // program); the engine already prefers programs the user holds. We don't try
  // to enumerate held programs here (that needs balances, which is not pure).
  const eligiblePrograms: string[] = []

  // Seats: "2 seats", "for 2", "x2".
  let seats = 1
  const seatMatch = lower.match(/(\d+)\s*(?:seats?|people|passengers?|pax)\b/) || lower.match(/\bfor\s+(\d+)\b/)
  if (seatMatch) seats = clampSeats(parseInt(seatMatch[1], 10))

  // Dates: leave to the AI / the form. The fallback can't reliably resolve
  // "late March" to an ISO day, so it returns a draft WITHOUT depart — which
  // validateParams would reject. So the fallback only succeeds when an ISO date
  // is present; otherwise return null and let the AI or the form supply dates.
  const isoDate = t.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (!isoDate) return null
  const depart = isoDate[1]
  const retMatch = t.match(/\b(\d{4}-\d{2}-\d{2})\b.*?\b(\d{4}-\d{2}-\d{2})\b/)
  const params: SearchParams = { from, to, depart, adults: seats }
  if (retMatch && retMatch[2] !== depart) params.return = retMatch[2]

  const draft: StandingOrderDraft = { params, minCpp, seats, eligiblePrograms }
  if (minCabin) draft.minCabin = minCabin
  return draft
}
