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
  YTotalTaxes?: string | number // VERIFIED: minor units (cents), e.g. 560 = $5.60
  YAirlines?: string // VERIFIED: operating carrier IATA code(s), e.g. "UA"
  // premium econ
  WAvailable?: boolean
  WMileageCost?: string | number
  WTotalTaxes?: string | number
  WAirlines?: string
  // business
  JAvailable?: boolean
  JMileageCost?: string | number
  JTotalTaxes?: string | number
  JAirlines?: string
  TaxesCurrency?: string
}
interface SeatsAeroResponse {
  data?: SeatsAeroRecord[]
}

// Map Seats.aero `Source` program slug -> display name + IATA-ish code.
// Slugs observed live on SFO-LAX: aeroplan, alaska, american, azul, delta,
// frontier, jetblue, qantas, smiles, united, velocity. The per-cabin
// `*Airlines` field carries the true operating carrier code and is preferred
// when present; this map supplies the program/display name + a code fallback.
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
  azul: { program: 'Azul TudoAzul', airline: 'Azul', code: 'AD' },
  frontier: { program: 'Frontier Miles', airline: 'Frontier', code: 'F9' },
  smiles: { program: 'GOL Smiles', airline: 'GOL', code: 'G3' },
}

// Title-case an unmapped program slug for display, e.g. "azul" -> "Azul".
function titleCase(slug: string): string {
  return slug
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

function toNumber(value: string | number | undefined): number {
  if (value == null) return 0
  const n = typeof value === 'number' ? value : parseFloat(value)
  return isNaN(n) ? 0 : n
}

function programMeta(source?: string): { program: string; airline: string; code?: string } {
  const slug = (source ?? '').toLowerCase().trim()
  if (PROGRAM_META[slug]) return PROGRAM_META[slug]
  const display = slug ? titleCase(slug) : 'Award'
  return { program: display, airline: display }
}

// Parse an `*Airlines` field ("UA" or "AA, AS") into IATA codes.
function parseAirlineCodes(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter((c) => c.length >= 2)
}

// Resolve a single display code from the operating-airline list. Award space is
// often sold on multiple carriers (e.g. Alaska award on "AA, AS"). Prefer the
// program's OWN carrier when it's in the list — that's the cleanest brand match
// for the monogram tile — otherwise fall back to the first listed carrier (a
// genuine partner booking, e.g. JetBlue award flown on UA metal).
function resolveAirlineCode(codes: string[], programCode?: string): string | undefined {
  if (codes.length === 0) return undefined
  if (programCode && codes.includes(programCode)) return programCode
  return codes[0]
}

// Display label per Seats.aero cabin key — surfaced on the option so the prefs
// model (lib/prefs-model.cabinRank) and the UI can read the served cabin tier.
const CABIN_LABEL: Record<string, string> = {
  Y: 'Economy',
  W: 'Premium Economy',
  J: 'Business',
}

// Map our requested-cabin enum to the Seats.aero cabin key. Seats.aero exposes
// Y/W/J (no first); 'first' falls through to business as the nearest premium.
function requestedCabinKey(cabin: SearchParams['cabin']): 'Y' | 'W' | 'J' {
  switch (cabin) {
    case 'premium':
      return 'W'
    case 'business':
    case 'first':
      return 'J'
    default:
      return 'Y'
  }
}

// Pick an AVAILABLE cabin. With no requested cabin, prefers the cheapest tier
// (economy first). When a cabin IS requested, that tier is tried first so the
// served option matches the search; if it isn't available we fall through to
// the other tiers (never drop the record). Returns mileage cost, taxes (minor
// units / cents), the operating carrier code list, and the served cabin key.
function pickCabin(
  rec: SeatsAeroRecord,
  requested?: SearchParams['cabin'],
): { miles: number; taxesMinor: number; airlineCodes: string[]; cabinKey: string } | undefined {
  const byKey: Record<'Y' | 'W' | 'J', {
    available?: boolean
    miles?: string | number
    taxes?: string | number
    airlines?: string
  }> = {
    Y: { available: rec.YAvailable, miles: rec.YMileageCost, taxes: rec.YTotalTaxes, airlines: rec.YAirlines },
    W: { available: rec.WAvailable, miles: rec.WMileageCost, taxes: rec.WTotalTaxes, airlines: rec.WAirlines },
    J: { available: rec.JAvailable, miles: rec.JMileageCost, taxes: rec.JTotalTaxes, airlines: rec.JAirlines },
  }
  // Requested cabin first (when set), then the remaining tiers cheapest-first.
  const order: Array<'Y' | 'W' | 'J'> = requested
    ? [requestedCabinKey(requested), ...(['Y', 'W', 'J'] as const).filter((k) => k !== requestedCabinKey(requested))]
    : ['Y', 'W', 'J']

  for (const key of order) {
    const c = byKey[key]
    const miles = toNumber(c.miles)
    if (c.available && miles > 0) {
      return { miles, taxesMinor: toNumber(c.taxes), airlineCodes: parseAirlineCodes(c.airlines), cabinKey: key }
    }
  }
  // Fall back to any positive mileage cost even if availability flag absent.
  for (const key of order) {
    const c = byKey[key]
    const miles = toNumber(c.miles)
    if (miles > 0) {
      return { miles, taxesMinor: toNumber(c.taxes), airlineCodes: parseAirlineCodes(c.airlines), cabinKey: key }
    }
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
  const cabin = pickCabin(rec, params.cabin)
  if (!cabin) return undefined

  const source = rec.Source ?? rec.Route?.Source
  const meta = programMeta(source)
  const origin = rec.Route?.OriginAirport ?? params.from
  const destination = rec.Route?.DestinationAirport ?? params.to
  // Partner API taxes are minor units (cents) -> dollars.
  const taxes = Math.round((cabin.taxesMinor / 100) * 100) / 100
  // Prefer the program's own carrier when it operates this cabin; else the
  // partner metal; else fall back to the slug-derived code.
  const airlineCode = resolveAirlineCode(cabin.airlineCodes, meta.code) ?? meta.code

  return {
    id: rec.ID ?? `seatsaero-${index}`,
    kind: 'award',
    airline: meta.airline,
    airlineCode,
    program: meta.program,
    route: `${origin} → ${destination}`,
    date: displayDate(rec.Date) || displayDate(params.depart),
    cabin: CABIN_LABEL[cabin.cabinKey],
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
