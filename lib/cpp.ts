import type { CppTier, FlightOption } from '@/lib/types'

export function cpp(cashPrice: number, taxes: number, miles: number): number | undefined {
  if (!cashPrice || cashPrice <= 0) return undefined
  if (miles <= 0) return undefined
  return Math.round(((cashPrice - taxes) * 100 / miles) * 10) / 10
}

export function tier(value: number | undefined): CppTier {
  if (value === undefined) return 'muted'
  if (value >= 3.0) return 'green'
  if (value >= 1.5) return 'amber'
  return 'muted'
}

export function rankOptions(options: FlightOption[]): FlightOption[] {
  return [...options].sort((a, b) => {
    if (a.cpp === undefined && b.cpp === undefined) return 0
    if (a.cpp === undefined) return 1
    if (b.cpp === undefined) return -1
    return b.cpp - a.cpp
  })
}
