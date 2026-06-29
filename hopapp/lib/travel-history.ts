// Travel HISTORY seam — the concierge's view of where the user has actually been
// and the patterns derived from it (usual travel months, favorite regions,
// typical cabin, trips per year). The agent reads this into its prompt to make
// suggestions feel personal ("you usually go somewhere warm in February").
//
// ⚠️ PLACEHOLDER. getTravelHistory currently returns a typed STUB — there is NO
// real data source wired yet. The intended real source is the user's inbox:
//   TODO: replace the stub with a real Gmail-derived history. Two candidate
//   paths, both behind the user's explicit "Connect Gmail" consent:
//     1. Gmail MCP (mcp__gmail__search_emails / read_email) → parse airline
//        confirmation + itinerary emails into PastTrip[].
//     2. AwardWallet's email-parsing (we already integrate AwardWallet; it can
//        ingest forwarded itineraries) → normalize into PastTrip[].
//   Until then this returns connected:false with an empty history so the UI can
//   show a "Connect Gmail (coming soon)" affordance and the agent degrades
//   cleanly (it simply has no history to cite).

// One past trip the user has taken. Kept minimal + serializable.
export interface PastTrip {
  // Destination IATA where known (lets us join to the destinations dataset);
  // otherwise just the city name.
  destinationCode?: string
  destinationCity: string
  // ISO month string "YYYY-MM" of travel (day-precision not needed for patterns).
  month: string
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

// Get the user's travel history. STUB: always returns EMPTY_TRAVEL_HISTORY for
// now — no Gmail/AwardWallet call yet. Signature is async + userId-scoped so the
// real implementation can drop in without touching callers.
//
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getTravelHistory(userId: string): Promise<TravelHistory> {
  // TODO: fetch + parse real trips for `userId` from Gmail MCP or AwardWallet,
  // then: return { connected: true, trips, patterns: derivePatterns(trips), note }.
  return EMPTY_TRAVEL_HISTORY
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
