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
//     US–Japan award-tax band so cpp is not optimistic. Missing tax → no row.
//
// THESIS: miles and taxes are table facts. cpp is computed later by lib/cpp.ts.
// A "starting at" figure is a saver FLOOR, not today's quote.

import type { ApiResult, FlightOption, SearchParams } from '@/lib/types'
import { airportByCode, cityForCode } from '@/lib/airports'
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
} as const

type ChartCabin = 'economy' | 'premium' | 'business' | 'first'
type Zone = 'na' | 'pacific' | 'other'

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

// Statute-mile coords for Stage A hubs + destinations. Airport lat/lon
// (not a second geography module). Unknown IATA → no distance-banded row.
const COORDS: Record<string, { lat: number; lon: number }> = {
  SFO: { lat: 37.6189, lon: -122.375 },
  LAX: { lat: 33.9425, lon: -118.4081 },
  JFK: { lat: 40.6413, lon: -73.7781 },
  ORD: { lat: 41.9742, lon: -87.9073 },
  EWR: { lat: 40.6895, lon: -74.1745 },
  SEA: { lat: 47.4502, lon: -122.3088 },
  HNL: { lat: 21.3187, lon: -157.9225 },
  NRT: { lat: 35.7647, lon: 140.3863 },
  HND: { lat: 35.5494, lon: 139.7798 },
  KIX: { lat: 34.4347, lon: 135.2441 },
  ICN: { lat: 37.4602, lon: 126.4407 },
  TPE: { lat: 25.0777, lon: 121.2328 },
  HKG: { lat: 22.308, lon: 113.9185 },
  BKK: { lat: 13.69, lon: 100.7501 },
  SIN: { lat: 1.3644, lon: 103.9915 },
  SYD: { lat: -33.9399, lon: 151.1753 },
}

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
  const rlat1 = (a.lat * Math.PI) / 180
  const rlat2 = (b.lat * Math.PI) / 180
  const dlat = rlat2 - rlat1
  const dlon = ((b.lon - a.lon) * Math.PI) / 180
  const h =
    Math.sin(dlat / 2) ** 2 + Math.cos(rlat1) * Math.cos(rlat2) * Math.sin(dlon / 2) ** 2
  return 2 * EARTH_MI * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function zoneFor(code: string): Zone {
  const country = airportByCode(code)?.country
  if (!country) return 'other'
  if (NA_COUNTRIES.has(country)) return 'na'
  if (PACIFIC_COUNTRIES.has(country)) return 'pacific'
  return 'other'
}

function requestedCabin(params: SearchParams): ChartCabin {
  return params.cabin ?? 'economy'
}

function milesForBand(band: DistanceBand, cabin: ChartCabin): number | undefined {
  if (cabin === 'economy') return band.economy
  if (cabin === 'premium') return band.premium
  if (cabin === 'business') return band.business
  return band.first
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

  return { ok: true, data }
}
