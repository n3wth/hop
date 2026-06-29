// Transfer-partner graph — the deterministic spine for "you can reach this
// award by moving points." Keyed by the canonical program ids from
// lib/programs.ts so the LLM and the engine agree on currencies. The LLM never
// invents a transfer path; it only narrates what this table allows.
//
// ACCURACY > COVERAGE. A wrong transfer claim breaks trust, so we UNDER-claim:
// every edge below is verified against multiple 2026 sources (see SOURCES at the
// foot of the file). Partners we could not confirm — or that are card-tier /
// promo dependent — are deliberately omitted rather than guessed.
//
// Ratios are expressed as `ratio: '1:1'` (display) plus `multiplier` (math: how
// many partner points 1 source point becomes). Most edges are 1:1; the notable
// exceptions (Amex->Hilton 1:2, Amex/Cap1 premium-cabin-ish hotel/airline quirks,
// JetBlue/Cathay/Emirates haircuts) are captured explicitly. When in doubt we
// model the LESS generous, broadly-available ratio.

import type { Balance, TransferSource } from '@/lib/types'
import { canonicalizeProgram, programById } from '@/lib/programs'

// One edge in the graph: source bank currency -> destination program.
export interface TransferEdge {
  // canonical destination program id (lib/programs.ts), e.g. 'aeroplan'.
  to: string
  // display ratio, e.g. '1:1', '5:4', '1:2'.
  ratio: string
  // partner points per 1 source point. 1 for 1:1, 0.8 for 5:4 / 1:0.8, 2 for 1:2.
  multiplier: number
  // minimum source points per transfer, when verified. Omitted = unverified.
  minimum?: number
  // short caveat surfaced to the user (card-tier rules, fees, deadlines).
  note?: string
}

// The graph: canonical SOURCE id -> its verified edges. Sources are the five
// major transferable bank currencies. Display label for each source is derived
// from the registry (programById(...).name) so it stays canonical.
const GRAPH: Record<string, TransferEdge[]> = {
  // --- Amex Membership Rewards --------------------------------------------
  // 16 airline + 3 hotel partners (2026). Etihad ends 2026-06-30 — omitted.
  // Amex does NOT partner with United, American, Southwest, or Alaska.
  'amex-mr': [
    { to: 'aeroplan', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'avios-ba', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'flying-blue', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'ana', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'delta', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'krisflyer', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'virgin-atlantic', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'lifemiles', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'qantas', ratio: '1:1', multiplier: 1, minimum: 500 },
    { to: 'qatar', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'cathay', ratio: '5:4', multiplier: 0.8, minimum: 1000, note: '1,000 Amex points = 800 Asia Miles' },
    { to: 'emirates', ratio: '5:4', multiplier: 0.8, minimum: 1000, note: '1,000 Amex points = 800 Skywards miles' },
    { to: 'jetblue', ratio: '1:0.8', multiplier: 0.8, minimum: 250, note: '1,000 Amex points = 800 TrueBlue points' },
    { to: 'aeromexico', ratio: '1:1.6', multiplier: 1.6, minimum: 1000, note: '1,000 Amex points = 1,600 Aeromexico Rewards points' },
    { to: 'iberia', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'marriott', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'hilton', ratio: '1:2', multiplier: 2, minimum: 1000, note: '1,000 Amex points = 2,000 Hilton points' },
  ],

  // --- Chase Ultimate Rewards ---------------------------------------------
  // 10 airline + 4 hotel partners (2026). Emirates dropped 2025-10-16 — omitted.
  // Hyatt is moving to 4:3 for Sapphire Preferred (phased through 2026); we model
  // the broadly-available 1:1 and flag the change rather than over/under-claim.
  'chase-ur': [
    { to: 'united', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'southwest', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'jetblue', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'avios-ba', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'aeroplan', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'flying-blue', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'krisflyer', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'virgin-atlantic', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'qatar', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'iberia', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'hyatt', ratio: '1:1', multiplier: 1, minimum: 1000, note: 'Sapphire Preferred moves to 4:3 (phased through 2026); confirm your card' },
    { to: 'marriott', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'ihg', ratio: '1:1', multiplier: 1, minimum: 1000 },
  ],

  // --- Citi ThankYou Points -----------------------------------------------
  // Airline 1:1 shown for PREMIUM cards (Premier / Strata / Prestige). Non-premium
  // cards transfer ~30% lower; we model the premium baseline and note it.
  'citi-typ': [
    { to: 'american', ratio: '1:1', multiplier: 1, minimum: 1000, note: 'Premium Citi card required for 1:1; non-premium ~1:0.7' },
    { to: 'krisflyer', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'turkish', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'virgin-atlantic', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'flying-blue', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'qatar', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'qantas', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'cathay', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'etihad', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'lifemiles', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'jetblue', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'emirates', ratio: '1:0.8', multiplier: 0.8, minimum: 1000, note: '1,000 Citi points = 800 Skywards miles (premium card)' },
  ],

  // --- Capital One Miles ---------------------------------------------------
  // Mostly 1:1; transfers route to Star Alliance (Aeroplan/Avianca/Singapore)
  // for United, since Cap One does NOT partner with United/American/Southwest/
  // Delta/Alaska directly. Emirates is 2:1.5.
  'capital-one': [
    { to: 'aeroplan', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'avios-ba', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'iberia', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'flying-blue', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'krisflyer', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'virgin-atlantic', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'turkish', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'qatar', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'qantas', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'cathay', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'etihad', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'lifemiles', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'emirates', ratio: '2:1.5', multiplier: 0.75, minimum: 1000, note: '1,000 Cap One miles = 750 Skywards miles' },
  ],

  // --- Bilt Rewards --------------------------------------------------------
  // 1:1 across the board for the registry-mapped partners. Bilt is the ONLY
  // major currency that reaches Alaska (Atmos) 1:1. Min transfer is status-
  // dependent (2,000 Blue / 1,000 Silver+).
  'bilt': [
    { to: 'alaska', ratio: '1:1', multiplier: 1, minimum: 1000, note: 'Bilt is the only transferable currency that reaches Alaska/Atmos' },
    { to: 'united', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'southwest', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'aeroplan', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'avios-ba', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'iberia', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'flying-blue', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'virgin-atlantic', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'emirates', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'cathay', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'turkish', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'qatar', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'lifemiles', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'hyatt', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'marriott', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'hilton', ratio: '1:1', multiplier: 1, minimum: 1000 },
    { to: 'ihg', ratio: '1:1', multiplier: 1, minimum: 1000 },
  ],
}

// --- Internal lookups -------------------------------------------------------

// Canonical source id -> its display label, derived from the registry so the
// `source` string returned to callers stays canonical ("Amex Membership Rewards").
function sourceLabel(sourceId: string): string {
  return programById(sourceId)?.name ?? sourceId
}

// Does a balance row represent the given canonical source currency? Resolve the
// row's free-text program/code through the registry and compare ids. Falls back
// to a loose string compare when canonicalization can't place the row.
function balanceIsSource(balance: Balance, sourceId: string): boolean {
  const fromProgram = canonicalizeProgram(balance.program)?.id
  if (fromProgram === sourceId) return true
  const fromCode = balance.code ? canonicalizeProgram(balance.code)?.id : undefined
  if (fromCode === sourceId) return true
  return false
}

// Resolve a balance row to its canonical program id. Tries the free-text program
// name first, then the monogram code. Returns undefined when neither resolves.
function balanceProgramId(balance: Balance): string | undefined {
  const fromProgram = canonicalizeProgram(balance.program)?.id
  if (fromProgram) return fromProgram
  return balance.code ? canonicalizeProgram(balance.code)?.id : undefined
}

// --- Public API -------------------------------------------------------------

// Backward-compatible: which of the user's balances can REACH targetProgram via
// a transfer, and at what ratio. Used by lib/search.ts to flag transfer plays.
//
// Ratio-aware: each returned TransferSource carries the real display ratio for
// that specific edge (1:1, 5:4, 1:2 …), not a hardcoded "1:1". Only sources the
// user actually holds (balance > 0) are returned.
export function transfersTo(targetProgram: string, balances: Balance[]): TransferSource[] {
  const target = canonicalizeProgram(targetProgram)?.id
  if (!target) return []

  const result: TransferSource[] = []
  for (const [sourceId, edges] of Object.entries(GRAPH)) {
    const edge = edges.find((e) => e.to === target)
    if (!edge) continue

    const held = balances.find((b) => balanceIsSource(b, sourceId) && b.balance > 0)
    if (!held) continue

    result.push({ source: sourceLabel(sourceId), ratio: edge.ratio })
  }
  return result
}

// Richer variant for the LLM-narration / detail layers: the full edge (ratio,
// multiplier, minimum, note) for every source the user holds that reaches the
// target. Lets the deterministic engine compute "transfer N source points to
// land M partner points" without the model touching the math.
export interface TransferRoute extends TransferEdge {
  sourceId: string
  source: string // display label
  held: number // user's current balance in the source currency
}

export function transferRoutesTo(targetProgram: string, balances: Balance[]): TransferRoute[] {
  const target = canonicalizeProgram(targetProgram)?.id
  if (!target) return []

  const routes: TransferRoute[] = []
  for (const [sourceId, edges] of Object.entries(GRAPH)) {
    const edge = edges.find((e) => e.to === target)
    if (!edge) continue
    const held = balances.find((b) => balanceIsSource(b, sourceId) && b.balance > 0)
    if (!held) continue
    routes.push({ ...edge, sourceId, source: sourceLabel(sourceId), held: held.balance })
  }
  return routes
}

// Source points required to LAND `partnerPointsNeeded` in the destination of an
// edge, accounting for the ratio. Deterministic — the model never computes this.
// e.g. Amex->Hilton (1:2): need 30k Hilton -> 15k Amex. Amex->Cathay (5:4): need
// 30k Asia Miles -> 37,500 Amex. Rounded UP to the nearest source point.
export function sourcePointsFor(edge: TransferEdge, partnerPointsNeeded: number): number {
  if (partnerPointsNeeded <= 0 || edge.multiplier <= 0) return 0
  return Math.ceil(partnerPointsNeeded / edge.multiplier)
}

// All verified edges out of a source currency (for menus / "where can I go").
export function partnersOf(sourceId: string): TransferEdge[] {
  return GRAPH[sourceId] ? [...GRAPH[sourceId]] : []
}

// The set of source currency ids the graph knows about.
export function transferSourceIds(): string[] {
  return Object.keys(GRAPH)
}

// --- Effective balance (direct-or-transferable) -----------------------------

// The best balance a user has TOWARD a target program, and how it's reached.
// `amount` is denominated in the TARGET program's currency (transfer ratio
// already applied). `via` records the path so the UI can narrate it.
export interface EffectiveBalance {
  // Best reachable amount in the TARGET program's currency (direct or post-transfer).
  amount: number
  // How that amount is reached: a direct holding, or a transfer from a bank currency.
  via:
    | { kind: 'direct'; program: string }
    | { kind: 'transfer'; source: string; ratio: string }
}

// Given a target program (free-text — an award option's program, a destination's
// bestProgram, …) and the user's balances, return the best direct-or-transferable
// balance in the TARGET currency and the path used. The engine — not the LLM —
// decides reachability and applies the ratio, so "you have" never lies.
//
// Resolution:
//   1. DIRECT hold of the target program -> the full balance counts (kind direct).
//   2. Else the best TRANSFER: any held source currency with a GRAPH edge to the
//      target. partnerPoints = sourceBalance * edge.multiplier; the edge.minimum
//      (when present) must be met. Ties broken by the largest resulting amount.
// Returns undefined when the target is unknown or the user can't reach it.
export function effectiveBalanceFor(
  targetProgram: string,
  balances: Balance[],
): EffectiveBalance | undefined {
  const target = canonicalizeProgram(targetProgram)
  if (!target) return undefined

  // A transferable bank currency is a SOURCE, never a booking program. If the
  // target canonicalized to a bank (e.g. an airline string that no registry
  // needle matched fell through to the leading bank token), a "direct hold" of
  // that bank is NOT bookable award miles — counting it would surface an
  // economically false unlock. Only its outbound transfers are valid, so skip
  // the direct branch and let the transfer pass decide.
  if (!target.transferable) {
    // 1. Direct hold wins outright — no transfer needed, the full balance counts.
    let directAmount = 0
    for (const b of balances) {
      if (b.balance > 0 && balanceProgramId(b) === target.id) {
        directAmount = Math.max(directAmount, b.balance)
      }
    }
    if (directAmount > 0) {
      return { amount: directAmount, via: { kind: 'direct', program: target.name } }
    }
  }

  // 2. Best transfer path. Walk every held source currency's edges; if one reaches
  //    the target, apply the multiplier (respecting any minimum) and keep the largest.
  let best: EffectiveBalance | undefined
  for (const b of balances) {
    if (b.balance <= 0) continue
    const srcId = balanceProgramId(b)
    if (!srcId) continue
    const edges = GRAPH[srcId]
    if (!edges) continue
    const edge = edges.find((e) => e.to === target.id)
    if (!edge) continue
    // Respect the per-transfer minimum: too small a balance can't move at all.
    if (edge.minimum != null && b.balance < edge.minimum) continue
    const amount = Math.floor(b.balance * edge.multiplier)
    if (amount <= 0) continue
    if (!best || amount > best.amount) {
      // Label the source with the user's OWN balance string ("Amex MR"), not the
      // canonical name — it's what they'll recognize on their card.
      best = { amount, via: { kind: 'transfer', source: b.program, ratio: edge.ratio } }
    }
  }
  return best
}

// --- SOURCES (verified 2026-06) ---------------------------------------------
// Amex:  upgradedpoints.com/credit-cards/amex-membership-rewards-transfer-partners/,
//        nerdwallet.com/travel/learn/the-best-amex-transfer-partners-and-ones-to-avoid,
//        thepointsguy.com/credit-cards/membership-rewards-partner-guide/
//        (Cathay/Emirates 5:4; JetBlue 1:0.8; Hilton 1:2; Etihad ends 2026-06-30;
//         no United/American/Southwest/Alaska).
// Chase: upgradedpoints.com/credit-cards/chase-ultimate-rewards-transfer-partners/,
//        thepointsguy.com/loyalty-programs/chase-ultimate-rewards-transfer-partners/,
//        nerdwallet.com/travel/learn/chase-transfer-partners-guide
//        (Hyatt 4:3 phase-in 2026; Emirates dropped 2025-10-16).
// Citi:  upgradedpoints.com/credit-cards/citi-thankyou-points-transfer-partners/,
//        frequentmiler.com/citi-thankyou-rewards-airline-and-hotel-transfer-partners/,
//        nerdwallet.com/travel/learn/citi-transfer-partners-guide
//        (American added; premium-card 1:1 vs non-premium ~1:0.7; Emirates 1:0.8).
// Cap1:  upgradedpoints.com/credit-cards/capital-one-transfer-partners/,
//        thepointsguy.com/loyalty-programs/capital-one-transfer-partners/,
//        nerdwallet.com/travel/learn/capital-one-transfer-partners-guide
//        (Emirates 2:1.5; no direct United/American/Southwest/Delta/Alaska).
// Bilt:  support.biltrewards.com/hc/en-us/articles/19086448638989-Bilt-s-Transfer-Partners,
//        nerdwallet.com/travel/learn/bilt-transfer-partners,
//        frequentmiler.com/bilt-adds-preferred-hotels-i-prefer-as-new-transfer-partner-at-12-ratio/
//        (only currency reaching Alaska/Atmos 1:1; status-based minimums).
