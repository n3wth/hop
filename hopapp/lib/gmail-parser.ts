// Parse travel-confirmation emails into normalized PastTrip[]. PURE + dependency
// free so it's fully unit-testable and never touches the network. The Gmail
// client (lib/gmail.ts) fetches RawMessage[]; this turns them into trip FACTS.
// We deliberately keep extraction conservative — a missed field is fine, a wrong
// field is not (the agent reasons over this), so every heuristic skips on doubt.

import type { RawMessage } from '@/lib/gmail'
import type { PastTrip } from '@/lib/travel-history'
import { destinationByCode } from '@/lib/destinations'

// Sender-domain → airline display name. Drives the trip's `airline` + lets us
// treat the message as a flight (vs. hotel) confirmation.
const AIRLINE_DOMAINS: Record<string, string> = {
  'united.com': 'United',
  'delta.com': 'Delta',
  'aa.com': 'American Airlines',
  'alaskaair.com': 'Alaska Airlines',
  'southwest.com': 'Southwest',
  'jetblue.com': 'JetBlue',
  'flyfrontier.com': 'Frontier',
  'british-airways.com': 'British Airways',
  'aircanada.ca': 'Air Canada',
  'lufthansa.com': 'Lufthansa',
}

const HOTEL_DOMAINS = new Set([
  'marriott.com',
  'hilton.com',
  'hyatt.com',
  'ihg.com',
])

// City-name → IATA for the curated destinations dataset, so a body that names a
// city ("your trip to Tokyo") still resolves to a destinationCode. Built from
// the same dataset the engine joins on, lowercased for matching.
import { destinations } from '@/lib/destinations'
const CITY_TO_CODE: Array<{ city: string; code: string }> = destinations.map((d) => ({
  city: d.city.toLowerCase(),
  code: d.code,
}))

// Cabin keywords (most-specific first so "premium economy" beats "economy").
const CABIN_PATTERNS: Array<{ re: RegExp; cabin: NonNullable<PastTrip['cabin']> }> = [
  { re: /\bfirst class\b|\bfirst cabin\b/i, cabin: 'first' },
  { re: /\bbusiness class\b|\bbusiness cabin\b|\bpolaris\b|\bclub world\b/i, cabin: 'business' },
  { re: /\bpremium economy\b|\bpremium select\b/i, cabin: 'premium' },
  { re: /\beconomy\b|\bmain cabin\b|\bcoach\b/i, cabin: 'economy' },
]

// Phrases that mark a points/miles redemption (vs. a cash booking).
const POINTS_RE =
  /\b(miles|points|award (?:ticket|booking|travel|flight)|redeem(?:ed|ption)?|frequent flyer|reward (?:flight|night))\b/i

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

function senderDomain(from: string): string {
  const m = from.match(/@([a-z0-9.-]+)/i)
  if (!m) return ''
  // Reduce mail.united.com → united.com (last two labels), good enough for our set.
  const parts = m[1].toLowerCase().split('.')
  return parts.slice(-2).join('.')
}

// Find a destination IATA: prefer an explicit 3-letter code that maps to a known
// destination, else a known city name in the text. Returns code + city when
// resolved, or just a free-text city, or nothing.
function findDestination(text: string): { code?: string; city?: string } {
  // Explicit IATA codes that are in our dataset (avoids matching random caps).
  const codes = text.match(/\b[A-Z]{3}\b/g) ?? []
  for (const c of codes) {
    const d = destinationByCode(c)
    if (d) return { code: d.code, city: d.city }
  }
  // City names from the dataset.
  const lower = text.toLowerCase()
  for (const { city, code } of CITY_TO_CODE) {
    if (lower.includes(city)) {
      const d = destinationByCode(code)
      return { code, city: d?.city ?? city }
    }
  }
  return {}
}

// Pull a travel month as "YYYY-MM". Prefer a date written in the body
// ("March 14, 2024" / "14 Mar 2024" / "2024-03-14"); fall back to the email's
// own date. Returns undefined if neither yields a valid month.
function findMonth(text: string, fallbackEpochMs: number): string | undefined {
  // "March 14, 2024" or "Mar 14 2024"
  const named = text.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+(\d{4})\b/i,
  )
  if (named) {
    const mo = MONTHS[named[1].slice(0, 3).toLowerCase()]
    const yr = Number(named[2])
    if (mo && yr >= 2000 && yr <= 2100) return `${yr}-${String(mo).padStart(2, '0')}`
  }
  // "14 March 2024"
  const dmy = text.match(
    /\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})\b/i,
  )
  if (dmy) {
    const mo = MONTHS[dmy[1].slice(0, 3).toLowerCase()]
    const yr = Number(dmy[2])
    if (mo && yr >= 2000 && yr <= 2100) return `${yr}-${String(mo).padStart(2, '0')}`
  }
  // ISO "2024-03-14"
  const iso = text.match(/\b(\d{4})-(\d{2})-\d{2}\b/)
  if (iso) {
    const yr = Number(iso[1])
    const mo = Number(iso[2])
    if (mo >= 1 && mo <= 12 && yr >= 2000 && yr <= 2100)
      return `${yr}-${String(mo).padStart(2, '0')}`
  }
  // Fall back to the email's received date.
  if (fallbackEpochMs > 0) {
    const d = new Date(fallbackEpochMs)
    if (!isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    }
  }
  return undefined
}

function findCabin(text: string): PastTrip['cabin'] | undefined {
  for (const { re, cabin } of CABIN_PATTERNS) if (re.test(text)) return cabin
  return undefined
}

// Parse a single confirmation message into a trip, or null if it doesn't look
// like a real, resolvable trip (no destination we recognize, or no month).
export function parseMessage(msg: RawMessage): PastTrip | null {
  const domain = senderDomain(msg.from)
  const airline = AIRLINE_DOMAINS[domain]
  const isHotel = HOTEL_DOMAINS.has(domain)
  const text = `${msg.subject}\n${msg.body}`

  const dest = findDestination(text)
  // Require a destination we can place — otherwise the trip is noise to the agent.
  if (!dest.code && !dest.city) return null

  const month = findMonth(text, msg.internalDate)
  if (!month) return null

  const trip: PastTrip = {
    destinationCode: dest.code,
    destinationCity: dest.city ?? dest.code ?? 'Unknown',
    month,
  }
  // Cabin only makes sense for flights; hotels don't carry one.
  if (!isHotel) {
    const cabin = findCabin(text)
    if (cabin) trip.cabin = cabin
    if (airline) trip.airline = airline
  }
  if (POINTS_RE.test(text)) trip.bookedWithPoints = true
  return trip
}

// Parse many messages → deduped PastTrip[]. Dedup key is destination+month so a
// confirmation + its "your trip is tomorrow" reminder collapse into one trip.
export function parseMessages(messages: RawMessage[]): PastTrip[] {
  const byKey = new Map<string, PastTrip>()
  for (const msg of messages) {
    const trip = parseMessage(msg)
    if (!trip) continue
    const key = `${trip.destinationCode ?? trip.destinationCity}|${trip.month}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, trip)
      continue
    }
    // Merge: keep the richer record (prefer a known cabin/airline/points flag).
    byKey.set(key, {
      ...existing,
      cabin: existing.cabin ?? trip.cabin,
      airline: existing.airline ?? trip.airline,
      bookedWithPoints: existing.bookedWithPoints || trip.bookedWithPoints,
    })
  }
  return [...byKey.values()].sort((a, b) => a.month.localeCompare(b.month))
}

// Derive favoriteRegions from trips by joining destinationCode → dataset region.
// Kept here (not in derivePatterns, which is region-map-free + already tested) so
// the persistence layer can stamp it onto the patterns. Most-frequent first.
export function deriveFavoriteRegions(trips: PastTrip[]): string[] {
  const counts = new Map<string, number>()
  for (const t of trips) {
    if (!t.destinationCode) continue
    const d = destinationByCode(t.destinationCode)
    if (!d) continue
    counts.set(d.region, (counts.get(d.region) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([region]) => region)
}
