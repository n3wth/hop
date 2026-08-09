import { describe, it, expect, vi, afterEach } from 'vitest'
import { listValuations, MAX_CPP } from '@/lib/valuations'
import { PROGRAMS } from '@/lib/programs'

// getValuationOverrides is DB-backed; mock it directly so these tests exercise
// the merge logic (freshness / sample-size / clamp / canonicalization gates)
// without needing a real Supabase instance.
const { getValuationOverridesMock } = vi.hoisted(() => ({
  getValuationOverridesMock: vi.fn(),
}))
vi.mock('@/lib/valuation-overrides', () => ({
  getValuationOverrides: getValuationOverridesMock,
}))

const { getLiveValuations, liveValuationsByName } = await import('@/lib/valuations-live')

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('getLiveValuations() — falls back to the static baseline', () => {
  it('matches lib/valuations.ts exactly when there are no overrides', async () => {
    getValuationOverridesMock.mockResolvedValue([])
    const live = await getLiveValuations()
    const baseline = listValuations()
    for (const [id, cpp] of Object.entries(baseline)) {
      expect(live[id]).toEqual({ cpp, sampleSize: 0, asOf: '', isLive: false })
    }
  })

  it('never throws and falls back to baseline even if the override read rejects', async () => {
    // getValuationOverrides() is withDb-wrapped and should never reject in
    // practice — this guards the merge itself against a contract violation.
    getValuationOverridesMock.mockRejectedValue(new Error('db down'))
    const live = await getLiveValuations()
    const baseline = listValuations()
    for (const [id, cpp] of Object.entries(baseline)) {
      expect(live[id].cpp).toBe(cpp)
      expect(live[id].isLive).toBe(false)
    }
  })
})

describe('getLiveValuations() — applies a trusted, fresh override', () => {
  it('overwrites a program only when sampleSize >= 20 and asOf is fresh (<14 days)', async () => {
    getValuationOverridesMock.mockResolvedValue([
      { programId: 'amex-mr', cpp: 2.4, sampleSize: 20, asOf: daysAgo(1) },
    ])
    const live = await getLiveValuations()
    expect(live['amex-mr']).toEqual({ cpp: 2.4, sampleSize: 20, asOf: expect.any(String), isLive: true })
  })

  it('ignores an override with sampleSize below the trust threshold', async () => {
    getValuationOverridesMock.mockResolvedValue([
      { programId: 'amex-mr', cpp: 2.4, sampleSize: 19, asOf: daysAgo(1) },
    ])
    const live = await getLiveValuations()
    expect(live['amex-mr'].isLive).toBe(false)
    expect(live['amex-mr'].cpp).toBe(listValuations()['amex-mr'])
  })

  it('ignores a stale override (asOf older than 14 days)', async () => {
    getValuationOverridesMock.mockResolvedValue([
      { programId: 'amex-mr', cpp: 2.4, sampleSize: 50, asOf: daysAgo(15) },
    ])
    const live = await getLiveValuations()
    expect(live['amex-mr'].isLive).toBe(false)
    expect(live['amex-mr'].cpp).toBe(listValuations()['amex-mr'])
  })

  it('ignores an override with an unparseable asOf', async () => {
    getValuationOverridesMock.mockResolvedValue([
      { programId: 'amex-mr', cpp: 2.4, sampleSize: 50, asOf: 'not-a-date' },
    ])
    const live = await getLiveValuations()
    expect(live['amex-mr'].isLive).toBe(false)
  })

  it('ignores an override for an unknown / uncanonicalizable program id', async () => {
    getValuationOverridesMock.mockResolvedValue([
      { programId: 'not-a-real-program', cpp: 3.0, sampleSize: 50, asOf: daysAgo(1) },
    ])
    const live = await getLiveValuations()
    expect(live['not-a-real-program']).toBeUndefined()
    // and no unrelated baseline entry was disturbed
    for (const [id, cpp] of Object.entries(listValuations())) {
      expect(live[id].cpp).toBe(cpp)
    }
  })

  it('distrusts a saturated override (pinned to a clamp band edge) and falls back to baseline', async () => {
    // An out-of-band trimmed mean is a saturated clamp artifact, not a
    // measurement — the concierge must never ground on it.
    getValuationOverridesMock.mockResolvedValue([
      { programId: 'delta', cpp: 999, sampleSize: 50, asOf: daysAgo(1) }, // clamps to MAX_CPP
      { programId: 'hilton', cpp: -5, sampleSize: 50, asOf: daysAgo(1) }, // clamps to MIN_CPP
      { programId: 'avios-ba', cpp: MAX_CPP, sampleSize: 35, asOf: daysAgo(1) }, // already at the edge
    ])
    const live = await getLiveValuations()
    for (const id of ['delta', 'hilton', 'avios-ba']) {
      expect(live[id].isLive).toBe(false)
      expect(live[id].cpp).toBe(listValuations()[id])
    }
  })

  it('trusts an override that sits just inside the band', async () => {
    getValuationOverridesMock.mockResolvedValue([
      { programId: 'delta', cpp: MAX_CPP - 0.01, sampleSize: 50, asOf: daysAgo(1) },
    ])
    const live = await getLiveValuations()
    expect(live['delta'].isLive).toBe(true)
    expect(live['delta'].cpp).toBe(MAX_CPP - 0.01)
  })

  it('rejects a non-finite cpp override entirely (falls back to baseline)', async () => {
    getValuationOverridesMock.mockResolvedValue([
      { programId: 'delta', cpp: NaN, sampleSize: 50, asOf: daysAgo(1) },
    ])
    const live = await getLiveValuations()
    expect(live['delta'].isLive).toBe(false)
    expect(live['delta'].cpp).toBe(listValuations()['delta'])
  })
})

describe('liveValuationsByName() — keyed by canonical program name', () => {
  it('mirrors valuationsByName() when there are no overrides', async () => {
    getValuationOverridesMock.mockResolvedValue([])
    const byName = await liveValuationsByName()
    expect(Object.keys(byName).length).toBe(PROGRAMS.length)
    const amex = PROGRAMS.find((p) => p.id === 'amex-mr')!
    expect(byName[amex.name]).toBe(listValuations()['amex-mr'])
  })

  it('reflects a trusted override under the program NAME key', async () => {
    getValuationOverridesMock.mockResolvedValue([
      { programId: 'amex-mr', cpp: 2.4, sampleSize: 30, asOf: daysAgo(1) },
    ])
    const byName = await liveValuationsByName()
    const amex = PROGRAMS.find((p) => p.id === 'amex-mr')!
    expect(byName[amex.name]).toBe(2.4)
  })
})
