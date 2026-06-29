// Duffel cash-flight client. Searches the Duffel Air API and normalizes
// offers to the shared FlightOption model. NEVER throws — returns ApiResult.

import type { ApiResult, FlightOption, SearchParams } from '@/lib/types'
import { env, hasEnv, isCheckoutEnabled } from '@/lib/env'
import { cpp, tier } from '@/lib/cpp'
import { cashBookingUrl } from '@/lib/booking'

const DUFFEL_BASE = 'https://api.duffel.com'
const DUFFEL_VERSION = 'v2'
const TIMEOUT_MS = 10_000

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
      passengers: Array.from({ length: Math.max(1, params.adults || 1) }, () => ({
        type: 'adult',
      })),
      cabin_class: 'economy',
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
      return { ok: false, reason: `Duffel responded ${res.status}` }
    }

    const json = (await res.json()) as DuffelOfferRequestResponse
    const offers = json.data?.offers ?? []
    const options = offers.map((offer, i) => normalizeDuffelOffer(offer, params, i))
    return { ok: true, data: options }
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
