// THE LEDGER DREAM — the single most aspirational-yet-affordable redemption the
// user can actually reach with the points they hold right now, with a transparent
// "how you afford it" proof drawn straight from the engine.
//
// This RUNS THE SAME ENGINE the rest of hop runs. It does not invent economics:
//   • computeCpp / topValue / affordableWith over the real destinations dataset
//   • effectiveBalanceFor (lib/transfers) for the exact direct-or-transfer path
// The LLM only narrates the pick this function returns; every number here is the
// engine's, deterministically. Pure + total: never throws, no I/O, no randomness.

import type { Balance } from '@/lib/types'
import {
  destinations,
  affordableWith,
  topValue,
  computeCpp,
  imageQuery,
  type Destination,
} from '@/lib/destinations'
import { effectiveBalanceFor, type EffectiveBalance } from '@/lib/transfers'

// How the user reaches the dream — mirrors EffectiveBalance['via'] so the UI can
// narrate "direct in Alaska" vs "transfer Amex MR (1:1)". This IS the proof spine.
export type DreamVia = EffectiveBalance['via']

// The exact pool -> program path that funds the redemption. Every figure is the
// engine's: the program that books it, how many of the user's points it takes,
// and the source currency + ratio when a transfer is involved. The UI renders
// this verbatim; the model never touches it.
export interface DreamProof {
  // The loyalty program the award is booked in (destination.bestProgram).
  program: string
  // Award miles needed in that program (engine: destination.typicalAwardMiles).
  milesNeeded: number
  // The user's EFFECTIVE balance toward that program (direct or post-transfer),
  // in the program's own currency. undefined for the save-toward fallback.
  effectiveBalance?: number
  // Source pool when a transfer funds it, e.g. "Amex MR" + "1:1". Omitted when
  // the user holds the program directly, or for the save-toward fallback.
  transferFrom?: { source: string; ratio: string }
  // One-line, human-readable path: "Amex MR → ANA via Amex MR (1:1)" or
  // "Alaska Mileage Plan (held directly)".
  path: string
}

export interface LedgerDream {
  destination: Destination
  // Award miles the redemption needs (destination.typicalAwardMiles).
  milesNeeded: number
  // Cents per point at this redemption (engine: computeCpp).
  cpp: number | undefined
  // The cash the same trip would cost — what the points are "worth" here.
  cashValue: number
  // How the user reaches it. undefined ONLY for the save-toward fallback, where
  // there are no balances to reach it with yet.
  via?: DreamVia
  // The transparent proof block (pool -> program path).
  proof: DreamProof
  // Unsplash search query for the hero photo (callers resolve via lib/images).
  imageQuery: string
  // True when this is the "best dream to save toward" fallback (signed-out / no
  // balances / nothing reachable) rather than a redemption the user can book now.
  saveToward: boolean
  // True when the user can book this with the points they hold RIGHT NOW.
  affordableNow: boolean
}

// --- Aspiration scoring -----------------------------------------------------

// A trip's "dream weight": long-haul, premium-cabin-worthy, bucket-list reaches
// score higher than a quick hop. Distance (proxied by typical award miles — the
// dataset's honest stand-in) is the dominant signal: a 47.5k-mile Sydney award
// is a bigger dream than a 12.5k Vancouver run, even at similar cpp. Tags nudge
// the genuinely aspirational (luxury / adventure / wellness / nature) up, and
// pure-budget down, so the Dream feels like a dream and not an errand.
const ASPIRATION_TAG_BONUS: Record<string, number> = {
  luxury: 1.4,
  adventure: 1.0,
  wellness: 0.9,
  nature: 0.7,
  mountains: 0.7,
  wine: 0.5,
  beach: 0.4,
  budget: -1.2,
}

export function aspirationScore(d: Destination): number {
  // Miles, in tens-of-thousands, is the spine: a long-haul premium reach is the
  // dream. Squared lightly so the gap between a 12k hop and a 50k epic is real.
  const milesWeight = (d.typicalAwardMiles / 10000) ** 1.15
  const tagBonus = d.tags.reduce((sum, t) => sum + (ASPIRATION_TAG_BONUS[t] ?? 0), 0)
  return Math.round((milesWeight + tagBonus) * 100) / 100
}

// The Dream blends ASPIRATION with VALUE: a high-cpp epic beats a high-cpp hop,
// and a great-value dream beats a mediocre-value one. cpp (cents) is scaled so a
// 3.0cpp redemption adds meaningfully without drowning the aspiration signal.
function dreamScore(d: Destination): number {
  const asp = aspirationScore(d)
  const value = computeCpp(d) ?? 0
  return Math.round((asp * (1 + value / 4)) * 100) / 100
}

// Stable comparator: dreamScore desc, then miles desc (bigger dream wins ties),
// then code asc (fully deterministic — no Array.sort instability across engines).
function byDreamDesc(a: Destination, b: Destination): number {
  const sa = dreamScore(a)
  const sb = dreamScore(b)
  if (sb !== sa) return sb - sa
  if (b.typicalAwardMiles !== a.typicalAwardMiles) return b.typicalAwardMiles - a.typicalAwardMiles
  return a.code.localeCompare(b.code)
}

// --- Proof assembly ---------------------------------------------------------

// Build the transparent proof from the engine's effective-balance resolution.
// `eff` is undefined for the save-toward fallback (no balances to reach it).
function buildProof(d: Destination, eff: EffectiveBalance | undefined): DreamProof {
  const milesNeeded = d.typicalAwardMiles
  if (!eff) {
    return {
      program: d.bestProgram,
      milesNeeded,
      path: `Save toward ${d.bestProgram}`,
    }
  }
  if (eff.via.kind === 'direct') {
    return {
      program: d.bestProgram,
      milesNeeded,
      effectiveBalance: eff.amount,
      path: `${eff.via.program} (held directly)`,
    }
  }
  // transfer
  return {
    program: d.bestProgram,
    milesNeeded,
    effectiveBalance: eff.amount,
    transferFrom: { source: eff.via.source, ratio: eff.via.ratio },
    path: `${eff.via.source} → ${d.bestProgram} (${eff.via.ratio})`,
  }
}

function toDream(
  d: Destination,
  eff: EffectiveBalance | undefined,
  saveToward: boolean,
): LedgerDream {
  const milesNeeded = d.typicalAwardMiles
  const affordableNow = !!eff && eff.amount >= milesNeeded
  return {
    destination: d,
    milesNeeded,
    cpp: computeCpp(d),
    cashValue: d.typicalCashUSD,
    via: eff?.via,
    proof: buildProof(d, eff),
    imageQuery: imageQuery(d),
    saveToward,
    affordableNow,
  }
}

// --- Reachability over real balances ----------------------------------------

// A destination is REACHABLE when the user's effective balance toward its best
// program (direct OR via a verified transfer, ratio applied by the engine) meets
// the award. Returns the EffectiveBalance so the proof can narrate the path.
function reachable(d: Destination, balances: Balance[]): EffectiveBalance | undefined {
  const eff = effectiveBalanceFor(d.bestProgram, balances)
  if (!eff) return undefined
  return eff.amount >= d.typicalAwardMiles ? eff : undefined
}

// The user's reachable dreams, most aspirational-yet-valuable first. The list the
// "Dream me another" index walks. Deterministic. We additionally require the
// affordableWith() gate (total points >= award) so we never surface a reach the
// raw-points engine would exclude, then confirm the SPECIFIC program is reachable.
function rankedReachable(balances: Balance[]): Array<{ d: Destination; eff: EffectiveBalance }> {
  const total = balances.reduce((sum, b) => sum + (b.balance > 0 ? b.balance : 0), 0)
  const affordableCodes = new Set(affordableWith(total).map((d) => d.code))
  const out: Array<{ d: Destination; eff: EffectiveBalance }> = []
  for (const d of [...destinations].sort(byDreamDesc)) {
    if (!affordableCodes.has(d.code)) continue
    const eff = reachable(d, balances)
    if (eff) out.push({ d, eff })
  }
  return out
}

// --- Public API -------------------------------------------------------------

// The single Dream of the Week for this user. `index` selects a DIFFERENT corner
// of the portfolio deterministically ("Dream me another") — it walks the ranked
// reachable list, wrapping around. With no balances (signed out / nothing
// connected / nothing reachable) it falls back to the best dream to SAVE TOWARD
// (topValue), also index-cyclable so "another" still varies.
export function ledgerDream(balances: Balance[], index = 0): LedgerDream {
  const i = Math.max(0, Math.floor(index))
  const reachables = rankedReachable(balances)

  if (reachables.length > 0) {
    const pick = reachables[i % reachables.length]
    return toDream(pick.d, pick.eff, false)
  }

  // Fallback: the best dream to save toward. topValue is the engine's value
  // ranking; we re-rank that pool by dreamScore so the FALLBACK is aspirational
  // too (a bucket-list reach to save for), not just the highest-cpp short hop.
  const pool = topValue(destinations.length)
    .slice(0, Math.min(12, destinations.length))
    .sort(byDreamDesc)
  const d = pool[i % pool.length] ?? topValue(1)[0]
  // Even in the fallback, show the BEST path the user has toward it (may be a
  // partial transfer balance) so the proof still teaches — undefined when they
  // hold nothing toward it.
  const eff = effectiveBalanceFor(d.bestProgram, balances)
  return toDream(d, eff, true)
}

// How many distinct reachable dreams the user has (drives whether the UI offers
// "Dream me another"). 0 → only the save-toward fallback is available.
export function reachableDreamCount(balances: Balance[]): number {
  return rankedReachable(balances).length
}
