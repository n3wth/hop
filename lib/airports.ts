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

// Rank: exact code > code prefix > city prefix > city/name substring > code
// substring. Within an equal match tier, the larger airport (OurAirports'
// large/medium/small classification) sorts first, so typing "sa" surfaces SFO
// before a same-tier small strip whose city also starts with "Sa". Ties within
// that are broken alphabetically by code for a stable, predictable order.
export function searchAirports(query: string, limit = 6): Airport[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...AIRPORTS].sort((a, b) => b.size - a.size || a.code.localeCompare(b.code)).slice(0, limit)
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
    .sort((x, y) => y.score - x.score || y.a.size - x.a.size || x.a.code.localeCompare(y.a.code))
  return scored.slice(0, limit).map((s) => s.a)
}

// "San Francisco" display for a code, falling back to the code itself.
export function cityForCode(code: string): string {
  return airportByCode(code)?.city ?? code
}
