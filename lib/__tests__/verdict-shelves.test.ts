import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Balance } from '@/lib/types'
import { destinations } from '@/lib/destinations'
import { reachableDestinations } from '@/lib/ledger-dream'

// getValuationOverrides is DB-backed; mock it so liveValuationStats() exercises
// the intersection/ranking logic without needing a real Supabase instance
// (mirrors lib/__tests__/valuations-live.test.ts's own pattern).
const { getValuationOverridesMock } = vi.hoisted(() => ({
  getValuationOverridesMock: vi.fn(),
}))
vi.mock('@/lib/valuation-overrides', () => ({
  getValuationOverrides: getValuationOverridesMock,
}))

const {
  dreamRotationSlots,
  unlockedByTransfer,
  liveValuationStats,
  MAX_DREAM_SLOTS,
} = await import('@/lib/verdict-shelves')

const b = (program: string, balance: number, code = ''): Balance => ({
  program,
  code,
  balance,
})

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('dreamRotationSlots — reachable rotation bounds', () => {
  it('collapses to a single save-toward slot when nothing is reachable', () => {
    const slots = dreamRotationSlots([])
    expect(slots).toHaveLength(1)
    expect(slots[0].saveToward).toBe(true)
  })

  it('returns exactly as many slots as distinct reachable dreams, up to the cap', () => {
    // A modest Amex MR balance reaches a handful of dreams, but not dozens.
    const balances = [b('Amex Membership Rewards', 40000, 'AX')]
    const slots = dreamRotationSlots(balances)
    expect(slots.length).toBeGreaterThan(0)
    expect(slots.length).toBeLessThanOrEqual(MAX_DREAM_SLOTS)
    expect(slots.every((d) => d.saveToward === false)).toBe(true)
    // Each slot is a genuinely different destination (walks the ranked list).
    const codes = new Set(slots.map((d) => d.destination.code))
    expect(codes.size).toBe(slots.length)
  })

  it('caps at MAX_DREAM_SLOTS (default 6) even when many more are reachable', () => {
    // A huge Amex MR balance makes the vast majority of the dataset both
    // affordable (total-points gate) and specifically reachable (transfer).
    const balances = [b('Amex Membership Rewards', 5_000_000, 'AX')]
    const slots = dreamRotationSlots(balances)
    expect(slots).toHaveLength(MAX_DREAM_SLOTS)
  })

  it('honors a caller-supplied maxSlots', () => {
    const balances = [b('Amex Membership Rewards', 5_000_000, 'AX')]
    expect(dreamRotationSlots(balances, 3)).toHaveLength(3)
    // Never fewer than 1, even if maxSlots is 0 or negative.
    expect(dreamRotationSlots(balances, 0)).toHaveLength(1)
  })
})

describe('unlockedByTransfer — transfer-unlock exclusion of already-affordable rows', () => {
  it('is empty with no balances', () => {
    expect(unlockedByTransfer([])).toEqual([])
  })

  it('only returns destinations reached via a TRANSFER, never a direct hold', () => {
    const balances = [b('Amex Membership Rewards', 200000, 'AX')]
    const items = unlockedByTransfer(balances)
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(item.source).toBeTruthy()
      expect(item.effectiveBalance).toBeGreaterThanOrEqual(item.destination.typicalAwardMiles)
    }
  })

  it('excludes a destination the member can already book DIRECTLY', () => {
    // Alaska Mileage Plan is held directly and well above the award — the
    // transfer-unlock shelf must never show it (it needs no transfer).
    const alaskaDest = destinations.find((d) => d.bestProgram === 'Alaska Mileage Plan')!
    const balances = [
      b('Amex Membership Rewards', 200000, 'AX'),
      b('Alaska Mileage Plan', alaskaDest.typicalAwardMiles + 50000, 'AS'),
    ]
    const items = unlockedByTransfer(balances)
    expect(items.some((i) => i.destination.code === alaskaDest.code)).toBe(false)
  })

  it('excludes overlap with whatever the caller says is already shown (Within reach)', () => {
    const balances = [b('Amex Membership Rewards', 200000, 'AX')]
    const all = unlockedByTransfer(balances)
    expect(all.length).toBeGreaterThan(1)
    const shownCodes = all.slice(0, 1).map((i) => i.destination.code)
    const filtered = unlockedByTransfer(balances, shownCodes)
    expect(filtered.some((i) => shownCodes.includes(i.destination.code))).toBe(false)
    expect(filtered.length).toBe(all.length - shownCodes.length)
  })

  it('never overlaps with reachableDestinations() picks fed as excludeCodes (disjoint shelves)', () => {
    const balances = [b('Amex Membership Rewards', 200000, 'AX')]
    const withinReachCodes = reachableDestinations(balances)
      .slice(0, 8)
      .map((d) => d.code)
    const unlocked = unlockedByTransfer(balances, withinReachCodes)
    for (const item of unlocked) {
      expect(withinReachCodes).not.toContain(item.destination.code)
    }
  })
})

describe('liveValuationStats — live-valuation intersection', () => {
  it('is empty with no balances (no DB call needed)', async () => {
    getValuationOverridesMock.mockResolvedValue([])
    expect(await liveValuationStats([])).toEqual([])
    expect(getValuationOverridesMock).not.toHaveBeenCalled()
  })

  it('is empty when no override is live/trusted, even with balances held', async () => {
    getValuationOverridesMock.mockResolvedValue([])
    const stats = await liveValuationStats([b('Amex Membership Rewards', 100000, 'AX')])
    expect(stats).toEqual([])
  })

  it('intersects a trusted live override with a HELD program only', async () => {
    getValuationOverridesMock.mockResolvedValue([
      { programId: 'amex-mr', cpp: 2.4, sampleSize: 25, asOf: daysAgo(1) },
      // United isn't held below, so it must not appear even though it's live.
      { programId: 'united', cpp: 3.1, sampleSize: 30, asOf: daysAgo(1) },
    ])
    const stats = await liveValuationStats([b('Amex Membership Rewards', 100000, 'AX')])
    expect(stats).toHaveLength(1)
    expect(stats[0].programId).toBe('amex-mr')
    expect(stats[0].liveCpp).toBe(2.4)
    expect(stats[0].delta).toBe(Math.round((2.4 - stats[0].baselineCpp) * 100) / 100)
  })

  it('excludes a held program whose override exists but is not yet trusted', async () => {
    getValuationOverridesMock.mockResolvedValue([
      { programId: 'amex-mr', cpp: 2.4, sampleSize: 5, asOf: daysAgo(1) },
    ])
    const stats = await liveValuationStats([b('Amex Membership Rewards', 100000, 'AX')])
    expect(stats).toEqual([])
  })

  it('ranks by (live − baseline) delta, descending — biggest upside first', async () => {
    getValuationOverridesMock.mockResolvedValue([
      { programId: 'amex-mr', cpp: 2.05, sampleSize: 25, asOf: daysAgo(1) },
      { programId: 'chase-ur', cpp: 3.8, sampleSize: 25, asOf: daysAgo(1) },
    ])
    const stats = await liveValuationStats([
      b('Amex Membership Rewards', 100000, 'AX'),
      b('Chase Ultimate Rewards', 50000, 'UR'),
    ])
    expect(stats).toHaveLength(2)
    expect(stats[0].delta).toBeGreaterThanOrEqual(stats[1].delta)
    expect(stats[0].programId).toBe('chase-ur')
  })

  it('ranks a negative delta BELOW a positive one, even if larger in magnitude', async () => {
    // A program that came in cheaper than baseline should sink below one that
    // beat baseline, even though its |delta| is bigger — the plan ranks by
    // signed (live − baseline), not by surprise magnitude.
    getValuationOverridesMock.mockResolvedValue([
      { programId: 'amex-mr', cpp: 0.5, sampleSize: 25, asOf: daysAgo(1) }, // big negative delta
      { programId: 'chase-ur', cpp: 3.2, sampleSize: 25, asOf: daysAgo(1) }, // small positive delta
    ])
    const stats = await liveValuationStats([
      b('Amex Membership Rewards', 100000, 'AX'),
      b('Chase Ultimate Rewards', 50000, 'UR'),
    ])
    expect(stats).toHaveLength(2)
    expect(stats[0].programId).toBe('chase-ur')
    expect(stats[0].delta).toBeGreaterThan(0)
    expect(stats[1].programId).toBe('amex-mr')
    expect(stats[1].delta).toBeLessThan(0)
  })

  it('ignores a zero/negative balance row even if its program is live', async () => {
    getValuationOverridesMock.mockResolvedValue([
      { programId: 'amex-mr', cpp: 2.4, sampleSize: 25, asOf: daysAgo(1) },
    ])
    const stats = await liveValuationStats([b('Amex Membership Rewards', 0, 'AX')])
    expect(stats).toEqual([])
  })

  it('never throws when the override read rejects', async () => {
    getValuationOverridesMock.mockRejectedValue(new Error('db down'))
    const stats = await liveValuationStats([b('Amex Membership Rewards', 100000, 'AX')])
    expect(stats).toEqual([])
  })
})
