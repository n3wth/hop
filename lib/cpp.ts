import type { CppTier, FlightOption } from '@/lib/types'

// The "use points" verdict line. The single owner of this number — lib/search.ts
// re-exports it for existing call sites, and anything else that needs the same
// threshold (standing-order watches, the concierge) imports it from here, never
// re-declares it, so a re-tune of the line can't silently fork.
export const POINTS_THRESHOLD_CPP = 2.5

// tier() boundaries, named and exported so any surface describing "what counts
// as a good redemption" (e.g. the /guides/point-value explainer) pulls the real
// numbers instead of hand-typing them — never a second source of truth.
export const GREEN_TIER_CPP = 3.0
export const AMBER_TIER_CPP = 1.5
export const TIER_GREEN_CPP = GREEN_TIER_CPP
export const TIER_AMBER_CPP = AMBER_TIER_CPP

export function cpp(cashPrice: number, taxes: number, miles: number): number | undefined {
  if (!cashPrice || cashPrice <= 0) return undefined
  if (miles <= 0) return undefined
  return Math.round(((cashPrice - taxes) * 100 / miles) * 10) / 10
}

export function tier(value: number | undefined): CppTier {
  if (value === undefined) return 'muted'
  if (value >= GREEN_TIER_CPP) return 'green'
  if (value >= AMBER_TIER_CPP) return 'amber'
  return 'muted'
}

// Render a cpp value as the canonical user-facing unit: "5.4¢/pt". Never show a
// raw "cpp" label or "¢/mile" to users. One decimal place, matching cpp()'s
// rounding. Does not change cpp()/tier()/rankOptions() or the thresholds.
export function formatValue(value: number): string {
  return `${value.toFixed(1)}¢/pt`
}

export function rankOptions(options: FlightOption[]): FlightOption[] {
  return [...options].sort((a, b) => {
    if (a.cpp === undefined && b.cpp === undefined) return 0
    if (a.cpp === undefined) return 1
    if (b.cpp === undefined) return -1
    return b.cpp - a.cpp
  })
}
