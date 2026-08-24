// lib/award-charts.ts — committed published saver tables. Do not invent miles
// or taxes. Transcribed from each program's own public page (not seats.aero,
// not a third-party award blog). The live site never fetches these pages.
//
// Sources (as-of 2026-08-22):
//   Alaska NA own-metal:
//     https://www.alaskaair.com/content/mileage-plan/use-miles/award-charts
//   Aeroplan (chart effective 2026-06-01; news page + redeem page):
//     https://www.aircanada.com/ca/en/aco/home/aeroplan/news/2026-an-update-on-the-aeroplan-flight-reward-chart.html
//     https://www.aircanada.com/ca/en/aco/home/aeroplan/redeem/air-canada.html
//   Taxes: conservative bands. Domestic = TSA Sept 11 Security Fee ($5.60
//     one-way) plus US flight-segment tax, rounded up. Pacific = a high
//     US–Japan award-tax band so cpp is not optimistic. Atlantic = a high
//     US–Europe award-tax band for the same reason. Missing tax → no row.
//   Distance: great-circle from committed OurAirports lat/lon
//     (lib/airport-coords.json; scripts/gen-airport-coords.mjs). Unknown
//     IATA → no row. Duffel does not search award inventory.
//
// THESIS: miles and taxes are table facts. cpp is computed later by lib/cpp.ts.
// A "starting at" figure is a saver FLOOR, not today's quote.

import type { ApiResult, FlightOption, SearchParams } from '@/lib/types'
import { airportByCode, cityForCode } from '@/lib/airports'
import rawCoords from '@/lib/airport-coords.json'
import { pointsBookingUrl } from '@/lib/booking'
import { tier } from '@/lib/cpp'

export const CHART_AS_OF = '2026-08-22'

export const CHART_NOTE =
  'Published saver floor. Space not confirmed.'

export const EMPTY_CHART_COPY = 'No published saver chart for this route.'

/** Conservative one-way taxes (USD). Higher than typical saver so cpp is not optimistic. */
export const TAX_USD = {
  usDomestic: 12,
  japanPacific: 80,
  europeAtlantic: 200,
} as const

type ChartCabin = 'economy' | 'premium' | 'business' | 'first'
type Zone = 'na' | 'pacific' | 'atlantic' | 'other'

interface DistanceBand {
  min: number
  max: number
  economy: number
  premium?: number
  business?: number
  first?: number
}

// Alaska / Hawaiian own-metal within North America. Published "starting at".
const ALASKA_NA_OWN: DistanceBand[] = [
  { min: 0, max: 700, economy: 4500, first: 15000 },
  { min: 701, max: 1400, economy: 7500, first: 25000 },
  { min: 1401, max: 2100, economy: 10000, first: 25000 },
  { min: 2101, max: 3500, economy: 12500, first: 30000 },
  { min: 3501, max: Infinity, economy: 20000, first: 60000 },
]

// Aeroplan within North America — Air Canada / select-partner starting-at (economy).
const AEROPLAN_NA: DistanceBand[] = [
  { min: 0, max: 500, economy: 6000, premium: 10000, business: 15000 },
  { min: 501, max: 1500, economy: 10000, premium: 15000, business: 20000 },
  { min: 1501, max: 2750, economy: 12500, premium: 20000, business: 25000 },
  { min: 2751, max: Infinity, economy: 17500, premium: 30000, business: 35000 },
]

// Aeroplan North America ↔ Pacific — AC / select-partner starting-at.
const AEROPLAN_NA_PACIFIC: DistanceBand[] = [
  { min: 0, max: 5000, economy: 32500, premium: 45000, business: 55000, first: 90000 },
  { min: 5001, max: 7500, economy: 45000, premium: 60000, business: 85000, first: 110000 },
  { min: 7501, max: 11000, economy: 50000, premium: 85000, business: 85000, first: 130000 },
  { min: 11001, max: Infinity, economy: 70000, premium: 95000, business: 105000, first: 150000 },
]

// Aeroplan North America ↔ Atlantic (Europe / Africa / Middle East / India).
// Official June 2026 news page. Where "starting at" and partner fixed
// prices diverge, use the higher partner figure so cpp is not optimistic.
// Premium cells omitted — official news page did not publish them.
const AEROPLAN_NA_ATLANTIC: DistanceBand[] = [
  { min: 0, max: 4000, economy: 32500, business: 60000, first: 90000 },
  { min: 4001, max: 6000, economy: 42500, business: 75000, first: 120000 },
  { min: 6001, max: 8000, economy: 60000, business: 90000, first: 150000 },
  { min: 8001, max: Infinity, economy: 75000, business: 110000, first: 165000 },
]

// Statute-mile coords. OurAirports CC0, fetch-once. Unknown IATA → no row.
const COORDS = rawCoords as Record<string, number[]>

const NA_COUNTRIES = new Set([
  'US',
  'CA',
  'MX',
  'PR',
  'VI',
  'BS',
  'JM',
  'CU',
  'DO',
  'HT',
  'TT',
  'BB',
  'KY',
  'AW',
  'CW',
  'SX',
  'TC',
  'AG',
  'LC',
  'GD',
  'VC',
  'KN',
  'DM',
  'MQ',
  'GP',
  'BQ',
  'BL',
  'MF',
])

// Official Aeroplan Atlantic: Europe, Africa, Middle East, India.
const ATLANTIC_COUNTRIES = new Set([
  'AD', 'AL', 'AT', 'BA', 'BE', 'BG', 'BY', 'CH', 'CY', 'CZ', 'DE', 'DK',
  'EE', 'ES', 'FI', 'FR', 'GB', 'GI', 'GR', 'HR', 'HU', 'IE', 'IS', 'IT',
  'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL',
  'PT', 'RO', 'RS', 'SE', 'SI', 'SK', 'SM', 'UA', 'VA', 'XK',
  'AO', 'BF', 'BI', 'BJ', 'BW', 'CD', 'CF', 'CG', 'CI', 'CM', 'CV', 'DJ',
  'DZ', 'EG', 'EH', 'ER', 'ET', 'GA', 'GH', 'GM', 'GN', 'GQ', 'GW', 'KE',
  'KM', 'LR', 'LS', 'LY', 'MA', 'MG', 'ML', 'MR', 'MU', 'MW', 'MZ', 'NA',
  'NE', 'NG', 'RE', 'RW', 'SC', 'SD', 'SH', 'SL', 'SN', 'SO', 'SS', 'ST',
  'SZ', 'TD', 'TG', 'TN', 'TZ', 'UG', 'YT', 'ZA', 'ZM', 'ZW',
  'AE', 'BH', 'IL', 'IQ', 'IR', 'JO', 'KW', 'LB', 'OM', 'PS', 'QA', 'SA',
  'SY', 'TR', 'YE',
  'IN',
])

const PACIFIC_COUNTRIES = new Set([
  'JP',
  'KR',
  'CN',
  'HK',
  'TW',
  'MO',
  'TH',
  'VN',
  'KH',
  'LA',
  'MM',
  'MY',
  'SG',
  'ID',
  'PH',
  'BN',
  'MN',
  'AU',
  'NZ',
  'FJ',
  'PG',
  'NC',
  'PF',
  'GU',
  'MP',
  'WS',
  'TO',
  'VU',
  'SB',
])

const EARTH_MI = 3958.7613

export function greatCircleMiles(from: string, to: string): number | undefined {
  const a = COORDS[from.toUpperCase()]
  const b = COORDS[to.toUpperCase()]
  if (!a || !b) return undefined
  const rlat1 = (a[0] * Math.PI) / 180
  const rlat2 = (b[0] * Math.PI) / 180
  const dlat = rlat2 - rlat1
  const dlon = ((b[1] - a[1]) * Math.PI) / 180
  const h =
    Math.sin(dlat / 2) ** 2 + Math.cos(rlat1) * Math.cos(rlat2) * Math.sin(dlon / 2) ** 2
  return 2 * EARTH_MI * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function zoneFor(code: string): Zone {
  const country = airportByCode(code)?.country
  if (!country) return 'other'
  if (NA_COUNTRIES.has(country)) return 'na'
  if (PACIFIC_COUNTRIES.has(country)) return 'pacific'
  if (ATLANTIC_COUNTRIES.has(country)) return 'atlantic'
  return 'other'
}

function requestedCabin(params: SearchParams): ChartCabin {
  return params.cabin ?? 'economy'
}

function milesForBand(band: DistanceBand, cabin: ChartCabin): number | undefined {
  // Exact cabin only. A missing cell is "no published saver," not a
  // neighboring cabin's miles relabeled as the request.
  return band[cabin]
}

function lookupBand(bands: DistanceBand[], miles: number, cabin: ChartCabin): number | undefined {
  const band = bands.find((b) => miles >= b.min && miles <= b.max)
  return band ? milesForBand(band, cabin) : undefined
}

function taxFor(fromZone: Zone, toZone: Zone): number | undefined {
  if (fromZone === 'na' && toZone === 'na') return TAX_USD.usDomestic
  if (
    (fromZone === 'na' && toZone === 'pacific') ||
    (fromZone === 'pacific' && toZone === 'na')
  ) {
    return TAX_USD.japanPacific
  }
  if (
    (fromZone === 'na' && toZone === 'atlantic') ||
    (fromZone === 'atlantic' && toZone === 'na')
  ) {
    return TAX_USD.europeAtlantic
  }
  return undefined
}

const CABIN_LABEL: Record<ChartCabin, string> = {
  economy: 'Economy',
  premium: 'Premium Economy',
  business: 'Business',
  first: 'First',
}

function option(args: {
  id: string
  airline: string
  airlineCode: string
  program: string
  params: SearchParams
  miles: number
  taxes: number
  cabin: ChartCabin
}): FlightOption {
  const from = args.params.from.toUpperCase()
  const to = args.params.to.toUpperCase()
  return {
    id: args.id,
    kind: 'award',
    airline: args.airline,
    airlineCode: args.airlineCode,
    program: args.program,
    route: `${from} → ${to}`,
    date: 'Chart',
    originCode: from,
    destCode: to,
    originCity: cityForCode(from),
    destCity: cityForCode(to),
    cabin: CABIN_LABEL[args.cabin],
    fareBrand: 'Saver floor',
    miles: args.miles,
    taxes: args.taxes,
    tier: tier(undefined),
    availability: 'chart',
    note: CHART_NOTE,
    bookingUrl: pointsBookingUrl({ airlineCode: args.airlineCode, program: args.program }),
  }
}

/** One undated quote per program that has a published band + tax for this pair. */
export function quoteChart(params: SearchParams): ApiResult<FlightOption[]> {
  const from = params.from?.trim().toUpperCase() ?? ''
  const to = params.to?.trim().toUpperCase() ?? ''
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || from === to) {
    return { ok: true, data: [] }
  }

  const distance = greatCircleMiles(from, to)
  if (distance == null) return { ok: true, data: [] }

  const fromZone = zoneFor(from)
  const toZone = zoneFor(to)
  const taxes = taxFor(fromZone, toZone)
  if (taxes == null) return { ok: true, data: [] }

  const cabin = requestedCabin(params)
  const data: FlightOption[] = []

  if (fromZone === 'na' && toZone === 'na') {
    const alaskaMiles = lookupBand(ALASKA_NA_OWN, distance, cabin)
    if (alaskaMiles != null) {
      data.push(
        option({
          id: `chart-as-${from}-${to}`,
          airline: 'Alaska Atmos',
          airlineCode: 'AS',
          program: 'Alaska Atmos Rewards',
          params,
          miles: alaskaMiles,
          taxes,
          cabin,
        }),
      )
    }
    const acMiles = lookupBand(AEROPLAN_NA, distance, cabin)
    if (acMiles != null) {
      data.push(
        option({
          id: `chart-ac-${from}-${to}`,
          airline: 'Air Canada',
          airlineCode: 'AC',
          program: 'Air Canada Aeroplan',
          params,
          miles: acMiles,
          taxes,
          cabin,
        }),
      )
    }
  }

  if (
    (fromZone === 'na' && toZone === 'pacific') ||
    (fromZone === 'pacific' && toZone === 'na')
  ) {
    const acMiles = lookupBand(AEROPLAN_NA_PACIFIC, distance, cabin)
    if (acMiles != null) {
      data.push(
        option({
          id: `chart-ac-${from}-${to}`,
          airline: 'Air Canada',
          airlineCode: 'AC',
          program: 'Air Canada Aeroplan',
          params,
          miles: acMiles,
          taxes,
          cabin,
        }),
      )
    }
  }

  if (
    (fromZone === 'na' && toZone === 'atlantic') ||
    (fromZone === 'atlantic' && toZone === 'na')
  ) {
    const acMiles = lookupBand(AEROPLAN_NA_ATLANTIC, distance, cabin)
    if (acMiles != null) {
      data.push(
        option({
          id: `chart-ac-${from}-${to}`,
          airline: 'Air Canada',
          airlineCode: 'AC',
          program: 'Air Canada Aeroplan',
          params,
          miles: acMiles,
          taxes,
          cabin,
        }),
      )
    }
  }

  return { ok: true, data }
}
