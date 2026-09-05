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

// Fare/booking context words. Points + cabin phrases only count when they sit
// within ~200 chars of one of these — a mileage-accrual footer or marketing
// blurb at the bottom of a real confirmation must not set trip facts.
const FARE_CONTEXT_RE = /\b(fare|total|paid|booking|ticket|passenger|cabin|class)\b/i

// Accrual phrasing ("you'll earn 4,200 miles") is about earning, not redeeming —
// it must never set bookedWithPoints.
const EARN_GUARD_RE = /\bearn/i

// True when `re` matches somewhere within ~200 chars of fare/booking context.
// `guardEarn` additionally rejects matches that sit inside accrual phrasing.
function matchesNearFareContext(text: string, re: RegExp, guardEarn = false): boolean {
  const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)
  for (const m of text.matchAll(global)) {
    const i = m.index ?? 0
    const window = text.slice(Math.max(0, i - 200), i + m[0].length + 200)
    if (!FARE_CONTEXT_RE.test(window)) continue
    if (guardEarn && EARN_GUARD_RE.test(text.slice(Math.max(0, i - 60), i + m[0].length + 20)))
      continue
    return true
  }
  return false
}

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

// "SFO → NRT" / "SFO to NRT" — when a route is written out, the SECOND code is
// the destination; a bare-code scan would happily return the origin.
const ROUTE_RE = /\b([A-Z]{3})(?:\s*(?:→|->|–|—)\s*|\s+[Tt][Oo]\s+)([A-Z]{3})\b/g

// Find a destination IATA: prefer the destination side of an explicit route
// pattern, else the first bare word-boundary 3-letter code — but only codes
// that resolve in the curated destination table count. No free-text city
// matching: an unanchored substring scan turned "Chrome" into Rome, "climate"
// into Lima, "comparison" into Paris (audit 2026-08). A fallback that can
// invent a field gets deleted, not tuned.
function findDestination(text: string): { code?: string; city?: string } {
  for (const m of text.matchAll(ROUTE_RE)) {
    const d = destinationByCode(m[2])
    if (d) return { code: d.code, city: d.city }
  }
  // Explicit IATA codes that are in our dataset (avoids matching random caps).
  const codes = text.match(/\b[A-Z]{3}\b/g) ?? []
  for (const c of codes) {
    const d = destinationByCode(c)
    if (d) return { code: d.code, city: d.city }
  }
  return {}
}

// Pull a travel month as "YYYY-MM" from a date written in the body
// ("March 14, 2024" / "14 Mar 2024" / "2024-03-14"). When several dates parse
// (booked-on date + travel dates), prefer the LATEST plausible one — travel is
// after booking. There is deliberately NO fallback to the email's received
// date: that fallback stamped every dateless email with the sync month and
// manufactured fake trips (audit 2026-08). No body date → no trip.
function findMonth(text: string): string | undefined {
  const months: string[] = []
  const push = (mo: number, yr: number): void => {
    if (mo >= 1 && mo <= 12 && yr >= 2000 && yr <= 2100)
      months.push(`${yr}-${String(mo).padStart(2, '0')}`)
  }
  // "March 14, 2024" or "Mar 14 2024"
  for (const m of text.matchAll(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+(\d{4})\b/gi,
  )) {
    push(MONTHS[m[1].slice(0, 3).toLowerCase()] ?? 0, Number(m[2]))
  }
  // "14 March 2024"
  for (const m of text.matchAll(
    /\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})\b/gi,
  )) {
    push(MONTHS[m[1].slice(0, 3).toLowerCase()] ?? 0, Number(m[2]))
  }
  // ISO "2024-03-14"
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-\d{2}\b/g)) {
    push(Number(m[2]), Number(m[1]))
  }
  if (!months.length) return undefined
  months.sort()
  return months[months.length - 1]
}

function findCabin(text: string): PastTrip['cabin'] | undefined {
  for (const { re, cabin } of CABIN_PATTERNS)
    if (matchesNearFareContext(text, re)) return cabin
  return undefined
}

// Parse a single confirmation message into a trip, or null if it doesn't look
// like a real, resolvable trip. Gates, in order: (1) the SENDER must be a known
// airline/hotel domain — anything else (bank promos, statements, newsletters
// the query's subject arm let through) is rejected before we scan a single
// byte of body; (2) a destination we recognize; (3) a date written in the body.
export function parseMessage(msg: RawMessage): PastTrip | null {
  const domain = senderDomain(msg.from)
  const airline = AIRLINE_DOMAINS[domain]
  const isHotel = HOTEL_DOMAINS.has(domain)
  // Sender gate FIRST — no body scanning for unknown senders.
  if (!airline && !isHotel) return null

  const text = `${msg.subject}\n${msg.body}`

  const dest = findDestination(text)
  // Require a destination we can place — otherwise the trip is noise to the agent.
  if (!dest.code) return null

  const month = findMonth(text)
  if (!month) return null

  const trip: PastTrip = {
    destinationCode: dest.code,
    destinationCity: dest.city ?? dest.code,
    month,
  }
  // Cabin only makes sense for flights; hotels don't carry one.
  if (!isHotel) {
    const cabin = findCabin(text)
    if (cabin) trip.cabin = cabin
    if (airline) trip.airline = airline
  }
  if (matchesNearFareContext(text, POINTS_RE, true)) trip.bookedWithPoints = true
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
