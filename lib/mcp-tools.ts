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
import { assembleSearch } from '@/lib/search'
import { canonicalizeProgram, programById, listTransferablePrograms } from '@/lib/programs'
import { partnersOf, transfersTo } from '@/lib/transfers'
import type { Balance } from '@/lib/types'

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

// The full points-vs-cash verdict for a route. Runs the SAME assembleSearch the
// app uses, then returns the verdict + summary + the chosen pick + the top
// options (trimmed) — never the raw firehose. Caller-supplied balances are used
// verbatim; when omitted we pass [] so the engine runs in a stateless, balance
// -agnostic mode (no false "you have" claims).
export async function runVerdict(args: {
  from: string
  to: string
  depart: string
  return?: string
  adults?: number
  balances?: BalanceInput
}) {
  const result = await assembleSearch(
    {
      from: args.from.trim().toUpperCase(),
      to: args.to.trim().toUpperCase(),
      depart: args.depart,
      return: args.return,
      adults: Math.max(1, args.adults ?? 1),
    },
    toBalances(args.balances),
  )

  // Surface the decision-relevant fields; drop internal booking URLs / tiers the
  // external caller can't act on. The verdict + summary ARE the product.
  return {
    route: `${result.params.from} → ${result.params.to}`,
    depart: result.params.depart,
    return: result.params.return,
    adults: result.params.adults,
    verdict: result.verdict,
    summary: result.summary,
    pick: result.pick
      ? {
          kind: result.pick.kind,
          airline: result.pick.airline,
          program: result.pick.program,
          cabin: result.pick.cabin,
          miles: result.pick.miles,
          taxes: result.pick.taxes,
          cashPrice: result.pick.cashPrice,
          cpp: result.pick.cpp,
          youHave: result.pick.youHave,
        }
      : null,
    options: result.options.slice(0, 6).map((o) => ({
      kind: o.kind,
      airline: o.airline,
      program: o.program,
      cabin: o.cabin,
      miles: o.miles,
      taxes: o.taxes,
      cashPrice: o.cashPrice,
      cpp: o.cpp,
      action: o.action,
    })),
    degraded: result.degraded,
  }
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
