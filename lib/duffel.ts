// Duffel cash-flight client. Searches the Duffel Air API and normalizes
// offers to the shared FlightOption model. NEVER throws — returns ApiResult.

import type { ApiResult, FlightOption, SearchParams } from '@/lib/types'
import { env, hasEnv } from '@/lib/env'
import { cpp, tier } from '@/lib/cpp'
import { cashBookingUrl } from '@/lib/booking'
import { cacheGet, cacheSet } from './cache'

const DUFFEL_BASE = 'https://api.duffel.com'
const DUFFEL_VERSION = 'v2'
const TIMEOUT_MS = 10_000

// Duffel rate-limits per access token: after one 429, every call until the
// window resets is another 429, and each one extends the burst. So a 429 pauses
// ALL Duffel calls for the reset window (shared via Redis when configured) and
// searches degrade cash immediately instead of piling on.
const RATE_LIMIT_KEY = 'hop:duffel:rate-limited'
const RATE_LIMIT_DEFAULT_SEC = 30
const RATE_LIMIT_MAX_SEC = 120

// Seconds to pause after a 429, clamped so a bad header can't stall cash for long.
export function rateLimitCooldownSec(headers: Headers, now = Date.now()): number {
  for (const name of ['retry-after', 'ratelimit-reset']) {
    const raw = headers.get(name)?.trim()
    if (!raw) continue
    let sec: number
    if (/^\d+$/.test(raw)) {
      const n = Number(raw)
      // Large values are an absolute epoch timestamp, small ones a delay.
      sec = n > 1_000_000_000 ? n - now / 1000 : n
    } else {
      sec = (Date.parse(raw) - now) / 1000
    }
    if (Number.isFinite(sec)) return Math.min(RATE_LIMIT_MAX_SEC, Math.max(1, Math.ceil(sec)))
  }
  return RATE_LIMIT_DEFAULT_SEC
}

// --- Duffel response shapes (partial; only the fields we consume) -----------
interface DuffelSegment {
  departing_at?: string
  arriving_at?: string
  duration?: string // ISO-8601 duration, e.g. "PT1H32M"
  operating_carrier?: { name?: string; iata_code?: string }
  marketing_carrier?: { name?: string; iata_code?: string }
}
interface DuffelSlice {
  origin?: { iata_code?: string }
  destination?: { iata_code?: string }
  duration?: string
  segments?: DuffelSegment[]
}
interface DuffelOffer {
  id?: string
  total_amount?: string
  tax_amount?: string | null
  owner?: { name?: string; iata_code?: string }
  slices?: DuffelSlice[]
}
interface DuffelOfferRequestResponse {
  data?: {
    offers?: DuffelOffer[]
  }
}

// Parse ISO-8601 duration "PT1H32M" -> minutes. Returns undefined if unparseable.
function durationToMinutes(iso?: string): number | undefined {
  if (!iso) return undefined
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?/.exec(iso)
  if (!m) return undefined
  const hours = m[1] ? parseInt(m[1], 10) : 0
  const mins = m[2] ? parseInt(m[2], 10) : 0
  const total = hours * 60 + mins
  return total > 0 ? total : undefined
}

// Format an ISO datetime to a short display date, e.g. "Jul 9".
function displayDate(iso?: string, fallback?: string): string {
  const source = iso || fallback || ''
  const d = new Date(source)
  if (isNaN(d.getTime())) return fallback ?? ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function num(value: string | null | undefined): number {
  if (value == null) return 0
  const n = parseFloat(value)
  return isNaN(n) ? 0 : n
}

// Map our cabin enum to Duffel's cabin_class. Absent/unknown → economy, which
// preserves the original hardcoded behavior for callers that don't set a cabin.
function duffelCabinClass(
  cabin: SearchParams['cabin'],
): 'economy' | 'premium_economy' | 'business' | 'first' {
  switch (cabin) {
    case 'premium':
      return 'premium_economy'
    case 'business':
      return 'business'
    case 'first':
      return 'first'
    default:
      return 'economy'
  }
}

// Build Duffel's passengers array from the search's passenger mix. Adults are
// always at least one; children/infants are optional (absent → adults-only).
// Infants are booked as lap infants (no seat) — `infant_without_seat`.
function buildPassengers(params: SearchParams): Array<{ type: string }> {
  const adults = Math.max(1, params.adults || 1)
  const children = Math.max(0, params.children ?? 0)
  const infants = Math.max(0, params.infants ?? 0)
  return [
    ...Array.from({ length: adults }, () => ({ type: 'adult' })),
    ...Array.from({ length: children }, () => ({ type: 'child' })),
    ...Array.from({ length: infants }, () => ({ type: 'infant_without_seat' })),
  ]
}

export function normalizeDuffelOffer(
  offer: DuffelOffer,
  params: SearchParams,
  index: number,
): FlightOption {
  const firstSlice = offer.slices?.[0]
  const segments = firstSlice?.segments ?? []
  const origin = firstSlice?.origin?.iata_code ?? params.from
  const destination = firstSlice?.destination?.iata_code ?? params.to

  const owner = offer.owner
  const airline = owner?.name ?? segments[0]?.marketing_carrier?.name ?? 'Unknown'
  const airlineCode = owner?.iata_code ?? segments[0]?.marketing_carrier?.iata_code

  const durationMin =
    durationToMinutes(firstSlice?.duration) ??
    durationToMinutes(segments[0]?.duration)

  const cashPrice = num(offer.total_amount)
  const taxes = num(offer.tax_amount)
  const roundTrip = (offer.slices?.length ?? 0) > 1 || Boolean(params.return)

  const value = cpp(cashPrice, taxes, 0) // cash option: no miles, cpp undefined

  return {
    id: offer.id ?? `duffel-${index}`,
    kind: 'cash',
    airline,
    airlineCode,
    route: `${origin} → ${destination}`,
    date: displayDate(segments[0]?.departing_at, params.depart),
    durationMin,
    direct: segments.length <= 1,
    cashPrice,
    taxes,
    roundTrip,
    cpp: value,
    tier: tier(value),
    bookingUrl: cashBookingUrl(params),
  }
}

export async function searchCash(params: SearchParams): Promise<ApiResult<FlightOption[]>> {
  if (!hasEnv('DUFFEL_API_KEY_LIVE')) {
    return { ok: false, reason: 'Duffel API key not configured' }
  }

  const cacheKey = `hop:search:cash:${params.from.toUpperCase()}:${params.to.toUpperCase()}:${params.depart}:${params.return || 'one-way'}:${params.cabin || 'economy'}:${params.adults || 1}:${params.children || 0}:${params.infants || 0}`

  const [cached, rateLimited] = await Promise.all([
    cacheGet<ApiResult<FlightOption[]>>(cacheKey),
    cacheGet<boolean>(RATE_LIMIT_KEY),
  ])
  if (cached !== null && cached.ok) return cached
  if (rateLimited !== null) {
    return { ok: false, reason: 'Duffel 429 cooldown' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  // Build slices: outbound + return (if round-trip).
  const slices: Array<{ origin: string; destination: string; departure_date: string }> = [
    { origin: params.from, destination: params.to, departure_date: params.depart },
  ]
  if (params.return) {
    slices.push({ origin: params.to, destination: params.from, departure_date: params.return })
  }

  const body = {
    data: {
      slices,
      passengers: buildPassengers(params),
      cabin_class: duffelCabinClass(params.cabin),
    },
  }

  try {
    const res = await fetch(`${DUFFEL_BASE}/air/offer_requests?return_offers=true`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.duffelApiKey()}`,
        'Duffel-Version': DUFFEL_VERSION,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      if (res.status === 429) {
        await cacheSet(RATE_LIMIT_KEY, true, rateLimitCooldownSec(res.headers))
      }
      return { ok: false, reason: `Duffel responded ${res.status}` }
    }

    const json = (await res.json()) as DuffelOfferRequestResponse
    const offers = json.data?.offers ?? []
    const options = offers.map((offer, i) => normalizeDuffelOffer(offer, params, i))
    const result: ApiResult<FlightOption[]> = { ok: true, data: options }
    await cacheSet(cacheKey, result, 300)
    return result
  } catch (err) {
    const reason =
      err instanceof Error && err.name === 'AbortError'
        ? 'Duffel request timed out'
        : 'Duffel request failed'
    return { ok: false, reason }
  } finally {
    clearTimeout(timer)
  }
}
