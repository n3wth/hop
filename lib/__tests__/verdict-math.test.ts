// The math must add up — literally, on screen. These tests lock the round-trip
// parity fix (RT cash vs per-direction awards) and the on-screen closure rule:
// cash − savings = the taxes we show. They run the mock fixtures through the
// REAL assembleSearch, exactly what a MOCK=1 /search renders and what
// SampleVerdict/copy-spec.md quote as the canonical worked example.
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { assembleSearch } from '@/lib/search'
import { destinations, computeCpp } from '@/lib/destinations'

const RT = { from: 'SFO', to: 'LAX', depart: '2026-07-09', return: '2026-07-12', adults: 1 }
const OW = { from: 'SFO', to: 'LAX', depart: '2026-07-09', adults: 1 }

describe('verdict math (mock through the real engine)', () => {
  beforeEach(() => {
    process.env.MOCK = '1'
  })
  afterEach(() => {
    delete process.env.MOCK
  })

  it('round trip: award side is scaled to both legs (the canonical example)', async () => {
    const r = await assembleSearch(RT)
    expect(r.pick).toBeTruthy()
    // Alaska saver: 4,500 mi + $11.20 per direction → 9,000 mi + $22.40 RT.
    expect(r.pick!.miles).toBe(9000)
    expect(r.pick!.taxes).toBeCloseTo(22.4, 5)
    // cpp = (254 − 22.40) × 100 / 9000 = 2.6 — never RT cash over one-way miles.
    expect(r.pick!.cpp).toBe(2.6)
    expect(r.summary.cheapestCash).toBe(254)
    expect(r.summary.saveVsCash).toBe(232)
    expect(r.verdict).toBe('use-points')
  })

  it('one way: cash fixture halves so the verdict math is consistent', async () => {
    const r = await assembleSearch(OW)
    expect(r.pick).toBeTruthy()
    expect(r.pick!.miles).toBe(4500)
    expect(r.summary.cheapestCash).toBe(127)
    // Same redemption quality either way: (127 − 11.20) × 100 / 4500 = 2.6.
    expect(r.pick!.cpp).toBe(2.6)
  })

  it('closure: cash − savings equals the taxes shown (nothing hidden)', async () => {
    for (const params of [RT, OW]) {
      const r = await assembleSearch(params)
      if (r.summary.saveVsCash && r.summary.cheapestCash != null && r.pick) {
        expect(r.summary.saveVsCash).toBe(
          Math.round(r.summary.cheapestCash - (r.pick.taxes ?? 0)),
        )
      }
    }
  })

  it('party scaling still composes with leg scaling', async () => {
    const r = await assembleSearch({ ...RT, adults: 2 })
    // 2 seats × 2 legs × 4,500 mi; cpp ratio is preserved.
    expect(r.pick!.miles).toBe(18000)
    expect(r.pick!.cpp).toBe(2.6)
  })
})

describe('destinations dataset plausibility', () => {
  it('economy rows sit in a believable saver band (no formula-uniform data)', () => {
    const econ = destinations.filter((d) => !d.cabin)
    expect(econ.length).toBeGreaterThan(0)
    const cpps = econ.map((d) => computeCpp(d)!)
    for (const v of cpps) {
      expect(v).toBeGreaterThanOrEqual(1.0)
      expect(v).toBeLessThanOrEqual(3.0)
    }
    // Spread check: identical-ratio datasets read as generated. At least five
    // distinct cpp values across the economy rows.
    expect(new Set(cpps.map((v) => v.toFixed(1))).size).toBeGreaterThanOrEqual(5)
  })

  it('premium-value rows are all cabin-labeled (never an unlabeled 8¢/pt)', () => {
    for (const d of destinations) {
      const v = computeCpp(d)!
      if (v > 3.5) expect(d.cabin, `${d.code} shows ${v}¢/pt without a cabin label`).toBeTruthy()
      if (d.cabin) expect(v).toBeGreaterThanOrEqual(4.0)
    }
  })
})
