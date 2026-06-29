// COUNTERFACTUAL YOU — travel's first financial mirror. "What if I had a
// DIFFERENT points portfolio?"
//
// This is the same moat the rest of hop runs on, pointed at a hypothetical: take
// the user's REAL Balance[], apply a MUTATION (add points to a program, set a
// program to a value, or SWAP one program for another), and produce a perturbed
// CLONE of the portfolio. We then run the EXACT SAME deterministic engine
// (effectiveBalanceFor / computeCpp / affordableWith / topValue / destinations)
// on the clone and diff it against the baseline to surface what UNLOCKS:
//   • destinations newly affordable,
//   • destinations whose effective balance jumped (improved headroom),
//   • the dollar value the new portfolio puts within reach.
//
// EVERYTHING HERE IS PURE + DETERMINISTIC. The LLM never touches these numbers —
// it only TRANSLATES free text into a Mutation (see parseMutation). The economics
// are computed, never generated, so a counterfactual can never lie.

import {
  destinations,
  computeCpp,
  type Destination,
} from '@/lib/destinations'
import { effectiveBalanceFor } from '@/lib/transfers'
import { canonicalizeProgram, programById } from '@/lib/programs'
import type { Balance } from '@/lib/types'

// --- Mutation contract -------------------------------------------------------

// A single perturbation to the portfolio. `program` / `from` / `to` are CANONICAL
// program ids (lib/programs.ts) — parseMutation clamps free text to these so the
// engine never sees an unknown currency.
//   • add  — credit `amount` points to `program` (on top of any existing balance).
//   • set  — set `program` to exactly `amount` points (replacing any balance).
//   • swap — drop everything in `from` and hold its balance in `to` instead
//            ("what if I held Alaska instead of Delta"). `amount` is ignored.
export type Mutation =
  | { op: 'add'; program: string; amount: number }
  | { op: 'set'; program: string; amount: number }
  | { op: 'swap'; from: string; to: string }

// --- Diff contract -----------------------------------------------------------

// One destination whose effective balance toward its booking program improved.
export interface ImprovedDestination {
  code: string
  city: string
  country: string
  bestProgram: string
  beforeYouHave: number // effective balance toward bestProgram, baseline
  afterYouHave: number // effective balance toward bestProgram, counterfactual
  milesNeeded: number
  beforeCpp: number | undefined
  afterCpp: number | undefined // cpp is portfolio-independent; kept for symmetry
  beforeAffordable: boolean
  afterAffordable: boolean
}

// One destination that crosses from NOT affordable to affordable.
export interface UnlockedDestination {
  code: string
  city: string
  country: string
  countryCode: string
  region: string
  bestProgram: string
  milesNeeded: number
  cashUsd: number
  cpp: number | undefined
}

export interface CounterfactualResult {
  // The mutation that produced this diff, normalized to display labels.
  mutation: {
    op: Mutation['op']
    label: string // human phrasing, e.g. "+50,000 Chase Ultimate Rewards"
  }
  // Destinations newly affordable in the counterfactual that weren't before.
  unlocked: UnlockedDestination[]
  // Destinations whose effective balance toward their booking program improved
  // (but which may or may not cross the affordability line).
  improved: ImprovedDestination[]
  // Dollar value the new portfolio puts within reach: the summed typical cash of
  // the NEWLY UNLOCKED trips (what you'd otherwise pay in cash for those flights).
  dollarValue: number
  // Headline counts for the UI.
  unlockedCount: number
}

// --- Portfolio cloning + perturbation ----------------------------------------

// Resolve a Balance row to its canonical program id (program name first, then
// monogram code). Mirrors transfers.ts's resolution so the clone speaks the same
// currency the engine reads. Returns undefined when neither resolves.
function balanceProgramId(b: Balance): string | undefined {
  const fromProgram = canonicalizeProgram(b.program)?.id
  if (fromProgram) return fromProgram
  return b.code ? canonicalizeProgram(b.code)?.id : undefined
}

// A fresh Balance row for a canonical program id. Uses the registry's canonical
// name + monogram so the perturbed currency canonicalizes identically to a real
// holding when the engine reads it back.
function balanceForProgram(programId: string, amount: number): Balance | undefined {
  const def = programById(programId)
  if (!def) return undefined
  return { program: def.name, code: def.code, balance: Math.max(0, Math.round(amount)) }
}

// Apply a MUTATION to a CLONE of the portfolio and return the perturbed clone.
// Never mutates the input array or its rows. Deterministic + total: an unknown
// program id (already clamped by parseMutation, but defended here too) yields an
// unchanged clone rather than throwing.
export function applyMutation(balances: Balance[], mutation: Mutation): Balance[] {
  // Deep-ish clone: new array of new row objects so callers' data is untouched.
  const clone: Balance[] = balances.map((b) => ({ ...b }))

  if (mutation.op === 'add' || mutation.op === 'set') {
    const targetId = canonicalizeProgram(mutation.program)?.id
    if (!targetId) return clone
    const amount = Number.isFinite(mutation.amount) ? Math.max(0, mutation.amount) : 0
    const idx = clone.findIndex((b) => balanceProgramId(b) === targetId)
    if (idx === -1) {
      const row = balanceForProgram(targetId, mutation.op === 'set' ? amount : amount)
      if (row && row.balance > 0) clone.push(row)
      return clone
    }
    if (mutation.op === 'add') {
      clone[idx] = { ...clone[idx], balance: Math.max(0, clone[idx].balance + amount) }
    } else {
      clone[idx] = { ...clone[idx], balance: Math.max(0, Math.round(amount)) }
    }
    return clone
  }

  // swap: move the FROM balance into the TO program, drop FROM entirely.
  const fromId = canonicalizeProgram(mutation.from)?.id
  const toId = canonicalizeProgram(mutation.to)?.id
  if (!fromId || !toId || fromId === toId) return clone

  // Sum everything currently held in FROM (there should be one row, but be safe).
  let moved = 0
  const kept: Balance[] = []
  for (const b of clone) {
    if (balanceProgramId(b) === fromId) {
      moved += b.balance
    } else {
      kept.push(b)
    }
  }
  if (moved <= 0) return kept // nothing to move; FROM removed (it was empty/absent)

  const toIdx = kept.findIndex((b) => balanceProgramId(b) === toId)
  if (toIdx === -1) {
    const row = balanceForProgram(toId, moved)
    if (row) kept.push(row)
  } else {
    kept[toIdx] = { ...kept[toIdx], balance: kept[toIdx].balance + moved }
  }
  return kept
}

// --- Per-destination snapshot (the engine, applied to one portfolio) ---------

interface DestSnapshot {
  youHave: number // effective balance toward bestProgram (direct OR transfer)
  affordable: boolean
  cpp: number | undefined
}

// Run hop's engine for ONE destination against ONE portfolio. This is the same
// call price_trip / enrichSuggestions make — effectiveBalanceFor resolves direct
// holdings AND transfer paths (ratio applied), computeCpp is portfolio-independent.
function snapshotDestination(d: Destination, balances: Balance[]): DestSnapshot {
  const eff = effectiveBalanceFor(d.bestProgram, balances)
  const youHave = eff?.amount ?? 0
  return {
    youHave,
    affordable: youHave >= d.typicalAwardMiles,
    cpp: computeCpp(d),
  }
}

// --- The diff (baseline vs counterfactual) -----------------------------------

// A human label for a normalized mutation, derived from the canonical registry so
// it always reads with the program's real name (never the user's raw typo).
function mutationLabel(mutation: Mutation): string {
  const name = (id: string) => programById(canonicalizeProgram(id)?.id ?? '')?.name ?? id
  if (mutation.op === 'add') {
    return `+${Math.round(mutation.amount).toLocaleString('en-US')} ${name(mutation.program)}`
  }
  if (mutation.op === 'set') {
    return `${Math.round(mutation.amount).toLocaleString('en-US')} ${name(mutation.program)}`
  }
  return `${name(mutation.to)} instead of ${name(mutation.from)}`
}

// THE entrypoint. Take the user's REAL balances + a mutation, perturb a CLONE,
// run the engine on both, and diff. Pure + deterministic + total.
//
// unlocked  = destinations affordable in the counterfactual but NOT in baseline.
// improved  = destinations whose effective balance toward bestProgram rose (a
//             superset signal: includes unlocked, plus closer-but-not-there gains).
// dollarValue = summed typical one-way cash of the newly unlocked trips — the cash
//             you'd otherwise spend on those exact flights, now reachable on points.
export function runCounterfactual(
  balances: Balance[],
  mutation: Mutation,
): CounterfactualResult {
  const after = applyMutation(balances, mutation)

  const unlocked: UnlockedDestination[] = []
  const improved: ImprovedDestination[] = []
  let dollarValue = 0

  for (const d of destinations) {
    const before = snapshotDestination(d, balances)
    const now = snapshotDestination(d, after)

    if (now.youHave > before.youHave) {
      improved.push({
        code: d.code,
        city: d.city,
        country: d.country,
        bestProgram: d.bestProgram,
        beforeYouHave: before.youHave,
        afterYouHave: now.youHave,
        milesNeeded: d.typicalAwardMiles,
        beforeCpp: before.cpp,
        afterCpp: now.cpp,
        beforeAffordable: before.affordable,
        afterAffordable: now.affordable,
      })
    }

    if (now.affordable && !before.affordable) {
      unlocked.push({
        code: d.code,
        city: d.city,
        country: d.country,
        countryCode: d.countryCode,
        region: d.region,
        bestProgram: d.bestProgram,
        milesNeeded: d.typicalAwardMiles,
        cashUsd: d.typicalCashUSD,
        cpp: computeCpp(d),
      })
      dollarValue += d.typicalCashUSD
    }
  }

  // Stable, useful ordering: unlocked by best value (cpp desc) so the strongest
  // redemptions lead; improved by the size of the headroom gain.
  unlocked.sort((a, b) => (b.cpp ?? 0) - (a.cpp ?? 0))
  improved.sort(
    (a, b) => b.afterYouHave - b.beforeYouHave - (a.afterYouHave - a.beforeYouHave),
  )

  return {
    mutation: { op: mutation.op, label: mutationLabel(mutation) },
    unlocked,
    improved,
    dollarValue,
    unlockedCount: unlocked.length,
  }
}
