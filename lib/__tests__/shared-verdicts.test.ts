import { describe, expect, it, vi } from 'vitest'
import type { FlightOption, SearchResult } from '@/lib/types'
import {
  buildVerdictSnapshot,
  createSharedVerdict,
  getSharedVerdict,
  newReceiptId,
  shareVerdict,
  validateShareParams,
  validateSnapshot,
  verdictContentHash,
} from '@/lib/shared-verdicts'
import { _resetRateLimitForTest } from '@/lib/rate-limit'

// Mock env flag dynamically
vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env')
  return {
    ...actual,
    isShareReceiptsEnabled: () => true,
  }
})

describe('buildVerdictSnapshot', () => {
  const baseOption: FlightOption = {
    id: 'opt1',
    kind: 'award',
    airline: 'Air Canada',
    program: 'Aeroplan',
    route: 'SFO → NRT',
    date: 'Nov 1',
    cabin: 'business',
    miles: 60000,
    taxes: 50,
    cashPrice: 850,
    cpp: 2.9,
    tier: 'green',
    youHave: 100000,
    action: 'book-points',
    bookingUrl: 'https://example.com',
  }

  const baseCashOption: FlightOption = {
    id: 'cash1',
    kind: 'cash',
    airline: 'Zipair',
    route: 'SFO → NRT',
    date: 'Nov 1',
    cashPrice: 850,
    tier: 'muted',
    bookingUrl: 'https://example.com',
    action: 'pay-cash',
  }

  const baseResult: SearchResult = {
    params: { from: 'SFO', to: 'NRT', depart: '2026-11-01', adults: 1, cabin: 'business' },
    options: [baseOption],
    pick: baseOption,
    cashOption: baseCashOption,
    verdict: 'use-points',
    summary: { cheapestCash: 850, bestMiles: 60000, bestCpp: 2.9, saveVsCash: 412 },
    balances: [],
    degraded: [],
  }

  it('builds a full snapshot from a clean use-points result', () => {
    const snap = buildVerdictSnapshot(baseResult)
    expect(snap).not.toBeNull()
    if (!snap) return

    expect(snap.route).toBe('SFO → NRT')
    expect(snap.from).toBe('SFO')
    expect(snap.to).toBe('NRT')
    expect(snap.depart).toBe('2026-11-01')
    expect(snap.adults).toBe(1)
    expect(snap.cabin).toBe('business')
    expect(snap.verdict).toBe('use-points')
    expect(snap.summary.cheapestCash).toBe(850)
    expect(snap.summary.saveVsCash).toBe(412)
    expect(snap.pick.airline).toBe('Air Canada')
    expect(snap.pick.miles).toBe(60000)
    expect(snap.pick.cpp).toBe(2.9)
    expect(snap.pick.tier).toBe('green')
    expect(snap.asOf).toBeDefined()
  })

  it('returns null when degraded is non-empty (strict gate)', () => {
    const degradedResult: SearchResult = {
      ...baseResult,
      degraded: ['awards'],
    }
    expect(buildVerdictSnapshot(degradedResult)).toBeNull()
  })

  it('returns null when pay-cash has degraded award side', () => {
    const degradedPayCash: SearchResult = {
      ...baseResult,
      verdict: 'pay-cash',
      degraded: ['awards'],
    }
    expect(buildVerdictSnapshot(degradedPayCash)).toBeNull()
  })

  it('returns null when verdict is none', () => {
    const noneResult: SearchResult = {
      ...baseResult,
      verdict: 'none',
    }
    expect(buildVerdictSnapshot(noneResult)).toBeNull()
  })

  it('returns null when use-points is missing pick', () => {
    const noPickResult: SearchResult = {
      ...baseResult,
      pick: undefined,
    }
    expect(buildVerdictSnapshot(noPickResult)).toBeNull()
  })

  it('returns null when summary is missing cheapestCash', () => {
    const noCashSummary: SearchResult = {
      ...baseResult,
      summary: {},
    }
    expect(buildVerdictSnapshot(noCashSummary)).toBeNull()
  })

  it('structurally omits sensitive keys (youHave, action, bookingUrl, balances)', () => {
    const snap = buildVerdictSnapshot(baseResult)
    expect(snap).not.toBeNull()
    if (!snap) return

    expect('youHave' in snap.pick).toBe(false)
    expect('action' in snap.pick).toBe(false)
    expect('bookingUrl' in snap.pick).toBe(false)
    expect('id' in snap.pick).toBe(false)

    // Verify stringified output contains no balance/action keys
    const json = JSON.stringify(snap)
    expect(json).not.toContain('youHave')
    expect(json).not.toContain('bookingUrl')
    expect(json).not.toContain('balances')
  })

  it('preserves boundary cpp values and tiers without re-deriving', () => {
    const result25: SearchResult = {
      ...baseResult,
      options: [{ ...baseOption, cpp: 2.5, tier: 'amber' }],
      pick: { ...baseOption, cpp: 2.5, tier: 'amber' },
      summary: { cheapestCash: 850, bestMiles: 60000, bestCpp: 2.5, saveVsCash: 200 },
    }
    const snap = buildVerdictSnapshot(result25)
    expect(snap?.pick.cpp).toBe(2.5)
    expect(snap?.pick.tier).toBe('amber')
  })
})

describe('validateShareParams', () => {
  it('accepts clean one-way and round-trip params', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

    const validOneWay = validateShareParams({
      from: 'sfo',
      to: 'nrt',
      depart: tomorrow,
    })
    expect(validOneWay).toEqual({
      from: 'SFO',
      to: 'NRT',
      depart: tomorrow,
      adults: 1,
    })

    const validRoundTrip = validateShareParams({
      from: 'JFK',
      to: 'LHR',
      depart: tomorrow,
      return: nextWeek,
      cabin: 'business',
      adults: '2',
    })
    expect(validRoundTrip).toEqual({
      from: 'JFK',
      to: 'LHR',
      depart: tomorrow,
      return: nextWeek,
      cabin: 'business',
      adults: 2,
    })
  })

  it('rejects invalid or missing inputs without default-filling', () => {
    expect(validateShareParams({})).toBeNull()
    expect(validateShareParams({ from: 'SFO' })).toBeNull()
    expect(validateShareParams({ from: 'SFO', to: 'SFO', depart: '2026-12-01' })).toBeNull()
    expect(validateShareParams({ from: 'INVALID', to: 'NRT', depart: '2026-12-01' })).toBeNull()
    expect(validateShareParams({ from: 'SFO', to: 'NRT', depart: '2020-01-01' })).toBeNull()
    expect(
      validateShareParams({
        from: 'SFO',
        to: 'NRT',
        depart: '2026-12-10',
        return: '2026-12-01',
      }),
    ).toBeNull()
    expect(
      validateShareParams({
        from: 'SFO',
        to: 'NRT',
        depart: '2026-12-01',
        cabin: 'invalid-cabin',
      }),
    ).toBeNull()
    expect(
      validateShareParams({
        from: 'SFO',
        to: 'NRT',
        depart: '2026-12-01',
        adults: '15',
      }),
    ).toBeNull()
  })
})

describe('newReceiptId', () => {
  it('generates a 12-char base32 string and consecutive calls differ', () => {
    const id1 = newReceiptId()
    const id2 = newReceiptId()
    expect(id1).toMatch(/^[a-z2-7]{12}$/)
    expect(id2).toMatch(/^[a-z2-7]{12}$/)
    expect(id1).not.toBe(id2)
  })
})

describe('verdictContentHash', () => {
  it('produces stable, key-order independent hashes for the same UTC day', () => {
    const params1 = { from: 'SFO', to: 'NRT', depart: '2026-11-01', adults: 1 }
    const params2 = { adults: 1, depart: '2026-11-01', to: 'NRT', from: 'SFO' }

    const hash1 = verdictContentHash(params1, '2026-07-23')
    const hash2 = verdictContentHash(params2, '2026-07-23')
    expect(hash1).toBe(hash2)

    // Different day -> different hash
    const hash3 = verdictContentHash(params1, '2026-07-24')
    expect(hash1).not.toBe(hash3)
  })
})

describe('validateSnapshot', () => {
  it('validates good snapshot and rejects invalid snapshot JSON', () => {
    const validSnap = {
      route: 'SFO → NRT',
      from: 'SFO',
      to: 'NRT',
      depart: '2026-11-01',
      adults: 1,
      verdict: 'use-points',
      summary: { cheapestCash: 850, bestMiles: 60000, bestCpp: 2.9, saveVsCash: 412 },
      pick: {
        kind: 'award',
        airline: 'Air Canada',
        miles: 60000,
        cpp: 2.9,
        tier: 'green',
      },
      asOf: '2026-07-23T00:00:00.000Z',
    }

    expect(validateSnapshot(validSnap)).not.toBeNull()
    expect(validateSnapshot(null)).toBeNull()
    expect(validateSnapshot({})).toBeNull()
    expect(validateSnapshot({ ...validSnap, verdict: 'invalid-verdict' })).toBeNull()
    expect(
      validateSnapshot({ ...validSnap, pick: { ...validSnap.pick, cpp: 'not-a-number' } }),
    ).toBeNull()
  })
})

describe('persistence fallbacks (no DB configured)', () => {
  it('createSharedVerdict and getSharedVerdict degrade gracefully when DB is unconfigured', async () => {
    const params = { from: 'SFO', to: 'NRT', depart: '2026-11-01', adults: 1 }
    const snap = {
      route: 'SFO → NRT',
      from: 'SFO',
      to: 'NRT',
      depart: '2026-11-01',
      adults: 1,
      verdict: 'use-points' as const,
      summary: { cheapestCash: 850 },
      pick: {
        kind: 'award' as const,
        airline: 'Air Canada',
        tier: 'green' as const,
      },
      asOf: '2026-07-23T00:00:00.000Z',
    }

    const created = await createSharedVerdict({ params, snapshot: snap, createdBy: null })
    expect(created.ok).toBe(false)
    if (!created.ok) {
      expect(created.reason).toBe('unavailable')
    }

    const fetched = await getSharedVerdict('nonexistent123')
    expect(fetched).toBeNull()
  })
})

describe('shareVerdict orchestration & rate limits', () => {
  it('enforces rate limits', async () => {
    _resetRateLimitForTest()
    const raw = {
      from: 'SFO',
      to: 'NRT',
      depart: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    }

    // Exhaust capacity (capacity is 5)
    for (let i = 0; i < 5; i++) {
      await shareVerdict({ raw, rateLimitKey: 'test-ip', createdBy: null })
    }

    // 6th call should be rate-limited
    const res = await shareVerdict({ raw, rateLimitKey: 'test-ip', createdBy: null })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.reason).toBe('rate-limited')
    }
  })
})
