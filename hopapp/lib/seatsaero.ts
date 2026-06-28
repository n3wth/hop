// Seats.aero award-availability client. Queries the Partner API cached search
// and normalizes records to the shared FlightOption model. NEVER throws.
//
// FIELD-MAPPING ASSUMPTIONS (verify against live responses — see report):
//   - Response is { data: AvailabilityRecord[] }.
//   - Each record has a `Route` object { OriginAirport, DestinationAirport,
//     Source } plus a top-level `Date` and `Source` (program slug).
//   - Economy availability + cost live in YAvailable / YMileageCost /
//     YTotalTaxes (cents) / TaxesCurrency. We read the cheapest available
//     cabin, preferring economy.

import type { ApiResult, FlightOption, SearchParams } from '@/lib/types'
import { env, hasEnv } from '@/lib/env'
import { tier } from '@/lib/cpp'
import { pointsBookingUrl } from '@/lib/booking'

const SEATS_AERO_BASE = 'https://seats.aero/partnerapi'
const TIMEOUT_MS = 10_000

// --- Seats.aero response shapes (partial; defensive) ------------------------
interface SeatsAeroRoute {
  OriginAirport?: string
  DestinationAirport?: string
  Source?: string
}
interface SeatsAeroRecord {
  ID?: string
  Route?: SeatsAeroRoute
  Date?: string
  Source?: string
  // economy
  YAvailable?: boolean
  YMileageCost?: string | number
  YTotalTaxes?: string | number // minor units (cents) per Partner API
  // premium econ
  WAvailable?: boolean
  WMileageCost?: string | number
  WTotalTaxes?: string | number
  // business
  JAvailable?: boolean
  JMileageCost?: string | number
  JTotalTaxes?: string | number
  TaxesCurrency?: string
}
interface SeatsAeroResponse {
  data?: SeatsAeroRecord[]
}

// Map Seats.aero `Source` program slug -> display name + IATA-ish code.
const PROGRAM_META: Record<string, { program: string; airline: string; code: string }> = {
  alaska: { program: 'Alaska Atmos Rewards', airline: 'Alaska Atmos', code: 'AS' },
  united: { program: 'United MileagePlus', airline: 'United', code: 'UA' },
  aeroplan: { program: 'Air Canada Aeroplan', airline: 'Air Canada', code: 'AC' },
  delta: { program: 'Delta SkyMiles', airline: 'Delta', code: 'DL' },
  american: { program: 'American AAdvantage', airline: 'American', code: 'AA' },
  jetblue: { program: 'JetBlue TrueBlue', airline: 'JetBlue', code: 'B6' },
  southwest: { program: 'Southwest Rapid Rewards', airline: 'Southwest', code: 'WN' },
  velocity: { program: 'Virgin Australia Velocity', airline: 'Virgin Australia', code: 'VA' },
  virginatlantic: { program: 'Virgin Atlantic Flying Club', airline: 'Virgin Atlantic', code: 'VS' },
  emirates: { program: 'Emirates Skywards', airline: 'Emirates', code: 'EK' },
  etihad: { program: 'Etihad Guest', airline: 'Etihad', code: 'EY' },
  qantas: { program: 'Qantas Frequent Flyer', airline: 'Qantas', code: 'QF' },
}

function toNumber(value: string | number | undefined): number {
  if (value == null) return 0
  const n = typeof value === 'number' ? value : parseFloat(value)
  return isNaN(n) ? 0 : n
}

function programMeta(source?: string): { program: string; airline: string; code?: string } {
  const slug = (source ?? '').toLowerCase().trim()
  return PROGRAM_META[slug] ?? { program: source ?? 'Award', airline: source ?? 'Award' }
}

// Pick the cheapest AVAILABLE cabin, preferring economy. Taxes are minor units.
function pickCabin(
  rec: SeatsAeroRecord,
): { miles: number; taxesMinor: number } | undefined {
  const cabins: Array<{ available?: boolean; miles?: string | number; taxes?: string | number }> = [
    { available: rec.YAvailable, miles: rec.YMileageCost, taxes: rec.YTotalTaxes },
    { available: rec.WAvailable, miles: rec.WMileageCost, taxes: rec.WTotalTaxes },
    { available: rec.JAvailable, miles: rec.JMileageCost, taxes: rec.JTotalTaxes },
  ]
  for (const c of cabins) {
    const miles = toNumber(c.miles)
    if (c.available && miles > 0) {
      return { miles, taxesMinor: toNumber(c.taxes) }
    }
  }
  // Fall back to any positive mileage cost even if availability flag absent.
  for (const c of cabins) {
    const miles = toNumber(c.miles)
    if (miles > 0) return { miles, taxesMinor: toNumber(c.taxes) }
  }
  return undefined
}

function displayDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function normalizeSeatsAeroRecord(
  rec: SeatsAeroRecord,
  params: SearchParams,
  index: number,
): FlightOption | undefined {
  const cabin = pickCabin(rec)
  if (!cabin) return undefined

  const source = rec.Source ?? rec.Route?.Source
  const meta = programMeta(source)
  const origin = rec.Route?.OriginAirport ?? params.from
  const destination = rec.Route?.DestinationAirport ?? params.to
  // Partner API taxes are minor units (cents) -> dollars.
  const taxes = Math.round((cabin.taxesMinor / 100) * 100) / 100

  return {
    id: rec.ID ?? `seatsaero-${index}`,
    kind: 'award',
    airline: meta.airline,
    airlineCode: meta.code,
    program: meta.program,
    route: `${origin} → ${destination}`,
    date: displayDate(rec.Date) || displayDate(params.depart),
    miles: cabin.miles,
    taxes,
    // cpp needs a cash comparison the assembler supplies later; leave undefined here.
    tier: tier(undefined),
    bookingUrl: pointsBookingUrl({ airlineCode: meta.code, program: meta.program }),
  }
}

export async function searchAwards(params: SearchParams): Promise<ApiResult<FlightOption[]>> {
  if (!hasEnv('SEATS_AERO_API_KEY')) {
    return { ok: false, reason: 'Seats.aero API key not configured' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  const query = new URLSearchParams({
    origin_airport: params.from.trim().toUpperCase(),
    destination_airport: params.to.trim().toUpperCase(),
    start_date: params.depart,
    end_date: params.return ?? params.depart,
    take: '50',
  })

  try {
    const res = await fetch(`${SEATS_AERO_BASE}/search?${query.toString()}`, {
      method: 'GET',
      headers: {
        'Partner-Authorization': env.seatsAeroApiKey(),
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    if (!res.ok) {
      return { ok: false, reason: `Seats.aero responded ${res.status}` }
    }

    const json = (await res.json()) as SeatsAeroResponse
    const records = json.data ?? []
    const options = records
      .map((rec, i) => normalizeSeatsAeroRecord(rec, params, i))
      .filter((o): o is FlightOption => o !== undefined)
    return { ok: true, data: options }
  } catch (err) {
    const reason =
      err instanceof Error && err.name === 'AbortError'
        ? 'Seats.aero request timed out'
        : 'Seats.aero request failed'
    return { ok: false, reason }
  } finally {
    clearTimeout(timer)
  }
}
