import { describe, it, expect } from 'vitest'
import {
  transfersTo,
  transferRoutesTo,
  sourcePointsFor,
  partnersOf,
  transferSourceIds,
  effectiveBalanceFor,
  type TransferEdge,
} from '../transfers'
import type { Balance } from '@/lib/types'

const makeBalance = (program: string, code: string, balance: number): Balance => ({
  program,
  code,
  balance,
})

// Balances are free-text (AwardWallet displayNames, manual entry); transfersTo
// canonicalizes them through lib/programs, so "Amex MR" and "Amex Membership
// Rewards" both resolve to the amex-mr source. Returned `source` is canonical.
describe('transfersTo()', () => {
  const balances: Balance[] = [
    makeBalance('Amex MR', 'AX', 50000),
    makeBalance('Chase UR', 'UR', 30000),
    makeBalance('Bilt', 'BR', 10000),
  ]

  it('returns direct partners (Chase UR, Bilt) for United award', () => {
    const result = transfersTo('United MileagePlus', balances)
    const sources = result.map((r) => r.source)
    expect(sources).toContain('Chase Ultimate Rewards')
    expect(sources).toContain('Bilt Rewards')
    // Amex does NOT partner with United.
    expect(sources).not.toContain('Amex Membership Rewards')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns [] for a program the registry cannot resolve', () => {
    expect(transfersTo('Some Random Airline', balances)).toEqual([])
  })

  it('returns [] for a real program no held currency reaches (American)', () => {
    // American is only a Citi partner; none of these balances reach it.
    expect(transfersTo('American AAdvantage', balances)).toEqual([])
  })

  it('matches Alaska tolerantly and only via Bilt', () => {
    const result = transfersTo('Alaska Atmos Rewards', balances)
    const sources = result.map((r) => r.source)
    expect(sources).toEqual(['Bilt Rewards'])
  })

  it('matches BA Avios across all three held currencies', () => {
    const result = transfersTo('British Airways Avios', balances)
    const sources = result.map((r) => r.source)
    expect(sources).toContain('Amex Membership Rewards')
    expect(sources).toContain('Chase Ultimate Rewards')
    expect(sources).toContain('Bilt Rewards')
  })

  it('excludes sources with zero balance', () => {
    const zeroBalances: Balance[] = [
      makeBalance('Amex MR', 'AX', 0),
      makeBalance('Chase UR', 'UR', 30000),
    ]
    const result = transfersTo('United MileagePlus', zeroBalances)
    const sources = result.map((r) => r.source)
    expect(sources).not.toContain('Amex Membership Rewards')
    expect(sources).toContain('Chase Ultimate Rewards')
  })

  it('returns [] when balances array is empty', () => {
    expect(transfersTo('United MileagePlus', [])).toEqual([])
  })

  it('is ratio-aware: surfaces the real edge ratio, not a hardcoded 1:1', () => {
    // Amex -> Hilton is 1:2; Amex -> Cathay is 5:4.
    const hilton = transfersTo('Hilton Honors', balances)
    expect(hilton.find((r) => r.source === 'Amex Membership Rewards')?.ratio).toBe('1:2')

    const cathay = transfersTo('Cathay Pacific Asia Miles', balances)
    expect(cathay.find((r) => r.source === 'Amex Membership Rewards')?.ratio).toBe('5:4')
  })

  it('canonicalizes verbose balance program names', () => {
    const verbose: Balance[] = [makeBalance('Amex Membership Rewards', 'AX', 25000)]
    const result = transfersTo('Delta SkyMiles', verbose)
    expect(result.map((r) => r.source)).toEqual(['Amex Membership Rewards'])
  })
})

describe('transferRoutesTo()', () => {
  const balances: Balance[] = [makeBalance('Amex MR', 'AX', 60000)]

  it('returns the full edge with multiplier, minimum, and held balance', () => {
    const routes = transferRoutesTo('Hilton Honors', balances)
    expect(routes).toHaveLength(1)
    const r = routes[0]
    expect(r.sourceId).toBe('amex-mr')
    expect(r.source).toBe('Amex Membership Rewards')
    expect(r.to).toBe('hilton')
    expect(r.multiplier).toBe(2)
    expect(r.minimum).toBe(1000)
    expect(r.held).toBe(60000)
  })

  it('returns [] for an unreachable target', () => {
    expect(transferRoutesTo('American AAdvantage', balances)).toEqual([])
  })
})

describe('sourcePointsFor()', () => {
  it('1:1 edge needs equal source points', () => {
    const edge: TransferEdge = { to: 'united', ratio: '1:1', multiplier: 1 }
    expect(sourcePointsFor(edge, 30000)).toBe(30000)
  })

  it('1:2 hotel edge needs HALF the source points', () => {
    const edge: TransferEdge = { to: 'hilton', ratio: '1:2', multiplier: 2 }
    expect(sourcePointsFor(edge, 30000)).toBe(15000)
  })

  it('5:4 edge needs MORE source points, rounded up', () => {
    const edge: TransferEdge = { to: 'cathay', ratio: '5:4', multiplier: 0.8 }
    // 30000 / 0.8 = 37500
    expect(sourcePointsFor(edge, 30000)).toBe(37500)
    // 1 partner point / 0.8 = 1.25 -> ceil 2
    expect(sourcePointsFor(edge, 1)).toBe(2)
  })

  it('returns 0 for non-positive input', () => {
    const edge: TransferEdge = { to: 'united', ratio: '1:1', multiplier: 1 }
    expect(sourcePointsFor(edge, 0)).toBe(0)
    expect(sourcePointsFor(edge, -100)).toBe(0)
  })
})

describe('effectiveBalanceFor()', () => {
  it('returns undefined for a program the registry cannot resolve', () => {
    const balances = [makeBalance('Amex MR', 'AX', 50000)]
    expect(effectiveBalanceFor('Some Random Airline', balances)).toBeUndefined()
  })

  it('counts a DIRECT hold at full balance', () => {
    // User holds Delta SkyMiles directly toward a Delta redemption.
    const balances = [makeBalance('Delta SkyMiles', 'DL', 42000)]
    const eff = effectiveBalanceFor('Delta SkyMiles', balances)
    expect(eff).toEqual({
      amount: 42000,
      via: { kind: 'direct', program: 'Delta SkyMiles' },
    })
  })

  it('prefers a DIRECT hold over a transfer path', () => {
    // Holds Avios directly AND Amex MR (which transfers to Avios). Direct wins.
    const balances = [
      makeBalance('British Airways Avios', 'BA', 12000),
      makeBalance('Amex MR', 'AX', 99000),
    ]
    const eff = effectiveBalanceFor('British Airways Avios', balances)
    expect(eff?.via.kind).toBe('direct')
    expect(eff?.amount).toBe(12000)
  })

  it('counts a TRANSFER-partner hold via Amex MR, ratio applied (1:1)', () => {
    // No direct ANA; Amex MR transfers to ANA 1:1. amount = balance * 1.
    const balances = [makeBalance('Amex MR', 'AX', 50000)]
    const eff = effectiveBalanceFor('ANA Mileage Club', balances)
    expect(eff).toEqual({
      amount: 50000,
      via: { kind: 'transfer', source: 'Amex MR', ratio: '1:1' },
    })
  })

  it('applies a non-1:1 transfer ratio (Amex -> Hilton 1:2)', () => {
    // Amex MR -> Hilton is 1:2 (multiplier 2): 50k Amex lands 100k Hilton.
    const balances = [makeBalance('Amex MR', 'AX', 50000)]
    const eff = effectiveBalanceFor('Hilton Honors', balances)
    expect(eff?.via).toEqual({ kind: 'transfer', source: 'Amex MR', ratio: '1:2' })
    expect(eff?.amount).toBe(100000)
  })

  it('keeps the LARGEST resulting amount across multiple transfer sources', () => {
    // BA Avios is reachable from both Amex (50k) and Chase (30k), both 1:1.
    const balances = [
      makeBalance('Amex MR', 'AX', 50000),
      makeBalance('Chase UR', 'UR', 30000),
    ]
    const eff = effectiveBalanceFor('British Airways Avios', balances)
    expect(eff?.amount).toBe(50000)
    expect(eff?.via).toEqual({ kind: 'transfer', source: 'Amex MR', ratio: '1:1' })
  })

  it('returns undefined when no held currency reaches the target', () => {
    // American is only a Citi partner; an Amex-only holder can't reach it.
    const balances = [makeBalance('Amex MR', 'AX', 50000)]
    expect(effectiveBalanceFor('American AAdvantage', balances)).toBeUndefined()
  })

  it('returns undefined for empty balances', () => {
    expect(effectiveBalanceFor('ANA Mileage Club', [])).toBeUndefined()
  })

  it('never counts a DIRECT bank holding as bookable award miles', () => {
    // A bank string canonicalizes to a transferable currency. Holding it
    // directly must NOT report a direct award balance — a bank is a source,
    // never a booking program (guards against false unlocks).
    const balances = [makeBalance('Amex MR', 'AX', 50000)]
    const eff = effectiveBalanceFor('Amex Membership Rewards', balances)
    // No outbound edge to itself, so the only would-be path (a direct hold)
    // is suppressed and the result is unreachable.
    expect(eff).toBeUndefined()
  })

  it('ignores a transfer source below the edge minimum', () => {
    // Amex -> Qantas requires 500; 400 Amex can't move at all.
    const balances = [makeBalance('Amex MR', 'AX', 400)]
    expect(effectiveBalanceFor('Qantas Frequent Flyer', balances)).toBeUndefined()
  })
})

describe('graph integrity', () => {
  it('exposes all five major transferable currencies as sources', () => {
    const ids = transferSourceIds()
    for (const id of ['amex-mr', 'chase-ur', 'citi-typ', 'capital-one', 'bilt']) {
      expect(ids).toContain(id)
    }
  })

  it('every edge points at a real registry program id', async () => {
    const { programById } = await import('../programs')
    for (const id of transferSourceIds()) {
      for (const edge of partnersOf(id)) {
        expect(programById(edge.to), `${id} -> ${edge.to}`).toBeDefined()
      }
    }
  })

  it('every edge has a sane multiplier and matching display ratio shape', () => {
    for (const id of transferSourceIds()) {
      for (const edge of partnersOf(id)) {
        expect(edge.multiplier).toBeGreaterThan(0)
        expect(edge.ratio).toMatch(/^\d+(\.\d+)?:\d+(\.\d+)?$/)
      }
    }
  })

  it('only Bilt reaches Alaska (no other currency claims it)', () => {
    for (const id of transferSourceIds()) {
      const reachesAlaska = partnersOf(id).some((e) => e.to === 'alaska')
      if (id === 'bilt') expect(reachesAlaska).toBe(true)
      else expect(reachesAlaska, `${id} must not claim Alaska`).toBe(false)
    }
  })

  it('only Amex reaches Delta (no other currency claims it)', () => {
    for (const id of transferSourceIds()) {
      const reachesDelta = partnersOf(id).some((e) => e.to === 'delta')
      if (id === 'amex-mr') expect(reachesDelta).toBe(true)
      else expect(reachesDelta, `${id} must not claim Delta`).toBe(false)
    }
  })

  it('does not claim American Airlines for anything but Citi', () => {
    for (const id of transferSourceIds()) {
      const reachesAA = partnersOf(id).some((e) => e.to === 'american')
      if (id === 'citi-typ') expect(reachesAA).toBe(true)
      else expect(reachesAA, `${id} must not claim American`).toBe(false)
    }
  })

  it('has no duplicate destination edges within a source', () => {
    for (const id of transferSourceIds()) {
      const tos = partnersOf(id).map((e) => e.to)
      expect(new Set(tos).size).toBe(tos.length)
    }
  })
})
