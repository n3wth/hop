// Selectors for the signed-in home's VERDICT SHELVES — the rows of engine-
// computed inspiration below "Your points" (dream rotation, transfer-unlocked
// destinations, live-priced balances). Every function here is pure (no I/O,
// no randomness beyond the caller's own `index`) so the shelves stay unit-
// testable independent of the components that render them. The one exception,
// liveValuationStats(), does read through to lib/valuations-live (DB-backed)
// and degrades to [] on any failure — never throws.

import type { Balance } from '@/lib/types'
import { ledgerDream, reachableDreamCount, type LedgerDream } from '@/lib/ledger-dream'
import { destinations, computeCpp, type Destination } from '@/lib/destinations'
import { effectiveBalanceFor } from '@/lib/transfers'
import { canonicalizeProgram } from '@/lib/programs'
import { getLiveValuations } from '@/lib/valuations-live'
import { listValuations } from '@/lib/valuations'

// --- Dream rotation ----------------------------------------------------------

// The most slots the dream rotation ever shows (slot 0 renders larger — the
// existing cinematic Ledger Dream card; slots 1..n render as compact cards).
export const MAX_DREAM_SLOTS = 6

// Up to `maxSlots` distinct dreams, most-aspirational-first (ledgerDream's own
// ranking — see lib/ledger-dream#rankedReachable). With nothing reachable,
// there is only ever the ONE save-toward fallback dream, so the row collapses
// to a single (larger) slot rather than repeating it.
export function dreamRotationSlots(balances: Balance[], maxSlots: number = MAX_DREAM_SLOTS): LedgerDream[] {
  const count = reachableDreamCount(balances)
  const bounded = Math.max(1, Math.floor(maxSlots))
  const slots = count > 0 ? Math.min(count, bounded) : 1
  return Array.from({ length: slots }, (_, i) => ledgerDream(balances, i))
}

// --- Unlocked by transfer -----------------------------------------------------

export interface TransferUnlock {
  destination: Destination
  cpp: number | undefined
  // The transfer path that unlocks it — always a transfer (never a direct
  // hold; effectiveBalanceFor() always prefers a direct hold when the member
  // has any balance in the destination's own program).
  source: string
  ratio: string
  effectiveBalance: number
}

function byUnlockValueDesc(a: TransferUnlock, b: TransferUnlock): number {
  if (a.cpp === undefined && b.cpp === undefined) return 0
  if (a.cpp === undefined) return 1
  if (b.cpp === undefined) return -1
  if (b.cpp !== a.cpp) return b.cpp - a.cpp
  return a.destination.code.localeCompare(b.destination.code)
}

// Destinations that ONLY open up because the member holds a transferable bank
// currency with a verified edge to the destination's bestProgram — never a
// destination they can already book directly. `excludeCodes` is whatever the
// caller is ALREADY showing in "Within reach" (its rendered slice, not the
// full reachable set) so the two shelves never repeat a destination card.
// Best value (cpp desc) first. Never throws; empty input/graph → [].
export function unlockedByTransfer(
  balances: Balance[],
  excludeCodes: Iterable<string> = [],
): TransferUnlock[] {
  if (!Array.isArray(balances) || balances.length === 0) return []
  const exclude = new Set(Array.from(excludeCodes, (c) => c.toUpperCase()))
  const out: TransferUnlock[] = []
  for (const d of destinations) {
    if (exclude.has(d.code.toUpperCase())) continue
    const eff = effectiveBalanceFor(d.bestProgram, balances)
    if (!eff || eff.via.kind !== 'transfer') continue
    if (eff.amount < d.typicalAwardMiles) continue
    out.push({
      destination: d,
      cpp: computeCpp(d),
      source: eff.via.source,
      ratio: eff.via.ratio,
      effectiveBalance: eff.amount,
    })
  }
  return out.sort(byUnlockValueDesc)
}

// --- Your points, priced live -------------------------------------------------

export interface LiveValuationStat {
  programId: string
  programName: string
  baselineCpp: number
  liveCpp: number
  // liveCpp - baselineCpp, rounded to 2dp. Positive = worth more than the
  // static baseline suggested; negative = worth less.
  delta: number
  sampleSize: number
  asOf: string
  balance: number
}

function byDeltaDesc(a: LiveValuationStat, b: LiveValuationStat): number {
  if (b.delta !== a.delta) return b.delta - a.delta
  return a.programId.localeCompare(b.programId)
}

// The intersection of getLiveValuations() (DB-backed, gated at
// MIN_SAMPLES_TO_TRUST fresh samples — lib/valuations-live) and the programs
// the member actually HOLDS a positive balance in. Only isLive entries count —
// this ships completely dark (empty array) until a held program crosses the
// trust threshold, never showing a fabricated or stale number. Ranked by
// (live − baseline) delta, descending — the biggest upside surprise leads.
// Degrades to [] on any upstream failure — never throws.
export async function liveValuationStats(balances: Balance[]): Promise<LiveValuationStat[]> {
  if (!Array.isArray(balances) || balances.length === 0) return []
  const [live, baseline] = await Promise.all([
    getLiveValuations().catch(() => ({}) as Awaited<ReturnType<typeof getLiveValuations>>),
    Promise.resolve(listValuations()),
  ])

  const out: LiveValuationStat[] = []
  const seen = new Set<string>()
  for (const b of balances) {
    if (!b || typeof b.balance !== 'number' || b.balance <= 0) continue
    const programId = canonicalizeProgram(b.program)?.id
    if (!programId || seen.has(programId)) continue
    const entry = live[programId]
    if (!entry || !entry.isLive) continue
    seen.add(programId)
    const baselineCpp = baseline[programId] ?? entry.cpp
    out.push({
      programId,
      programName: b.program,
      baselineCpp,
      liveCpp: entry.cpp,
      delta: Math.round((entry.cpp - baselineCpp) * 100) / 100,
      sampleSize: entry.sampleSize,
      asOf: entry.asOf,
      balance: b.balance,
    })
  }
  return out.sort(byDeltaDesc)
}
