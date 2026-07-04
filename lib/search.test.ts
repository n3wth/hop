import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { verdictSummary } from '@/lib/search'

// verdictSummary is the shared trim of assembleSearch's output that both
// lib/mcp-tools.ts#runVerdict and the /ask concierge's search_flights tool
// call — the guarantee under test is that BOTH surfaces read the exact same
// engine result for the same route/date (never two different backends).
describe('verdictSummary() — the shared verdict shape (mock fixtures)', () => {
  let prevMock: string | undefined
  beforeAll(() => {
    prevMock = process.env.MOCK
    process.env.MOCK = '1' // deterministic fixtures, no network
  })
  afterAll(() => {
    if (prevMock === undefined) delete process.env.MOCK
    else process.env.MOCK = prevMock
  })

  it('returns a verdict + summary + normalized route', async () => {
    const out = await verdictSummary({ from: 'SFO', to: 'LHR', depart: '2026-09-01', adults: 1 })
    expect(out.route).toBe('SFO → LHR')
    expect(['use-points', 'pay-cash', 'none']).toContain(out.verdict)
    expect(out.summary).toBeTypeOf('object')
    expect(Array.isArray(out.options)).toBe(true)
  })

  it('caps options at 6 and never leaks booking URLs or tiers', async () => {
    const out = await verdictSummary(
      { from: 'SFO', to: 'LHR', depart: '2026-09-01', adults: 1 },
      [{ program: 'Amex Membership Rewards', code: '', balance: 200000 }],
    )
    expect(out.options.length).toBeLessThanOrEqual(6)
    for (const o of out.options) {
      expect(o).not.toHaveProperty('bookingUrl')
      expect(o).not.toHaveProperty('tier')
    }
  })

  it('works for ANY airport pair, not just hop\'s curated destinations dataset', async () => {
    // FCA (Kalispell, MT) is not one of hop's curated ~30 inspiration
    // destinations — the engine must still run and resolve, never error out
    // for being "outside the dataset" (that restriction is UI/prompt-level
    // only, never baked into assembleSearch itself).
    const out = await verdictSummary({ from: 'SFO', to: 'FCA', depart: '2026-09-01', adults: 1 })
    expect(out.route).toBe('SFO → FCA')
    expect(['use-points', 'pay-cash', 'none']).toContain(out.verdict)
  })

  it('reports degraded sections rather than silently omitting them', async () => {
    const out = await verdictSummary({ from: 'SFO', to: 'LHR', depart: '2026-09-01', adults: 1 })
    expect(Array.isArray(out.degraded)).toBe(true)
  })
})

// Multi-passenger economics — the held-over P1 from the 2026-07-02 value-prop
// audit. Duffel cash totals cover the whole party; Seats.aero award miles/taxes
// are per-seat. assembleSearch must scale the award side (and, in MOCK mode,
// the per-seat cash fixtures) to the same party total so cpp compares
// like-for-like and never inflates by party size.
describe('multi-passenger economics — party totals on both legs', () => {
  let prevMock: string | undefined
  beforeAll(() => {
    prevMock = process.env.MOCK
    process.env.MOCK = '1'
  })
  afterAll(() => {
    if (prevMock === undefined) delete process.env.MOCK
    else process.env.MOCK = prevMock
  })

  const params = { from: 'SFO', to: 'NRT', depart: '2026-09-01' }

  it('leaves single-passenger figures untouched (regression guard)', async () => {
    const out = await verdictSummary({ ...params, adults: 1 })
    // The raw mock fixtures: $254 cheapest cash, Alaska 4,500 mi + $11.20 taxes.
    expect(out.summary.cheapestCash).toBe(254)
    expect(out.summary.bestMiles).toBe(4500)
    expect(out.pick?.taxes).toBeCloseTo(11.2, 6)
  })

  it('scales miles, taxes, and cash to the party while cpp stays per-point', async () => {
    const one = await verdictSummary({ ...params, adults: 1 })
    const four = await verdictSummary({ ...params, adults: 4 })
    expect(four.summary.cheapestCash).toBe((one.summary.cheapestCash ?? 0) * 4)
    expect(four.summary.bestMiles).toBe((one.summary.bestMiles ?? 0) * 4)
    expect(four.pick?.taxes).toBeCloseTo((one.pick?.taxes ?? 0) * 4, 6)
    // cpp is a per-point ratio — identical numerator/denominator scaling must
    // leave it (and therefore the verdict) unchanged.
    expect(four.summary.bestCpp).toBeCloseTo(one.summary.bestCpp ?? 0, 6)
    expect(four.verdict).toBe(one.verdict)
  })

  it('counts children as seats and lap infants as none', async () => {
    const one = await verdictSummary({ ...params, adults: 1 })
    const out = await verdictSummary({ ...params, adults: 2, children: 1, infants: 1 })
    // 2 adults + 1 child = 3 seats; the lap infant adds no miles and no cash.
    expect(out.summary.bestMiles).toBe((one.summary.bestMiles ?? 0) * 3)
    expect(out.summary.cheapestCash).toBe((one.summary.cheapestCash ?? 0) * 3)
    expect(out.summary.bestCpp).toBeCloseTo(one.summary.bestCpp ?? 0, 6)
  })

  it('the dollar savings figure scales with the party', async () => {
    const one = await verdictSummary({ ...params, adults: 1 })
    const two = await verdictSummary({ ...params, adults: 2 })
    if (one.verdict === 'use-points') {
      expect(two.summary.saveVsCash).toBe(
        Math.round((one.summary.cheapestCash ?? 0) * 2 - (one.pick?.taxes ?? 0) * 2),
      )
    }
  })
})
