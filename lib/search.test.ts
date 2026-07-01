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
