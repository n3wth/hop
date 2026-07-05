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
// Build a results deep-link for the route + dates. Affiliate ATTRIBUTION is not
// in this URL — it stays a clean, shareable link. cashBookingUrl wraps it in the
// tp.media attribution redirect (tpKiwiAttributionUrl) before it goes behind a CTA.
export function kiwiSearchUrl(params: SearchParams): string {
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

// --- Cash outclick wrapper (/api/go/kiwi) -----------------------------------

// The only final landing hosts a cash outclick may reach. Exact hostname match
// only — no subdomain wildcards, no substring checks — so `kiwi.com.evil.example`,
// `deep.kiwi.com` and userinfo tricks (`https://www.kiwi.com@evil.example`) all
// fail closed.
const KIWI_OUTCLICK_HOSTS = new Set(['www.kiwi.com', 'kiwi.com'])
// Travelpayouts' affiliate redirect domain. tp.media/r is an OPEN redirector:
// it 302s to whatever its ?u= param says (verified 2026-07-04 — it forwards to
// arbitrary domains, appending only affilid). So an allowlisted tp.media host
// is NOT sufficient; the guard must also pin the inner ?u= target to kiwi.com,
// or /api/go/kiwi would launder an open redirect (hop.flights → tp.media →
// attacker). This is what cashBookingUrl mints.
const TP_OUTCLICK_HOSTS = new Set(['tp.media', 'www.tp.media'])

// Shared https/host hygiene: https-only (kills javascript:/data:/http:), no
// embedded credentials, no explicit port. Applied to BOTH the tp.media wrapper
// and its inner kiwi.com target.
function isCleanHttpsUrl(url: URL): boolean {
  return url.protocol === 'https:' && !url.username && !url.password && url.port === ''
}

// Strict allowlist for the /api/go/kiwi redirect target. This is the ONLY line
// between the ?to= query param and a 302 Location header, so it must never pass
// anything but our own affiliate destinations. Two accepted shapes:
//   1. a bare kiwi.com deep-link (stale/shared links minted before the tp.media
//      swap keep working), or
//   2. a tp.media/r attribution redirect whose ?u= is itself a valid kiwi.com
//      deep-link — the outer host alone is never trusted, because tp.media will
//      forward ?u= anywhere.
// Unparseable input (outer or inner) → false, never a throw.
export function isAllowedCashOutclickUrl(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (!isCleanHttpsUrl(url)) return false
  if (KIWI_OUTCLICK_HOSTS.has(url.hostname)) return true
  if (TP_OUTCLICK_HOSTS.has(url.hostname)) {
    const inner = url.searchParams.get('u')
    if (!inner) return false
    let innerUrl: URL
    try {
      innerUrl = new URL(inner)
    } catch {
      return false
    }
    return isCleanHttpsUrl(innerUrl) && KIWI_OUTCLICK_HOSTS.has(innerUrl.hostname)
  }
  return false
}

// Route context for the outclick ledger, e.g. "SFO-LAX". Anything that isn't
// exactly IATA-IATA is dropped (the ledger stores 'unknown') — the param is
// context, never a destination.
const ROUTE_SHAPE = /^[A-Z]{3}-[A-Z]{3}$/

export function normalizeOutclickRoute(raw: string | null | undefined): string | null {
  const route = (raw ?? '').trim().toUpperCase()
  return ROUTE_SHAPE.test(route) ? route : null
}

// The cash CTA's href: the first-party outclick redirect (app/api/go/kiwi/
// route.ts) that logs one hop_outclicks row (kind 'cash') and 302s to the
// affiliate destination — the first-party record Travelpayouts commissions are
// reconciled against. Pure and client-safe; the single source of truth for the
// path shape.
export function cashOutclickPath(destination: string, route?: string): string {
  const query = new URLSearchParams({ to: destination })
  const normalized = normalizeOutclickRoute(route)
  if (normalized) query.set('route', normalized)
  return `/api/go/kiwi?${query.toString()}`
}

// Travelpayouts attribution redirect (tp.media/r). The client tag in
// app/layout.tsx only decorates clicks on links that point DIRECTLY at partner
// domains — it can't see through our same-origin /api/go/kiwi 302 — so the
// redirect destination itself must carry attribution. These are the exact
// values Travelpayouts' own link-conversion API mints for this property
// (marker = affiliate account, trs = the hop.flights traffic source aka
// "project 545389", p/campaign_id = the Kiwi.com program). They're public —
// they appear in every outbound affiliate link — so they live in code, like
// the tag's project id in app/layout.tsx.
const TP_REDIRECT_BASE = 'https://tp.media/r'
const TP_MARKER = '745576'
const TP_TRS = '545389'
const TP_KIWI_PROGRAM = '4136' // p= — Kiwi.com
const TP_KIWI_CAMPAIGN = '111' // campaign_id= — Kiwi.com

// Wrap a Kiwi deep-link in the tp.media attribution redirect: tp.media 302s to
// the exact ?u= URL with the affiliate id (affilid=…-<marker>) appended, so the
// commission survives the first-party ledger hop. Pure and client-safe.
export function tpKiwiAttributionUrl(kiwiUrl: string): string {
  const query = new URLSearchParams({
    marker: TP_MARKER,
    trs: TP_TRS,
    p: TP_KIWI_PROGRAM,
    campaign_id: TP_KIWI_CAMPAIGN,
    u: kiwiUrl,
  })
  return `${TP_REDIRECT_BASE}?${query.toString()}`
}

// What the UI (and mocks, and Duffel-normalized options) put behind the cash
// CTA. Since R0.6 this is the /api/go/kiwi wrapper, not the raw Kiwi link —
// same destination, but the click leaves a first-party ledger row so affiliate
// revenue is reconcilable (Linear N-302). The wrapped destination is the
// tp.media attribution form of the Kiwi deep-link, so the commission doesn't
// depend on the client tag seeing through the same-origin redirect.
export function cashBookingUrl(params: SearchParams): string {
  const route = `${params.from.trim().toUpperCase()}-${params.to.trim().toUpperCase()}`
  return cashOutclickPath(tpKiwiAttributionUrl(kiwiSearchUrl(params)), route)
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
