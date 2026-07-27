// Agentic concierge tools (Vercel AI SDK). The concierge streams + uses tools to
// fetch LIVE world-context, and — crucially — to QUOTE POINTS ECONOMICS. Two
// tools do this, for two different questions:
//   - price_trip runs against hop's curated destinations dataset (computeCpp +
//     destinationByCode + effectiveBalanceFor) — fast, no live lookup, good for
//     "where should I go" ideation across hop's ~30 inspiration destinations.
//   - search_flights runs verdictSummary — the SAME assembleSearch call /search
//     makes (Duffel cash + seats.aero awards, live, for the exact route/dates
//     asked) — for a real, bookable verdict on ANY route, not just the curated
//     list. This is what makes the LLM concierge and the plain /search page
//     agree: one engine, two front doors.
// Either way the model NEVER invents miles, CPP, or affordability — it reads
// them from a tool call.
//
// Pure helpers (parseWeather, priceTrip) are unit-tested in
// lib/__tests__/concierge-tools.test.ts without touching the network.

import { tool, gateway } from 'ai'
import { z } from 'zod'
import { computeCpp, destinationByCode } from '@/lib/destinations'
import { POINTS_THRESHOLD_CPP, verdictSummary } from '@/lib/search'
import { clampTravelDates } from '@/lib/travel-dates'
import { effectiveBalanceFor } from '@/lib/transfers'
import type { Balance } from '@/lib/types'
import { CABINS } from '@/lib/prefs-model'
import { TRAVEL_PARTIES, validateProfile, type TravelProfile } from '@/lib/travel-profile-model'
import { saveProfileFact } from '@/lib/travel-profile'
import { cacheWrap } from './cache'

// --- price_trip economics (DETERMINISTIC — hop's engine, never the LLM) -------

export interface PriceTripBalance {
  program: string
  balance: number
}

export interface PriceTripResult {
  code: string
  city: string
  country: string
  region: string
  bestProgram: string
  // Deterministic figures straight from the dataset + engine.
  milesNeeded: number // typical one-way award miles
  cashUsd: number // typical one-way cash
  taxesUsd: number // typical award taxes/fees the redemption still costs
  cabin: 'economy' | 'business' | 'first' // cabin those figures price — never omit for premium
  cpp: number | undefined // cents per point at this redemption (computeCpp)
  // Effective points the user can put toward bestProgram (direct OR transfer).
  youHave: number | undefined
  youHaveVia:
    | { kind: 'direct'; program: string }
    | { kind: 'transfer'; source: string; ratio: string }
    | undefined
  affordable: boolean | undefined // can they book it with points held now?
  verdict: 'points' | 'cash' | 'save' // the one-glance call
}

export interface PriceTripError {
  error: string
  code: string
}

// Run hop's real engine for one destination + the user's balances. This is the
// ONLY way the concierge is allowed to state numbers — everything here is
// computed, not generated. Returns an { error } shape for unknown codes so the
// model can recover gracefully instead of inventing a destination.
export function priceTrip(
  code: string,
  balances: PriceTripBalance[] = [],
): PriceTripResult | PriceTripError {
  const d = destinationByCode(code)
  if (!d) {
    return { error: `No destination with IATA code "${code}" in hop's dataset.`, code }
  }

  // PriceTripBalance -> Balance so transfers.ts can canonicalize + walk the graph.
  const asBalances: Balance[] = balances
    .filter((b) => b && typeof b.program === 'string' && Number.isFinite(b.balance))
    .map((b) => ({ program: b.program, code: '', balance: b.balance }))

  const milesNeeded = d.typicalAwardMiles
  const cashUsd = d.typicalCashUSD
  const cpp = computeCpp(d)
  const eff = effectiveBalanceFor(d.bestProgram, asBalances)
  const youHave = eff?.amount
  const affordable = youHave != null ? youHave >= milesNeeded : undefined
  // Verdict: can't afford → save; strong CPP → points; weak CPP → cash. Uses the
  // SAME threshold as the real engine (lib/search POINTS_THRESHOLD_CPP) so this
  // coarse call never contradicts verdict()/assembleSearch for the same dest.
  const verdict: PriceTripResult['verdict'] =
    affordable === false ? 'save' : cpp != null && cpp >= POINTS_THRESHOLD_CPP ? 'points' : 'cash'

  return {
    code: d.code,
    city: d.city,
    country: d.country,
    region: d.region,
    bestProgram: d.bestProgram,
    milesNeeded,
    cashUsd,
    taxesUsd: d.typicalTaxesUSD,
    cabin: d.cabin ?? 'economy',
    cpp,
    youHave,
    youHaveVia: eff?.via,
    affordable,
    verdict,
  }
}

// --- get_weather (live world-context, open-meteo, no API key) -----------------

// open-meteo geocoding result (only the fields we use).
export interface GeoHit {
  latitude: number
  longitude: number
  name: string
  country?: string
}

// open-meteo monthly climate normals response (subset).
export interface OpenMeteoClimate {
  daily?: {
    time?: string[]
    temperature_2m_max?: Array<number | null>
    temperature_2m_min?: Array<number | null>
    precipitation_sum?: Array<number | null>
  }
}

export interface WeatherSummary {
  place: string
  month: string
  highC: number | undefined
  lowC: number | undefined
  precipMm: number | undefined
  note: string
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Average a list of nullable numbers, rounding to 1dp. Returns undefined when
// there's nothing usable — so the model gets a clean "unknown" rather than NaN.
function avg(values: Array<number | null> | undefined): number | undefined {
  if (!values || values.length === 0) return undefined
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (nums.length === 0) return undefined
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10
}

// Parse open-meteo climate normals into a compact, one-month summary. Pure +
// defensive so it can be unit-tested and never throws on a malformed payload.
export function parseWeather(
  place: string,
  monthIndex: number,
  data: OpenMeteoClimate,
): WeatherSummary {
  const month = MONTHS[monthIndex] ?? 'that month'
  const highC = avg(data.daily?.temperature_2m_max)
  const lowC = avg(data.daily?.temperature_2m_min)
  const precipMm = avg(data.daily?.precipitation_sum)

  const parts: string[] = []
  if (highC != null && lowC != null) {
    parts.push(`typical ${lowC}–${highC}°C`)
  } else if (highC != null) {
    parts.push(`highs near ${highC}°C`)
  }
  if (precipMm != null) {
    parts.push(precipMm >= 5 ? 'wetter than average' : precipMm <= 1 ? 'mostly dry' : 'occasional rain')
  }
  const note = parts.length
    ? `${place} in ${month}: ${parts.join(', ')}.`
    : `No reliable climate data for ${place} in ${month}.`

  return { place, month, highC, lowC, precipMm, note }
}

// Resolve "Month name" / number / undefined to a 0-based month index.
export function monthToIndex(month: string | number | undefined): number {
  if (typeof month === 'number' && month >= 1 && month <= 12) return month - 1
  if (typeof month === 'string') {
    const m = month.trim().toLowerCase()
    const idx = MONTHS.findIndex((name) => name.toLowerCase().startsWith(m.slice(0, 3)))
    if (idx !== -1) return idx
    const n = Number(m)
    if (Number.isFinite(n) && n >= 1 && n <= 12) return n - 1
  }
  // Default to the current month.
  return new Date().getUTCMonth()
}

// Fetch typical weather for a place + month from open-meteo (geocode → climate
// normals). NEVER throws — returns a WeatherSummary with a graceful note on any
// failure so the agent keeps going.
export async function fetchWeather(place: string, monthIndex: number): Promise<WeatherSummary> {
  const key = `hop:weather:${place.toLowerCase().trim()}:${monthIndex}`
  return cacheWrap<WeatherSummary>(key, 604800, async () => {
    const month = MONTHS[monthIndex] ?? 'that month'
    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en&format=json`
      const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(8000) })
      if (!geoRes.ok) throw new Error('geocode failed')
      const geo = (await geoRes.json()) as { results?: GeoHit[] }
      const hit = geo.results?.[0]
      if (!hit) {
        return { place, month, highC: undefined, lowC: undefined, precipMm: undefined, note: `Couldn't locate ${place} for a weather lookup.` }
      }

      // Climate normals for a representative recent year window, sliced to the month.
      const year = new Date().getUTCFullYear() - 1
      const mm = String(monthIndex + 1).padStart(2, '0')
      const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
      const start = `${year}-${mm}-01`
      const end = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`
      const climUrl =
        `https://archive-api.open-meteo.com/v1/archive?latitude=${hit.latitude}&longitude=${hit.longitude}` +
        `&start_date=${start}&end_date=${end}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`
      const climRes = await fetch(climUrl, { signal: AbortSignal.timeout(8000) })
      if (!climRes.ok) throw new Error('climate failed')
      const data = (await climRes.json()) as OpenMeteoClimate
      const label = hit.country ? `${hit.name}, ${hit.country}` : hit.name
      return parseWeather(label, monthIndex, data)
    } catch {
      return { place, month, highC: undefined, lowC: undefined, precipMm: undefined, note: `Weather lookup for ${place} is unavailable right now.` }
    }
  })
}

// --- AI SDK tool definitions --------------------------------------------------

// --- save_profile_fact (MEMORY — persists durable personal facts) ------------

// Validation schema for the patch the model may write. Mirrors TravelProfile,
// but EVERY field is re-clamped by validateProfile before it touches the DB — so
// even though zod gates the shape, a model can never inject unknown fields or
// out-of-range values. Tool input is intentionally permissive (optional) so the
// model can record just the one fact it learned.
const profilePatchSchema = z.object({
  vacationDays: z.number().int().min(0).max(365).optional()
    .describe('Annual vacation days the user has to spend.'),
  travelParty: z.enum(TRAVEL_PARTIES).optional()
    .describe('Who the user usually travels with.'),
  cabin: z.enum(CABINS).optional()
    .describe('Preferred cabin for long trips.'),
  fallbackCabin: z.enum(CABINS).optional()
    .describe('The cabin they settle for when the preferred one is unavailable or not worth it — e.g. "premium economy when not flying business".'),
  preferredAirlines: z.array(z.string()).optional()
    .describe('Airlines the user prefers to fly, e.g. ["Alaska Airlines"]. Added to existing list.'),
  dietary: z.array(z.string()).optional()
    .describe('Dietary needs, e.g. ["vegetarian"]. Added to existing list.'),
  accessibility: z.array(z.string()).optional()
    .describe('Accessibility needs, e.g. ["step-free"]. Added to existing list.'),
  lovedDestinations: z.array(z.string()).optional()
    .describe('Places the user loves. Added to existing list.'),
  avoidedDestinations: z.array(z.string()).optional()
    .describe('Places the user wants to avoid. Added to existing list.'),
})

// Build the save_profile_fact tool, scoped to a user. Returns the merged profile
// so the model can confirm what it remembered. When `userId` is absent
// (signed-out), the tool validates + echoes the patch but does NOT persist —
// memory is session-only for anonymous users. Pure-ish: only side effect is the
// DB upsert via saveProfileFact (which itself never throws).
export function buildSaveProfileFactTool(userId: string | undefined) {
  return tool({
    description:
      "Remember a DURABLE personal fact the user states about themselves for future trips (vacation days, who they travel with, preferred and fallback cabins, airlines they prefer, dietary or accessibility needs, destinations they love or want to avoid). Call this whenever the user reveals such a fact. Do NOT use it for one-off search constraints. Only record facts the user actually stated — never guess.",
    inputSchema: profilePatchSchema,
    execute: async (patch): Promise<{ saved: boolean; profile: TravelProfile }> => {
      const clean = validateProfile(patch)
      if (!userId) return { saved: false, profile: clean }
      const profile = await saveProfileFact(userId, clean)
      return { saved: true, profile }
    },
  })
}

// search_flights args — mirrors lib/mcp-tools.ts's verdictSchema (same shape,
// same engine call) so a route/date verdict never diverges between the MCP
// surface and the in-app concierge.
const searchFlightsSchema = z.object({
  from: z.string().describe('Origin IATA airport code, e.g. "SFO". Use the traveler\'s home airport unless they name a different origin.'),
  to: z.string().describe('Destination IATA airport code, e.g. "FCA". ANY real airport — not limited to hop\'s curated destinations list.'),
  depart: z.string().describe('Departure date, ISO "YYYY-MM-DD".'),
  return: z.string().optional().describe('Return date, ISO "YYYY-MM-DD", for a round trip. Omit for one-way.'),
  adults: z.number().int().min(1).optional().describe('Number of adult passengers (default 1).'),
  children: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Seated children — count them whenever the traveler mentions kids; they scale the party-total pricing (default 0).'),
  infants: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Lap infants — no seat, excluded from pricing (default 0).'),
})

// Build the concierge's tool set. `balances` is closed over so price_trip /
// search_flights run the engine against the CURRENT user's points without the
// model ever seeing or inventing them. web_search is a provider-executed
// gateway tool (Parallel). `userId` (optional) enables the save_profile_fact
// memory tool — when signed out, the tool still validates but persists nothing
// (session-only memory).
export function buildConciergeTools(balances: PriceTripBalance[], userId?: string) {
  return {
    save_profile_fact: buildSaveProfileFactTool(userId),
    // Live world-context: events, seasonality, why fares move at a given time.
    web_search: gateway.tools.parallelSearch({}),

    get_weather: tool({
      description:
        'Get typical/seasonal weather for a destination city in a given month. Use when the user cares about climate, packing, or best time to go.',
      inputSchema: z.object({
        place: z.string().describe('City or place name, e.g. "Tokyo" or "Bali"'),
        month: z
          .union([z.string(), z.number()])
          .optional()
          .describe('Month name ("July") or number (1-12). Defaults to the current month.'),
      }),
      execute: async ({ place, month }) => fetchWeather(place, monthToIndex(month)),
    }),

    price_trip: tool({
      description:
        "Quote hop's DETERMINISTIC points economics for one of hop's curated destinations: miles needed, cash, cents-per-point, what the user effectively has (direct or via transfer), affordability, and the points/cash/save verdict. Fast, no live lookup — good for \"where should I go\" ideation. ALWAYS call this before stating any miles, CPP, or affordability number for a dataset destination — never invent them. For a real, live, date-specific verdict (or any airport outside hop's curated list), use search_flights instead.",
      inputSchema: z.object({
        code: z.string().describe('IATA airport code of a hop destination, e.g. "NRT" for Tokyo'),
      }),
      execute: async ({ code }) => priceTrip(code, balances),
    }),

    search_flights: tool({
      description:
        "Run hop's REAL, LIVE points-vs-cash verdict for a specific route and date — the SAME engine the /search page uses (live Duffel cash fares + seats.aero award space). Use this whenever the user gives (or you know) a specific date, or asks about ANY airport — including ones outside hop's curated destinations list (price_trip only covers those ~30). ALWAYS call this before stating a live miles/cash/CPP figure for a specific date — never invent them. Degraded sections (cash or awards unavailable) are reported honestly — say so, never fill the gap with an invented number.",
      inputSchema: searchFlightsSchema,
      execute: async ({ from, to, depart, return: ret, adults, children, infants }) => {
        // The model resolves relative/year-less dates ("August 12-19") and can
        // land in a PAST year -> Duffel 422 on every call. This was the first
        // real bug the degradation telemetry caught in prod (2026-07-05,
        // search_degraded SEA-FCO "Duffel responded 422", every attempt).
        // Clamp exactly like /api/search does — past dates rise to today.
        const dates = clampTravelDates(depart, ret)
        return verdictSummary(
          {
            from: from.trim().toUpperCase(),
            to: to.trim().toUpperCase(),
            depart: dates.depart,
            return: dates.return,
            adults: Math.max(1, adults ?? 1),
            // Party size drives the engine's total-cost scaling — a family's
            // verdict must be priced for the whole party, not one seat.
            ...(children ? { children: Math.max(0, children) } : {}),
            ...(infants ? { infants: Math.max(0, infants) } : {}),
          },
          balances.map((b) => ({ program: b.program, code: '', balance: b.balance })),
        )
      },
    }),
  }
}
