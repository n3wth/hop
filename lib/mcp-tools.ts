// MCP tool handlers — the "Add to Claude" surface. These are THIN, PURE wrappers
// over hop's existing deterministic engine (lib/search, lib/destinations,
// lib/transfers, lib/concierge-tools). They introduce NO new economics: every
// number comes from the engine, never from this layer and never from an LLM.
//
// Each handler returns a plain JS object that the route handler serializes into
// the MCP text-content envelope. Keeping them pure makes them unit-testable
// without spinning up the HTTP/MCP transport (see lib/__tests__/mcp-tools.test.ts).

import { z } from 'zod'
import { computeCpp, topValue } from '@/lib/destinations'
import { priceTrip, type PriceTripBalance } from '@/lib/concierge-tools'
import { assembleSearch, verdictSummary } from '@/lib/search'
import { canonicalizeProgram, programById, listTransferablePrograms } from '@/lib/programs'
import { partnersOf, transfersTo, effectiveBalanceFor } from '@/lib/transfers'
import type { Balance, FlightOption } from '@/lib/types'

// Shared balances input: a list of { program, balance }. `program` is free-text
// and canonicalized downstream by the engine, so callers can pass "Amex MR",
// "Chase Ultimate Rewards", "United", etc.
export const balanceInputSchema = z
  .array(
    z.object({
      program: z.string().describe('Loyalty/bank program name, e.g. "Amex MR", "United".'),
      balance: z.number().describe('Points/miles currently held in that program.'),
    }),
  )
  .describe('Optional points balances. Omit for generic (no-balance) results.')

type BalanceInput = z.infer<typeof balanceInputSchema>

// Normalize MCP balance input -> the engine's Balance model.
function toBalances(input: BalanceInput | undefined): Balance[] {
  if (!input) return []
  return input
    .filter((b) => b && typeof b.program === 'string' && Number.isFinite(b.balance))
    .map((b) => ({ program: b.program, code: '', balance: b.balance }))
}

function toPriceTripBalances(input: BalanceInput | undefined): PriceTripBalance[] {
  if (!input) return []
  return input
    .filter((b) => b && typeof b.program === 'string' && Number.isFinite(b.balance))
    .map((b) => ({ program: b.program, balance: b.balance }))
}

// --- price_trip ------------------------------------------------------------

export const priceTripSchema = {
  destinationCode: z
    .string()
    .describe('IATA airport/city code in hop\'s dataset, e.g. "NRT", "LHR", "GRU".'),
  balances: balanceInputSchema.optional(),
}

// Deterministic miles / CPP / affordability / verdict for one destination.
// Pure passthrough to concierge-tools.priceTrip (computeCpp + destinationByCode
// + effectiveBalanceFor). Returns the engine's { error } shape for unknown codes.
export function runPriceTrip(args: {
  destinationCode: string
  balances?: BalanceInput
}) {
  return priceTrip(args.destinationCode, toPriceTripBalances(args.balances))
}

// --- verdict ---------------------------------------------------------------

export const verdictSchema = {
  from: z.string().describe('Origin IATA, e.g. "SFO".'),
  to: z.string().describe('Destination IATA, e.g. "LHR".'),
  depart: z.string().describe('Departure date, ISO "YYYY-MM-DD".'),
  return: z.string().optional().describe('Return date, ISO "YYYY-MM-DD" (round trip).'),
  adults: z.number().int().min(1).optional().describe('Number of adults (default 1).'),
  balances: balanceInputSchema.optional(),
}

// The full points-vs-cash verdict for a route. Thin passthrough to
// lib/search.verdictSummary — the SAME assembleSearch call + trim the app's
// /search page and the in-app /ask concierge (lib/concierge-tools' search_flights
// tool) use, so this MCP tool, the live UI, and the LLM concierge can never
// disagree on a verdict for the same route/date. Caller-supplied balances are
// used verbatim; when omitted we pass [] so the engine runs in a stateless,
// balance-agnostic mode (no false "you have" claims).
export async function runVerdict(args: {
  from: string
  to: string
  depart: string
  return?: string
  adults?: number
  balances?: BalanceInput
}) {
  return verdictSummary(
    {
      from: args.from.trim().toUpperCase(),
      to: args.to.trim().toUpperCase(),
      depart: args.depart,
      return: args.return,
      adults: Math.max(1, args.adults ?? 1),
    },
    toBalances(args.balances),
  )
}

// --- sweet_spots -----------------------------------------------------------

export const sweetSpotsSchema = {
  limit: z.number().int().min(1).max(50).optional().describe('How many to return (default 8).'),
}

// The top-value redemptions by CPP — hop's "sweet spots". Pure passthrough to
// destinations.topValue + computeCpp.
export function runSweetSpots(args: { limit?: number }) {
  const n = args.limit ?? 8
  return {
    sweetSpots: topValue(n).map((d) => ({
      code: d.code,
      city: d.city,
      country: d.country,
      region: d.region,
      bestProgram: d.bestProgram,
      milesNeeded: d.typicalAwardMiles,
      cashUsd: d.typicalCashUSD,
      cpp: computeCpp(d),
    })),
  }
}

// --- transfer_paths --------------------------------------------------------

export const transferPathsSchema = {
  program: z
    .string()
    .describe('A transferable bank currency (e.g. "Amex MR") OR a target airline/hotel program.'),
}

// Transfer reachability for a program. Two modes, decided by what `program`
// resolves to:
//   - a transferable bank currency  -> outbound partners (partnersOf): where its
//     points can go, with ratios.
//   - any other (airline/hotel) program -> inbound sources (transfersTo, walked
//     against a synthetic "holds everything" balance set) so the caller sees
//     which banks can REACH it. We never invent amounts — only the edges/ratios.
export function runTransferPaths(args: { program: string }) {
  const canon = canonicalizeProgram(args.program)
  if (!canon) {
    return { error: `Unknown program "${args.program}".`, program: args.program }
  }

  if (canon.transferable) {
    // Outbound: this bank currency's verified partners.
    const edges = partnersOf(canon.id)
    return {
      program: canon.name,
      programId: canon.id,
      direction: 'outbound' as const,
      partners: edges.map((e) => ({
        to: programById(e.to)?.name ?? e.to,
        toId: e.to,
        ratio: e.ratio,
        multiplier: e.multiplier,
        minimum: e.minimum,
        note: e.note,
      })),
    }
  }

  // Inbound: which bank currencies can reach this target. We probe with a
  // synthetic balance in every transferable source so transfersTo reports the
  // reachable sources + ratios (the "held" amounts are synthetic and dropped).
  const probe: Balance[] = listTransferablePrograms().map((p) => ({
    program: p.id,
    code: '',
    balance: 1,
  }))
  const sources = transfersTo(canon.name, probe)
  return {
    program: canon.name,
    programId: canon.id,
    direction: 'inbound' as const,
    sources: sources.map((s) => ({ source: s.source, ratio: s.ratio })),
  }
}

// --- compare_programs ------------------------------------------------------

export const compareProgramsSchema = {
  from: z.string().describe('Origin IATA, e.g. "SFO".'),
  to: z.string().describe('Destination IATA, e.g. "LHR".'),
  depart: z.string().optional().describe('Departure date, ISO "YYYY-MM-DD".'),
  programs: z
    .array(z.string())
    .min(1)
    .describe(
      'The loyalty programs to compare on this route, e.g. ["Chase UR", "United", "Air France"]. Free-text — canonicalized by the engine.',
    ),
  balances: balanceInputSchema.optional(),
}

// Resolve the depart date the engine should price. compare_programs makes the
// date optional (the caller often just wants "which currency wins this route"),
// so when omitted we price a stable near-future weekday rather than today, which
// some upstreams reject. Kept deterministic so a missing date never invents
// economics — only picks WHEN to price.
function defaultDepart(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 30)
  return d.toISOString().slice(0, 10)
}

// Best computed award option per canonical program from a search result. The
// engine already collapses the firehose to one option per program/airline and
// ranks by cpp, so we key award options by their canonical program id and keep
// the first (highest-cpp) seen. Returns a map id -> FlightOption.
function bestAwardByProgram(options: FlightOption[]): Map<string, FlightOption> {
  const byId = new Map<string, FlightOption>()
  for (const o of options) {
    if (o.kind === 'cash') continue
    if (!o.program || o.miles == null) continue
    const canon = canonicalizeProgram(o.program)
    if (!canon) continue
    if (!byId.has(canon.id)) byId.set(canon.id, o)
  }
  return byId
}

// Side-by-side cents-per-point for the NAMED programs on a route, ranked best
// cpp first. Runs the SAME assembleSearch the app + verdict() use, then reads
// each requested program's best computed award option (miles, cash comp, cpp)
// straight off the result — never inventing a figure. Affordability (`canAfford`)
// is only set when the request carried balances (caller-supplied or, in the
// route layer, the linked owner's real balances); otherwise it stays null so we
// make no false "you can afford it" claim. Programs the engine found no award
// option for are returned in `unavailable` rather than guessed.
export async function runComparePrograms(args: {
  from: string
  to: string
  depart?: string
  programs: string[]
  balances?: BalanceInput
}) {
  const balances = toBalances(args.balances)
  const haveBalances = balances.length > 0

  const result = await assembleSearch(
    {
      from: args.from.trim().toUpperCase(),
      to: args.to.trim().toUpperCase(),
      depart: args.depart?.trim() || defaultDepart(),
      adults: 1,
    },
    balances,
  )

  const cashComp = result.summary.cheapestCash
  // Source from the UNTRIMMED best-per-program set (`allAwards`), not `options`
  // (capped at MAX_AWARDS=6 for display) — otherwise a requested program ranked
  // below the cap would be falsely reported `unavailable`. Falls back to options
  // only if an older engine result lacks allAwards.
  const bestAward = bestAwardByProgram(result.allAwards ?? result.options)

  type Row = {
    program: string
    programId: string
    miles: number
    taxes: number | undefined
    cashUsd: number | undefined
    cpp: number | undefined
    youHave: number | undefined
    canAfford: boolean | null
  }

  const rows: Row[] = []
  const unavailable: Array<{ program: string; programId: string | null }> = []
  const seen = new Set<string>()

  for (const raw of args.programs) {
    const canon = canonicalizeProgram(raw)
    if (!canon) {
      unavailable.push({ program: raw, programId: null })
      continue
    }
    if (seen.has(canon.id)) continue // de-dupe repeated/alias inputs
    seen.add(canon.id)

    const opt = bestAward.get(canon.id)
    if (!opt || opt.miles == null) {
      unavailable.push({ program: canon.name, programId: canon.id })
      continue
    }

    // youHave: prefer the engine's per-option figure; if the engine left it
    // unset but we DO have balances, ask transfers.ts for the effective
    // direct-or-transfer balance toward this program. Pure passthrough — the
    // ratio math lives in the engine, never here.
    let youHave = opt.youHave
    if (youHave == null && haveBalances) {
      youHave = effectiveBalanceFor(canon.name, balances)?.amount
    }
    const canAfford = youHave == null ? null : youHave >= opt.miles

    rows.push({
      program: canon.name,
      programId: canon.id,
      miles: opt.miles,
      taxes: opt.taxes,
      cashUsd: opt.cashPrice ?? cashComp,
      cpp: opt.cpp,
      youHave,
      canAfford,
    })
  }

  // Rank by computed cpp, best first; undefined cpp sinks to the bottom (mirrors
  // lib/cpp.rankOptions / destinations.byCppDesc).
  rows.sort((a, b) => {
    if (a.cpp == null && b.cpp == null) return 0
    if (a.cpp == null) return 1
    if (b.cpp == null) return -1
    return b.cpp - a.cpp
  })

  return {
    route: `${result.params.from} → ${result.params.to}`,
    depart: result.params.depart,
    cashComp, // cheapest cash on the route — the baseline every cpp is measured against
    personalized: haveBalances, // were affordability figures computed from real balances?
    ranked: rows,
    unavailable,
    degraded: result.degraded,
  }
}

// --- best_card_for_program -------------------------------------------------

// Top earn card per program, keyed by canonical lib/programs id.
//
// TEMPORARY LOCAL MAP. lib/card-affiliates.ts is being built in a parallel PR
// (roadmap WS2 — affiliate links + earn-card data). When it lands, this map
// should be DELETED and best_card_for_program() should source the card +
// affiliate link from lib/card-affiliates.ts instead. Until then this small
// static set covers the major transferable currencies + a few popular co-brands
// so the tool is useful immediately. Figures are public, well-known earn rates;
// `applyUrl` points at the issuer's own application page (no affiliate tag yet —
// that's WS2's job). NEVER computed economics here — this is reference data.
interface CardOffer {
  card: string
  issuer: string
  earnRate: string // headline earn on the program's everyday/bonus spend
  bonus: string // current/typical welcome offer (verify live before applying)
  annualFee: string
  applyUrl: string
}

const TOP_CARD_BY_PROGRAM: Record<string, CardOffer> = {
  'amex-mr': {
    card: 'American Express Gold Card',
    issuer: 'American Express',
    earnRate: '4x at restaurants & U.S. supermarkets (to $25k/yr), 3x on flights',
    bonus: '60,000 Membership Rewards after $6,000 spend in 6 months',
    annualFee: '$325',
    applyUrl: 'https://www.americanexpress.com/us/credit-cards/card/gold-card/',
  },
  'chase-ur': {
    card: 'Chase Sapphire Preferred',
    issuer: 'Chase',
    earnRate: '3x dining, 2x travel, 5x on Chase Travel',
    bonus: '60,000 Ultimate Rewards after $5,000 spend in 3 months',
    annualFee: '$95',
    applyUrl: 'https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred',
  },
  'citi-typ': {
    card: 'Citi Strata Premier',
    issuer: 'Citi',
    earnRate: '3x air/hotels, restaurants, supermarkets & gas',
    bonus: '75,000 ThankYou Points after $4,000 spend in 3 months',
    annualFee: '$95',
    applyUrl: 'https://www.citi.com/credit-cards/citi-strata-premier-credit-card',
  },
  'capital-one': {
    card: 'Capital One Venture X',
    issuer: 'Capital One',
    earnRate: '2x everywhere, 5x flights & 10x hotels via Capital One Travel',
    bonus: '75,000 miles after $4,000 spend in 3 months',
    annualFee: '$395',
    applyUrl: 'https://www.capitalone.com/credit-cards/venture-x/',
  },
  bilt: {
    card: 'Bilt Mastercard',
    issuer: 'Wells Fargo',
    earnRate: '1x rent (no fee), 3x dining, 2x travel',
    bonus: 'No welcome bonus; double points on the 1st of each month',
    annualFee: '$0',
    applyUrl: 'https://www.biltrewards.com/card',
  },
  united: {
    card: 'United Explorer Card',
    issuer: 'Chase',
    earnRate: '2x United, dining & hotels',
    bonus: '60,000 miles after $3,000 spend in 3 months',
    annualFee: '$0 first year, then $150',
    applyUrl: 'https://creditcards.chase.com/travel-credit-cards/united/explorer',
  },
  delta: {
    card: 'Delta SkyMiles Gold American Express',
    issuer: 'American Express',
    earnRate: '2x Delta, restaurants & U.S. supermarkets',
    bonus: '50,000 miles after $2,000 spend in 6 months',
    annualFee: '$0 first year, then $150',
    applyUrl: 'https://www.americanexpress.com/us/credit-cards/card/delta-skymiles-gold/',
  },
  american: {
    card: 'Citi / AAdvantage Platinum Select',
    issuer: 'Citi',
    earnRate: '2x American, restaurants & gas',
    bonus: '50,000 miles after $2,500 spend in 3 months',
    annualFee: '$0 first year, then $99',
    applyUrl: 'https://www.citi.com/credit-cards/citi-aadvantage-platinum-select-credit-card',
  },
  alaska: {
    card: 'Alaska Airlines Visa Signature',
    issuer: 'Bank of America',
    earnRate: '3x Alaska, 2x gas, EV charging, local transit & cable',
    bonus: '50,000 miles + Companion Fare after $3,000 spend in 90 days',
    annualFee: '$95',
    applyUrl: 'https://www.bankofamerica.com/credit-cards/products/alaska-airlines-credit-card/',
  },
  southwest: {
    card: 'Southwest Rapid Rewards Priority',
    issuer: 'Chase',
    earnRate: '3x Southwest, 2x transit, internet, cable & phone',
    bonus: '50,000 points after $1,000 spend in 3 months',
    annualFee: '$149',
    applyUrl: 'https://creditcards.chase.com/travel-credit-cards/southwest/priority',
  },
  hyatt: {
    card: 'World of Hyatt Credit Card',
    issuer: 'Chase',
    earnRate: '4x Hyatt, 2x dining, flights, transit & gym',
    bonus: '30,000 points after $3,000 spend in 3 months',
    annualFee: '$95',
    applyUrl: 'https://creditcards.chase.com/travel-credit-cards/world-of-hyatt',
  },
  marriott: {
    card: 'Marriott Bonvoy Boundless',
    issuer: 'Chase',
    earnRate: '6x Marriott, 3x on first $6k/yr in combined everyday categories',
    bonus: '3 Free Night Awards after $3,000 spend in 3 months',
    annualFee: '$95',
    applyUrl: 'https://creditcards.chase.com/travel-credit-cards/marriott-bonvoy/boundless',
  },
  hilton: {
    card: 'Hilton Honors American Express Surpass',
    issuer: 'American Express',
    earnRate: '12x Hilton, 6x U.S. dining, supermarkets & gas',
    bonus: '130,000 points after $3,000 spend in 6 months',
    annualFee: '$150',
    applyUrl: 'https://www.americanexpress.com/us/credit-cards/card/hilton-honors-surpass/',
  },
  ihg: {
    card: 'IHG One Rewards Premier',
    issuer: 'Chase',
    earnRate: '10x IHG, 5x travel/dining/gas, 3x everywhere else',
    bonus: '5 Free Nights after $5,000 spend in 3 months',
    annualFee: '$99',
    applyUrl: 'https://creditcards.chase.com/travel-credit-cards/ihg/premier',
  },
}

export const bestCardForProgramSchema = {
  program: z
    .string()
    .describe('A loyalty/bank program name or code, e.g. "Chase UR", "United", "Hyatt".'),
}

// The top earn card for a program: name, issuer, headline earn rate, welcome
// bonus, annual fee, and an application link. `program` is canonicalized so
// "Chase", "chase ur", "Ultimate Rewards" all resolve. Returns an { error }
// shape (never throws) when the program is unknown or no card is mapped yet.
//
// NB: card data is currently a small local map (TOP_CARD_BY_PROGRAM). It should
// later source from lib/card-affiliates.ts (parallel PR) for affiliate links.
export function runBestCardForProgram(args: { program: string }) {
  const canon = canonicalizeProgram(args.program)
  if (!canon) {
    return { error: `Unknown program "${args.program}".`, program: args.program }
  }
  const offer = TOP_CARD_BY_PROGRAM[canon.id]
  if (!offer) {
    return {
      error: `No earn card mapped for "${canon.name}" yet.`,
      program: canon.name,
      programId: canon.id,
    }
  }
  return {
    program: canon.name,
    programId: canon.id,
    transferable: canon.transferable,
    card: offer.card,
    issuer: offer.issuer,
    earnRate: offer.earnRate,
    bonus: offer.bonus,
    annualFee: offer.annualFee,
    applyUrl: offer.applyUrl,
    note: 'Earn rates & bonuses change often — verify on the issuer page before applying.',
  }
}
