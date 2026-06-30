// Booking URL builders. Award redemptions deep-link to the airline's own
// award portal; cash deep-links to Kiwi (affiliate, deep-link ONLY in prod).

import type { FarePolicy, FareRule, SearchParams } from '@/lib/types'

// Award booking portals keyed by IATA airline code.
const AIRLINE_AWARD_URLS: Record<string, string> = {
  AS: 'https://www.alaskaair.com/booking',
  WN: 'https://www.southwest.com/air/booking/',
  UA: 'https://www.united.com/en/us/book-flight/united-reservations',
  AA: 'https://www.aa.com/booking/find-flights',
  DL: 'https://www.delta.com/flight-search/book-a-flight',
  B6: 'https://www.jetblue.com/booking/flights',
}

// Award booking portals keyed by loyalty program name (substring match).
// Program wins over airlineCode because transfers book in the program's portal,
// not necessarily the operating carrier's site (e.g. United via Aeroplan).
const PROGRAM_AWARD_URLS: Array<{ match: string; url: string }> = [
  { match: 'aeroplan', url: 'https://www.aircanada.com/aeroplan' },
  { match: 'alaska', url: 'https://www.alaskaair.com/booking' },
  { match: 'atmos', url: 'https://www.alaskaair.com/booking' },
  { match: 'southwest', url: 'https://www.southwest.com/air/booking/' },
  { match: 'rapid rewards', url: 'https://www.southwest.com/air/booking/' },
  { match: 'mileageplus', url: 'https://www.united.com/en/us/book-flight/united-reservations' },
  { match: 'united', url: 'https://www.united.com/en/us/book-flight/united-reservations' },
  { match: 'avios', url: 'https://www.britishairways.com/travel/redeem/execclub' },
  { match: 'british airways', url: 'https://www.britishairways.com/travel/redeem/execclub' },
  { match: 'virgin atlantic', url: 'https://www.virginatlantic.com/flying-club' },
  { match: 'delta', url: 'https://www.delta.com/flight-search/book-a-flight' },
]

const DEFAULT_AWARD_URL = 'https://www.google.com/travel/flights'

export function pointsBookingUrl(opt: { airlineCode?: string; program?: string }): string {
  const program = opt.program?.toLowerCase().trim()
  if (program) {
    const hit = PROGRAM_AWARD_URLS.find((p) => program.includes(p.match))
    if (hit) return hit.url
  }

  const code = opt.airlineCode?.toUpperCase().trim()
  if (code && AIRLINE_AWARD_URLS[code]) return AIRLINE_AWARD_URLS[code]

  return DEFAULT_AWARD_URL
}

// Kiwi is deep-link ONLY in production (no public search API for affiliate flow).
// Build a results deep-link for the route + dates.
export function cashBookingUrl(params: SearchParams): string {
  const from = encodeURIComponent(params.from.trim().toUpperCase())
  const to = encodeURIComponent(params.to.trim().toUpperCase())
  const depart = encodeURIComponent(params.depart)
  const segments = [`${from}/${to}/${depart}`]
  if (params.return) {
    segments.push(`${to}/${from}/${encodeURIComponent(params.return)}`)
  }
  const path = segments.join('/')
  const adults = Math.max(1, params.adults || 1)
  return `https://www.kiwi.com/en/search/results/${path}?adults=${adults}`
}

// --- Fare change/cancel policy ---------------------------------------------

// Duffel's `conditions` give one rule per modification kind. Each is either a
// `{ allowed, penalty_amount, penalty_currency }` object or `null` (= the airline
// said nothing). We mirror that exactly: a missing/unparseable rule yields an
// empty FareRule (allowed === undefined), never a fabricated yes/no.
interface RawFlightsCondition {
  allowed?: boolean
  penalty_amount?: string | null
  penalty_currency?: string | null
}
interface RawConditions {
  refund_before_departure?: RawFlightsCondition | null
  change_before_departure?: RawFlightsCondition | null
}

function toFareRule(raw: RawFlightsCondition | null | undefined): FareRule {
  if (!raw || typeof raw.allowed !== 'boolean') return {}
  // A "0.00" / absent penalty means no fee — leave penaltyAmount unset so the UI
  // reads it as free. Only carry a positive penalty through.
  const amount = raw.penalty_amount ?? undefined
  const hasPenalty = amount != null && Number(amount) > 0
  return {
    allowed: raw.allowed,
    penaltyAmount: hasPenalty ? amount : undefined,
    penaltyCurrency: hasPenalty ? raw.penalty_currency ?? undefined : undefined,
  }
}

// Map a Duffel offer/order `conditions` blob into our FarePolicy. Defensive:
// accepts `unknown`, never throws. Returns undefined when there's nothing to
// show (so callers can omit the field rather than render an empty section).
export function farePolicyFromConditions(conditions: unknown): FarePolicy | undefined {
  if (!conditions || typeof conditions !== 'object') return undefined
  const c = conditions as RawConditions
  const refundable = toFareRule(c.refund_before_departure)
  const changeable = toFareRule(c.change_before_departure)
  if (refundable.allowed === undefined && changeable.allowed === undefined) return undefined
  return { refundable, changeable }
}

// Format a penalty for display, e.g. "$100 fee". Currency-aware, integer-rounded
// (penalties are coarse; cents add noise). Returns null when there's no fee.
export function formatPenalty(rule: FareRule): string | null {
  if (!rule.penaltyAmount) return null
  const n = Number(rule.penaltyAmount)
  if (!isFinite(n) || n <= 0) return null
  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: rule.penaltyCurrency || 'USD',
      maximumFractionDigits: 0,
    }).format(n)
    return `${formatted} fee`
  } catch {
    return `${rule.penaltyCurrency ?? ''} ${Math.round(n)} fee`.trim()
  }
}

// A one-line, plain-English summary of a single rule, given the verb ("Refundable"
// / "Changeable"). e.g. "Refundable · $100 fee", "Non-refundable", "Refundable".
export function describeFareRule(rule: FareRule, label: string): string {
  if (rule.allowed === undefined) return `${label}: not stated`
  if (!rule.allowed) return `Non-${label.toLowerCase()}`
  const penalty = formatPenalty(rule)
  return penalty ? `${label} · ${penalty}` : `${label} · free`
}
