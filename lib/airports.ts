// Bundled airport list for autocomplete — every airport worldwide with a real
// IATA code (large/medium/small, ~8.8k), sourced from OurAirports' public-domain
// dataset (https://ourairports.com/data/, CC0) and baked in at build time so
// lookups are instant and offline — no external dep, no per-keystroke network
// call. The raw [code, city, name, country, size] tuples live in
// airports-data.json to keep this file's logic readable; `size` is OurAirports'
// large/medium/small classification (3/2/1), used ONLY to break ties in
// searchAirports so major hubs surface first — it never excludes an airport.

import rawAirports from './airports-data.json'

export interface Airport {
  code: string // IATA
  city: string
  name: string
  country: string
  /** Relative size tier (3 large / 2 medium / 1 small) — ranking signal only. */
  size: number
}

type RawAirport = [code: string, city: string, name: string, country: string, size: number]

export const AIRPORTS: Airport[] = (rawAirports as RawAirport[]).map(
  ([code, city, name, country, size]) => ({ code, city, name, country, size }),
)

const byCode = new Map(AIRPORTS.map((a) => [a.code, a]))

export function airportByCode(code: string): Airport | undefined {
  return byCode.get(code.toUpperCase())
}

// Passenger-traffic ordering for the ~100 busiest hop-relevant hubs, in rough
// descending order of annual passengers (ACI World / published 2024 airport
// traffic figures; order is approximate beyond the top ~30). Display-ordering
// signal ONLY: it decides which airports surface first in pickers — it never
// excludes an airport and feeds no economics. Unlisted airports rank after
// every listed one (then size tier, then code, as before).
const HUB_ORDER = [
  // global top ~50 by total passengers
  'ATL', 'DXB', 'DFW', 'HND', 'LHR', 'DEN', 'IST', 'ORD', 'DEL', 'CDG',
  'LAX', 'CAN', 'ICN', 'JFK', 'PVG', 'AMS', 'SIN', 'MAD', 'CLT', 'MCO',
  'LAS', 'PEK', 'MIA', 'BKK', 'SZX', 'FRA', 'BCN', 'CGK', 'SEA', 'IAH',
  'KUL', 'EWR', 'FCO', 'SFO', 'MEX', 'HKG', 'PHX', 'NRT', 'GRU', 'BOS',
  'MUC', 'LGW', 'SYD', 'YYZ', 'BOM', 'DOH', 'JED', 'MNL', 'SGN', 'TFU',
  // remaining US majors, rough traffic order
  'MSP', 'DTW', 'PHL', 'SLC', 'DCA', 'IAD', 'FLL', 'BWI', 'TPA', 'SAN',
  'AUS', 'BNA', 'MDW', 'LGA', 'HNL', 'PDX', 'STL', 'RDU', 'SJC', 'SMF',
  'MSY', 'SJU', 'DAL', 'HOU', 'OAK', 'SNA', 'MCI', 'RSW', 'CLE', 'IND',
  'PIT', 'CVG', 'CMH', 'SAT', 'ANC', 'ABQ', 'JAX', 'BUF', 'ONT', 'BUR',
  // key international hubs travelers actually fly from/to
  'TPE', 'KIX', 'ZRH', 'VIE', 'CPH', 'OSL', 'ARN', 'HEL', 'DUB', 'LIS',
  'ATH', 'MXP', 'BER', 'BRU', 'TLV', 'AUH', 'RUH', 'CAI', 'JNB', 'ADD',
  'YVR', 'YUL', 'YYC', 'CUN', 'GDL', 'MTY', 'PTY', 'BOG', 'LIM', 'SCL',
  'EZE', 'GIG', 'AKL', 'MEL', 'BNE', 'PER', 'DPS', 'HKT', 'BLR', 'HYD',
]
const HUB_RANK = new Map(HUB_ORDER.map((code, i) => [code, i]))
const rankOf = (a: Airport) => HUB_RANK.get(a.code) ?? HUB_ORDER.length

// Rank: exact code > code prefix > city prefix > city/name substring > code
// substring. Within an equal match tier, busier airports (HUB_ORDER traffic
// ranking) sort first — typing "chicago" surfaces ORD before MDW — then the
// larger airport (OurAirports' large/medium/small classification), so ranked
// hubs never lose to an alphabetically-earlier peer. Remaining ties break
// alphabetically by code for a stable, predictable order. An empty query
// returns the busiest hubs, not the alphabetically-first large airports.
export function searchAirports(query: string, limit = 6): Airport[] {
  const q = query.trim().toLowerCase()
  if (!q)
    return [...AIRPORTS]
      .sort((a, b) => rankOf(a) - rankOf(b) || b.size - a.size || a.code.localeCompare(b.code))
      .slice(0, limit)
  const scored = AIRPORTS.map((a) => {
    const code = a.code.toLowerCase()
    const city = a.city.toLowerCase()
    const name = a.name.toLowerCase()
    let score = -1
    if (code === q) score = 100
    else if (code.startsWith(q)) score = 80
    else if (city.startsWith(q)) score = 60
    else if (city.includes(q)) score = 40
    else if (name.includes(q)) score = 20
    else if (code.includes(q)) score = 10
    return { a, score }
  })
    .filter((s) => s.score >= 0)
    .sort(
      (x, y) =>
        y.score - x.score || rankOf(x.a) - rankOf(y.a) || y.a.size - x.a.size || x.a.code.localeCompare(y.a.code),
    )
  return scored.slice(0, limit).map((s) => s.a)
}

// "San Francisco" display for a code, falling back to the code itself.
export function cityForCode(code: string): string {
  return airportByCode(code)?.city ?? code
}
