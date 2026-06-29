// Dynamic point valuations — the deterministic backbone hop reasons with when it
// decides "points or cash", how much a balance is really worth, and whether a
// trip is a good redemption. Pure (no JSX, no top-level I/O) so the baseline
// table + clamping are fully unit-testable.
//
// THESIS ALIGNMENT (non-negotiable): the LLM never ORIGINATES economics. The
// baseline table below is the source of truth — published community valuations,
// hand-curated. valueOfPoints() and programValue() are pure arithmetic over it.
// A wrong number is fatal to the moat, so economics live in this constant table.
//
// Keyed by lib/programs.ts canonical ids (the program-registry agent's slugs).

import { PROGRAMS } from '@/lib/programs'

// --- Baseline table ---------------------------------------------------------
// Cents per point/mile. Grounded in published 2025–2026 community valuations
// (primarily The Points Guy's June 2026 monthly valuations, cross-checked with
// NerdWallet and Upgraded Points). These are TYPICAL achievable values via a
// good transfer/redemption — not floor (cash-out) nor ceiling (outsized) values.
// Sources are reported alongside this module; refresh quarterly.
//
// Every canonical program id in lib/programs.ts MUST have an entry here — the
// test suite asserts full coverage so a new program can never be silently
// unpriced (which would make valueOfPoints() fall back to GENERIC_BASELINE).
const BASELINE_CPP: Record<string, number> = {
  // Transferable bank currencies — assume transfer to a strong airline/hotel partner.
  'amex-mr': 2.0,
  'chase-ur': 2.05,
  'citi-typ': 1.9,
  'capital-one': 1.85,
  bilt: 2.2,

  // Airlines
  united: 1.35,
  delta: 1.2,
  american: 1.6,
  alaska: 1.4,
  southwest: 1.25,
  jetblue: 1.35,
  aeroplan: 1.4,
  'avios-ba': 1.4,
  'virgin-atlantic': 1.3,
  'flying-blue': 1.3,
  ana: 1.4,
  krisflyer: 1.3,
  emirates: 1.2,
  lifemiles: 1.4,
  qatar: 1.4,
  etihad: 1.2,
  qantas: 1.3,
  cathay: 1.3,
  turkish: 1.1,

  // Hotels
  hyatt: 1.55,
  marriott: 0.8,
  hilton: 0.35,
  ihg: 0.55,
}

// Fallback for a program id we don't recognize at all. A deliberately
// conservative ~1 cpp (a typical bank-points cash-out floor) so an unknown
// currency never overstates a balance's worth.
export const GENERIC_BASELINE = 1.0

// Sane clamp band for any cpp value. No real loyalty currency sits outside this
// band; floor is 0.3 because the worst real currency (Hilton Honors ~0.35cpp)
// must still fit inside it.
export const MIN_CPP = 0.3
export const MAX_CPP = 5.0

// --- Helpers ----------------------------------------------------------------

// Clamp an arbitrary number to the sane cpp band. NaN/Infinity/garbage -> null,
// so callers can fall back to the baseline rather than trust a bad value.
export function clampCpp(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < MIN_CPP) return MIN_CPP
  if (value > MAX_CPP) return MAX_CPP
  // round to 2 decimals — cpp is never meaningfully more precise than 0.01.
  return Math.round(value * 100) / 100
}

// --- Public API -------------------------------------------------------------

// Baseline cents-per-point for a canonical program id. Unknown ids degrade to
// GENERIC_BASELINE — never undefined, never a throw — so the caller always gets
// a usable number.
export function programValue(programId: string): number {
  return BASELINE_CPP[programId] ?? GENERIC_BASELINE
}

// Dollar value of a points balance: points * cpp / 100. Non-positive or invalid
// point counts return 0. Pure arithmetic over programValue() — the only place
// hop converts "a balance" into "money", and it never invents a rate.
export function valueOfPoints(programId: string, points: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0
  const cpp = programValue(programId)
  return Math.round(points * cpp) / 100
}

// The full baseline table (defensive copy) for menus, seeding, and the concierge
// prompt. Maps canonical id -> baseline cpp.
export function listValuations(): Record<string, number> {
  return { ...BASELINE_CPP }
}

// Baseline cpp keyed by canonical PROGRAM NAME (e.g. "Amex Membership Rewards").
// Convenience for the concierge prompt, which reasons in human program names.
export function valuationsByName(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of PROGRAMS) out[p.name] = programValue(p.id)
  return out
}
