import { describe, it, expect } from 'vitest'
import {
  applyMutation,
  runCounterfactual,
  type Mutation,
} from '@/lib/counterfactual'
import { destinations } from '@/lib/destinations'
import { effectiveBalanceFor } from '@/lib/transfers'
import type { Balance } from '@/lib/types'

// A small, explicit baseline portfolio used across cases.
const base: Balance[] = [
  { program: 'Chase Ultimate Rewards', code: 'UR', balance: 10_000 },
  { program: 'Delta SkyMiles', code: 'DL', balance: 60_000 },
]

describe('applyMutation — perturbs a CLONE, never the input', () => {
  it('does not mutate the caller’s array or rows', () => {
    const snapshot = JSON.stringify(base)
    applyMutation(base, { op: 'add', program: 'chase ur', amount: 50_000 })
    expect(JSON.stringify(base)).toBe(snapshot)
  })

  it('add: credits points on top of an existing balance', () => {
    const after = applyMutation(base, { op: 'add', program: 'chase', amount: 50_000 })
    const ur = after.find((b) => b.code === 'UR')
    expect(ur?.balance).toBe(60_000)
  })

  it('add: creates a row when the program isn’t held yet', () => {
    const after = applyMutation(base, { op: 'add', program: 'amex', amount: 25_000 })
    const amex = after.find((b) => /membership rewards/i.test(b.program))
    expect(amex?.balance).toBe(25_000)
  })

  it('set: replaces the balance with an exact amount', () => {
    const after = applyMutation(base, { op: 'set', program: 'chase ur', amount: 100_000 })
    const ur = after.find((b) => b.code === 'UR')
    expect(ur?.balance).toBe(100_000)
  })

  it('swap: moves the FROM balance into TO and drops FROM', () => {
    const after = applyMutation(base, { op: 'swap', from: 'delta', to: 'alaska' })
    expect(after.find((b) => /skymiles/i.test(b.program))).toBeUndefined()
    const alaska = after.find((b) => /alaska/i.test(b.program))
    expect(alaska?.balance).toBe(60_000)
  })

  it('swap: unknown program ids leave the clone unchanged', () => {
    const after = applyMutation(base, { op: 'swap', from: 'not-a-program', to: 'alaska' })
    expect(after).toHaveLength(base.length)
  })
})

describe('runCounterfactual — same engine, on the clone', () => {
  it('unlocks Hawaii (Alaska) by swapping Delta -> Alaska', () => {
    // Maui/Honolulu book via Alaska Mileage Plan @ 22,500. Holding Delta doesn’t
    // reach Alaska; swapping 60k Delta -> Alaska clears it.
    const beforeMaui = effectiveBalanceFor('Alaska Mileage Plan', base)?.amount ?? 0
    expect(beforeMaui).toBe(0)

    const res = runCounterfactual(base, { op: 'swap', from: 'delta', to: 'alaska' })
    const codes = res.unlocked.map((d) => d.code)
    expect(codes).toContain('OGG')
    expect(codes).toContain('HNL')
  })

  it('dollarValue equals the summed typical cash of the unlocked trips', () => {
    const res = runCounterfactual(base, { op: 'swap', from: 'delta', to: 'alaska' })
    const expected = res.unlocked.reduce((sum, d) => sum + d.cashUsd, 0)
    expect(res.dollarValue).toBe(expected)
    expect(res.unlockedCount).toBe(res.unlocked.length)
  })

  it('adding transferable points unlocks long-haul awards', () => {
    // +100k Amex MR transfers 1:1 to ANA (Tokyo @ 37,500), Singapore, etc.
    const res = runCounterfactual(base, { op: 'add', program: 'amex', amount: 100_000 })
    const codes = res.unlocked.map((d) => d.code)
    expect(codes).toContain('NRT') // Tokyo via ANA / Amex MR
    expect(res.dollarValue).toBeGreaterThan(0)
  })

  it('improved is a superset of unlocked (every unlock also improved headroom)', () => {
    const res = runCounterfactual(base, { op: 'add', program: 'amex', amount: 100_000 })
    const improvedCodes = new Set(res.improved.map((d) => d.code))
    for (const u of res.unlocked) {
      expect(improvedCodes.has(u.code)).toBe(true)
    }
  })

  it('a no-op-ish mutation (adding a program hop can’t book) unlocks nothing', () => {
    // Southwest is not a destination booking program in the dataset.
    const res = runCounterfactual([], { op: 'add', program: 'southwest', amount: 200_000 })
    expect(res.unlocked).toHaveLength(0)
    expect(res.dollarValue).toBe(0)
  })

  it('is deterministic — same inputs, identical output', () => {
    const m: Mutation = { op: 'add', program: 'amex', amount: 100_000 }
    const a = runCounterfactual(base, m)
    const b = runCounterfactual(base, m)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('unlocked is sorted by cpp descending', () => {
    const res = runCounterfactual(base, { op: 'add', program: 'amex', amount: 500_000 })
    for (let i = 1; i < res.unlocked.length; i++) {
      const prev = res.unlocked[i - 1].cpp ?? 0
      const cur = res.unlocked[i].cpp ?? 0
      expect(prev).toBeGreaterThanOrEqual(cur)
    }
  })

  it('a giant Amex add unlocks no MORE than the full dataset', () => {
    const res = runCounterfactual([], { op: 'add', program: 'amex', amount: 10_000_000 })
    expect(res.unlocked.length).toBeLessThanOrEqual(destinations.length)
  })

  it('mutation label reads with the canonical program name', () => {
    const res = runCounterfactual(base, { op: 'add', program: 'chase ur', amount: 50_000 })
    expect(res.mutation.label).toBe('+50,000 Chase Ultimate Rewards')
    const swap = runCounterfactual(base, { op: 'swap', from: 'delta', to: 'alaska' })
    expect(swap.mutation.label).toBe('Alaska Mileage Plan instead of Delta SkyMiles')
  })
})
