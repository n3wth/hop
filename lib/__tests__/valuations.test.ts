import { describe, it, expect } from 'vitest'
import {
  programValue,
  valueOfPoints,
  listValuations,
  valuationsByName,
  clampCpp,
  walletValue,
  WALLET_VALUE_CAVEAT,
  GENERIC_BASELINE,
  MIN_CPP,
  MAX_CPP,
} from '../valuations'
import { PROGRAMS, programById } from '../programs'
import type { Balance } from '../types'

describe('baseline table coverage', () => {
  it('prices every canonical program', () => {
    const table = listValuations()
    for (const p of PROGRAMS) {
      expect(table[p.id], `${p.id} missing from baseline`).toBeTypeOf('number')
    }
  })

  it('every baseline value is within the sane band', () => {
    for (const cpp of Object.values(listValuations())) {
      expect(cpp).toBeGreaterThanOrEqual(MIN_CPP)
      expect(cpp).toBeLessThanOrEqual(MAX_CPP)
    }
  })
})

describe('programValue()', () => {
  it('returns the published baseline for known programs', () => {
    expect(programValue('amex-mr')).toBe(2.0)
    expect(programValue('chase-ur')).toBe(2.05)
    expect(programValue('bilt')).toBe(2.2)
    expect(programValue('delta')).toBe(1.2)
    expect(programValue('hilton')).toBe(0.35)
  })

  it('degrades to GENERIC_BASELINE for unknown ids — never throws or undefined', () => {
    expect(programValue('not-a-program')).toBe(GENERIC_BASELINE)
    expect(programValue('')).toBe(GENERIC_BASELINE)
  })
})

describe('valueOfPoints()', () => {
  it('computes dollar value as points * cpp / 100', () => {
    // 100k Amex MR at 2.0cpp = $2000
    expect(valueOfPoints('amex-mr', 100_000)).toBe(2000)
    // 60k Chase UR at 2.05cpp = $1230
    expect(valueOfPoints('chase-ur', 60_000)).toBe(1230)
    // 50k Hilton at 0.35cpp = $175
    expect(valueOfPoints('hilton', 50_000)).toBe(175)
  })

  it('returns 0 for non-positive or invalid point counts', () => {
    expect(valueOfPoints('amex-mr', 0)).toBe(0)
    expect(valueOfPoints('amex-mr', -5)).toBe(0)
    expect(valueOfPoints('amex-mr', NaN)).toBe(0)
    expect(valueOfPoints('amex-mr', Infinity)).toBe(0)
  })

  it('uses GENERIC_BASELINE for unknown program ids', () => {
    expect(valueOfPoints('mystery', 10_000)).toBe(Math.round(10_000 * GENERIC_BASELINE) / 100)
  })
})

describe('valuationsByName()', () => {
  it('keys by canonical program name', () => {
    const byName = valuationsByName()
    expect(byName['Amex Membership Rewards']).toBe(2.0)
    expect(byName['World of Hyatt']).toBe(1.55)
    // one entry per program
    expect(Object.keys(byName).length).toBe(PROGRAMS.length)
  })
})

describe('clampCpp()', () => {
  it('clamps to the sane band', () => {
    expect(clampCpp(50)).toBe(MAX_CPP)
    expect(clampCpp(0)).toBe(MIN_CPP)
    expect(clampCpp(2.0)).toBe(2.0)
  })

  it('rounds to 2 decimals', () => {
    expect(clampCpp(1.23456)).toBe(1.23)
  })

  it('rejects non-finite / non-number input', () => {
    expect(clampCpp(NaN)).toBeNull()
    expect(clampCpp(Infinity)).toBeNull()
    expect(clampCpp('2.0')).toBeNull()
    expect(clampCpp(null)).toBeNull()
    expect(clampCpp(undefined)).toBeNull()
  })
})

describe('registry integration', () => {
  it('every priced id resolves to a real program', () => {
    for (const id of Object.keys(listValuations())) {
      expect(programById(id), `${id} is not a canonical program`).toBeDefined()
    }
  })
})

describe('walletValue()', () => {
  it('returns 0 for empty, missing, or falsy balances — never throws', () => {
    expect(walletValue([])).toBe(0)
    expect(walletValue(null)).toBe(0)
    expect(walletValue(undefined)).toBe(0)
  })

  it('canonicalizes free-text program names before pricing', () => {
    const balances: Balance[] = [
      { program: 'Amex Membership Rewards', code: 'AX', balance: 100_000 },
    ]
    // 100k Amex MR at 2.0cpp = $2000, canonicalized via lib/programs.
    expect(walletValue(balances)).toBe(2000)
  })

  it('falls back to GENERIC_BASELINE for an unrecognized program', () => {
    const balances: Balance[] = [{ program: 'Mystery Rewards Co', code: 'MR', balance: 10_000 }]
    expect(walletValue(balances)).toBe(Math.round(10_000 * GENERIC_BASELINE) / 100)
  })

  it('sums a mix of known and unknown programs and rounds to the nearest dollar', () => {
    const balances: Balance[] = [
      { program: 'Amex Membership Rewards', code: 'AX', balance: 100_000 }, // $2000 @ 2.0cpp
      { program: 'Hilton Honors', code: 'HH', balance: 50_000 }, // $175 @ 0.35cpp
      { program: 'Not A Real Program', code: 'NR', balance: 10_000 }, // $100 @ GENERIC_BASELINE
    ]
    expect(walletValue(balances)).toBe(2275)
  })

  it('ignores non-positive or malformed balance entries instead of throwing', () => {
    const balances = [
      { program: 'Amex Membership Rewards', code: 'AX', balance: 0 },
      { program: 'Delta SkyMiles', code: 'DL', balance: -500 },
      { program: 'Chase Ultimate Rewards', code: 'UR', balance: Number.NaN },
    ] as Balance[]
    expect(walletValue(balances)).toBe(0)
  })

  it('exposes a non-empty caveat string', () => {
    expect(WALLET_VALUE_CAVEAT.length).toBeGreaterThan(0)
  })
})
