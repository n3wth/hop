// Travel HISTORY seam — the concierge's view of where the user has actually been
// and the patterns derived from it (usual travel months, favorite regions,
// typical cabin, trips per year). The agent reads this into its prompt to make
// suggestions feel personal ("you usually go somewhere warm in February").
//
// REAL SOURCE: the user's Gmail, BEHIND EXPLICIT CONSENT. When a user connects
// Gmail (lib/gmail.ts OAuth flow), we read ONLY their travel-confirmation emails
// (tight query), parse them into PastTrip[] (lib/gmail-parser.ts), store ONLY the
// normalized trip facts (never raw email) in hop_travel_history, and return
// { connected:true, trips, patterns } here. Until a user connects — or while the
// seam is gated off (env.isGmailHistoryEnabled) — this returns the not-connected
// empty history so the UI shows a "Connect Gmail" affordance and the agent
// degrades cleanly (it simply has no history to cite).
//
// PRIVACY: consent is explicit (OAuth), scope is gmail.readonly, we read only
// confirmation mail, we persist only trip facts, and the user can disconnect +
// delete everything from /account. Everything is scoped to the Auth0 sub.

import { supabaseAdmin } from '@/utils/supabase/admin'
import { isGmailHistoryEnabled } from '@/lib/env'

// One past trip the user has taken. Kept minimal + serializable.
export interface PastTrip {
  // Destination IATA where known (lets us join to the destinations dataset);
  // otherwise just the city name.
  destinationCode?: string
  destinationCity: string
  // ISO month string "YYYY-MM" of travel (day-precision not needed for patterns).
  month: string
  // Airline flown, if the confirmation told us (e.g. "United").
  airline?: string
  // Cabin flown, if the source told us.
  cabin?: 'economy' | 'premium' | 'business' | 'first'
  // Whether it was booked with points (vs. cash) — when the source distinguishes.
  bookedWithPoints?: boolean
}

// Patterns DERIVED from PastTrip[] — the high-signal summary the agent actually
// reasons over (cheaper to put in the prompt than the raw trip list).
export interface TravelPatterns {
  // 1-based month numbers the user most often travels in (e.g. [2, 7] = Feb/Jul).
  usualMonths: number[]
  // Regions the user returns to most (free-text, e.g. "Asia", "Europe").
  favoriteRegions: string[]
  // The cabin the user flies most often, when discernible.
  typicalCabin?: 'economy' | 'premium' | 'business' | 'first'
  // Rough trips/year, for pacing suggestions.
  tripsPerYear?: number
}

export interface TravelHistory {
  // Whether a real history source (Gmail/AwardWallet) is connected. Today: false.
  connected: boolean
  // The user's past trips. Empty in the stub.
  trips: PastTrip[]
  // Patterns derived from `trips`. Empty/undefined in the stub.
  patterns: TravelPatterns
  // Human-readable note for the UI / prompt about the source state.
  note: string
}

// The empty, not-yet-connected history. Returned by the stub and reused as the
// safe default everywhere.
export const EMPTY_TRAVEL_HISTORY: TravelHistory = {
  connected: false,
  trips: [],
  patterns: { usualMonths: [], favoriteRegions: [], typicalCabin: undefined, tripsPerYear: undefined },
  note: "No travel history connected yet. Connect Gmail (coming soon) to let hop learn from your past trips.",
}

// Derive TravelPatterns from a list of past trips. PURE — extracted now so it's
// unit-tested and ready to run over REAL trips once the Gmail seam lands. With
// the stub's empty list it returns empty patterns.
export function derivePatterns(trips: PastTrip[]): TravelPatterns {
  if (!trips.length) {
    return { usualMonths: [], favoriteRegions: [], typicalCabin: undefined, tripsPerYear: undefined }
  }

  // Most common travel months (1-based), most frequent first.
  const monthCounts = new Map<number, number>()
  for (const t of trips) {
    const m = Number(t.month?.slice(5, 7))
    if (Number.isFinite(m) && m >= 1 && m <= 12) {
      monthCounts.set(m, (monthCounts.get(m) ?? 0) + 1)
    }
  }
  const usualMonths = [...monthCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 3)
    .map(([m]) => m)

  // Most common cabin.
  const cabinCounts = new Map<NonNullable<PastTrip['cabin']>, number>()
  for (const t of trips) if (t.cabin) cabinCounts.set(t.cabin, (cabinCounts.get(t.cabin) ?? 0) + 1)
  const typicalCabin = [...cabinCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

  // Trips per year = trips / distinct calendar years spanned (min 1).
  const years = new Set<string>()
  for (const t of trips) if (t.month?.length >= 4) years.add(t.month.slice(0, 4))
  const tripsPerYear = years.size ? Math.round((trips.length / years.size) * 10) / 10 : trips.length

  // favoriteRegions is left to the caller/real source (needs a city→region map);
  // the stub has no trips so this stays empty until the Gmail seam joins to the
  // destinations dataset.
  return { usualMonths, favoriteRegions: [], typicalCabin, tripsPerYear }
}

const TABLE = 'hop_travel_history'

const CABINS = new Set(['economy', 'premium', 'business', 'first'])

// Clamp whatever is stored in the jsonb `trips` column back into PastTrip[].
// Defends the engine + prompt against a hand-edited row ever feeding unknown
// shapes downstream. PURE. Drops anything missing a destination or month.
export function validateTrips(raw: unknown): PastTrip[] {
  if (!Array.isArray(raw)) return []
  const out: PastTrip[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const month = typeof r.month === 'string' ? r.month : undefined
    const destinationCity =
      typeof r.destinationCity === 'string' ? r.destinationCity : undefined
    // Require "YYYY-MM" with a real 01-12 month.
    const monthOk = !!month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    if (!monthOk || !destinationCity) continue
    const trip: PastTrip = { destinationCity, month }
    if (typeof r.destinationCode === 'string') trip.destinationCode = r.destinationCode
    if (typeof r.airline === 'string') trip.airline = r.airline
    if (typeof r.cabin === 'string' && CABINS.has(r.cabin))
      trip.cabin = r.cabin as PastTrip['cabin']
    if (typeof r.bookedWithPoints === 'boolean') trip.bookedWithPoints = r.bookedWithPoints
    out.push(trip)
  }
  return out
}

// Get the user's travel history, scoped to their Auth0 sub. Returns the REAL
// connected history (trips + derived patterns) when the user has connected Gmail
// and we've stored trips; otherwise the not-connected empty history. Degrades to
// EMPTY on any failure — never throws to the page/agent.
//
// favoriteRegions is read from the row (stamped at sync time by the persistence
// layer, which has the city→region join); derivePatterns stays region-map-free.
export async function getTravelHistory(userId: string): Promise<TravelHistory> {
  // Seam gated off, or no userId → not connected.
  if (!isGmailHistoryEnabled() || !userId) return EMPTY_TRAVEL_HISTORY
  try {
    const db = supabaseAdmin()
    if (!db) return EMPTY_TRAVEL_HISTORY
    const { data, error } = await db
      .from(TABLE)
      .select('connected, trips')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data || !data.connected) return EMPTY_TRAVEL_HISTORY

    const stored = (data.trips ?? {}) as { trips?: unknown; favoriteRegions?: unknown }
    const trips = validateTrips(stored.trips)
    if (!trips.length) {
      // Connected, but nothing parsed yet (e.g. empty inbox). Report connected so
      // the UI shows disconnect, but with no trips the agent has nothing to cite.
      return {
        connected: true,
        trips: [],
        patterns: { usualMonths: [], favoriteRegions: [], typicalCabin: undefined, tripsPerYear: undefined },
        note: 'Gmail connected — no past trips found yet.',
      }
    }
    const favoriteRegions = Array.isArray(stored.favoriteRegions)
      ? stored.favoriteRegions.filter((r): r is string => typeof r === 'string')
      : []
    const patterns = { ...derivePatterns(trips), favoriteRegions }
    return {
      connected: true,
      trips,
      patterns,
      note: `Gmail connected — learning from ${trips.length} past trip${trips.length === 1 ? '' : 's'}.`,
    }
  } catch {
    return EMPTY_TRAVEL_HISTORY
  }
}

// Render a travel history as a compact, prompt-ready summary. Returns '' when
// there's nothing to say (stub / not connected) so the caller omits the block.
// Pure.
export function travelHistorySummary(h: TravelHistory | undefined): string {
  if (!h || !h.connected || !h.trips.length) return ''
  const p = h.patterns
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const lines: string[] = []
  if (p.usualMonths.length)
    lines.push(`- Usually travels in: ${p.usualMonths.map((m) => MONTHS[m - 1] ?? m).join(', ')}`)
  if (p.favoriteRegions.length) lines.push(`- Favorite regions: ${p.favoriteRegions.join(', ')}`)
  if (p.typicalCabin) lines.push(`- Typically flies: ${p.typicalCabin}`)
  if (p.tripsPerYear !== undefined) lines.push(`- ~${p.tripsPerYear} trips/year`)
  return lines.join('\n')
}
