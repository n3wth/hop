import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  runPriceTrip,
  runSweetSpots,
  runTransferPaths,
  runVerdict,
} from '@/lib/mcp-tools'
import { destinationByCode, computeCpp, topValue } from '@/lib/destinations'
import { partnersOf } from '@/lib/transfers'

// The MCP tool handlers MUST be a pure passthrough to hop's deterministic engine
// — they introduce no economics of their own. These tests prove every figure a
// tool returns is read from the engine (computeCpp / destinationByCode / topValue
// / partnersOf / assembleSearch), never invented by the wrapper.

describe('runPriceTrip() — passthrough to the engine', () => {
  it('returns the engine error shape for an unknown code', () => {
    const out = runPriceTrip({ destinationCode: 'ZZZ' })
    expect('error' in out).toBe(true)
    if ('error' in out) expect(out.code).toBe('ZZZ')
  })

  it('quotes miles/cash/cpp straight from the dataset', () => {
    const out = runPriceTrip({ destinationCode: 'NRT' })
    const d = destinationByCode('NRT')!
    if ('error' in out) throw new Error('expected a result')
    expect(out.milesNeeded).toBe(d.typicalAwardMiles)
    expect(out.cashUsd).toBe(d.typicalCashUSD)
    expect(out.cpp).toBe(computeCpp(d))
    expect(out.bestProgram).toBe(d.bestProgram)
  })

  it('reflects supplied balances in affordability (engine effectiveBalanceFor)', () => {
    const d = destinationByCode('NRT')!
    // Give a direct balance in the best program well above what's needed.
    const out = runPriceTrip({
      destinationCode: 'NRT',
      balances: [{ program: d.bestProgram, balance: d.typicalAwardMiles + 50000 }],
    })
    if ('error' in out) throw new Error('expected a result')
    expect(out.affordable).toBe(true)
    expect(out.youHave).toBeGreaterThanOrEqual(d.typicalAwardMiles)
  })

  it('without balances leaves affordability unknown (no false claims)', () => {
    const out = runPriceTrip({ destinationCode: 'NRT' })
    if ('error' in out) throw new Error('expected a result')
    expect(out.youHave).toBeUndefined()
    expect(out.affordable).toBeUndefined()
  })
})

describe('runSweetSpots() — passthrough to topValue', () => {
  it('returns the top-N by CPP, each figure from the engine', () => {
    const out = runSweetSpots({ limit: 5 })
    const expected = topValue(5)
    expect(out.sweetSpots).toHaveLength(5)
    out.sweetSpots.forEach((s, i) => {
      const d = expected[i]
      expect(s.code).toBe(d.code)
      expect(s.milesNeeded).toBe(d.typicalAwardMiles)
      expect(s.cpp).toBe(computeCpp(d))
    })
  })

  it('defaults to 8', () => {
    const out = runSweetSpots({})
    expect(out.sweetSpots.length).toBe(Math.min(8, topValue(8).length))
  })
})

describe('runTransferPaths() — passthrough to the transfer graph', () => {
  it('unknown program -> error shape', () => {
    const out = runTransferPaths({ program: 'Definitely Not A Program' })
    expect('error' in out).toBe(true)
  })

  it('a bank currency returns its outbound partners with ratios', () => {
    const out = runTransferPaths({ program: 'Amex MR' })
    if ('error' in out) throw new Error('expected a result')
    expect(out.direction).toBe('outbound')
    if (out.direction !== 'outbound') throw new Error('narrowing')
    const edges = partnersOf('amex-mr')
    expect(out.partners.length).toBe(edges.length)
    // Ratios mirror the engine edges exactly.
    const aeroplan = out.partners.find((p) => p.toId === 'aeroplan')
    const aeroEdge = edges.find((e) => e.to === 'aeroplan')
    expect(aeroplan?.ratio).toBe(aeroEdge?.ratio)
    expect(aeroplan?.multiplier).toBe(aeroEdge?.multiplier)
  })

  it('an airline program returns inbound bank sources', () => {
    const out = runTransferPaths({ program: 'Aeroplan' })
    if ('error' in out) throw new Error('expected a result')
    expect(out.direction).toBe('inbound')
    if (out.direction !== 'inbound') throw new Error('narrowing')
    // Amex MR reaches Aeroplan, so it must appear as a source.
    expect(out.sources.length).toBeGreaterThan(0)
  })
})

describe('runVerdict() — passthrough to assembleSearch (mock fixtures)', () => {
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
    const out = await runVerdict({ from: 'sfo', to: 'lhr', depart: '2026-09-01' })
    expect(out.route).toBe('SFO → LHR')
    expect(['use-points', 'pay-cash', 'none']).toContain(out.verdict)
    expect(out.summary).toBeTypeOf('object')
    expect(Array.isArray(out.options)).toBe(true)
  })

  it('caps options at 6 and never leaks booking URLs', async () => {
    const out = await runVerdict({
      from: 'SFO',
      to: 'LHR',
      depart: '2026-09-01',
      balances: [{ program: 'Amex Membership Rewards', balance: 200000 }],
    })
    expect(out.options.length).toBeLessThanOrEqual(6)
    for (const o of out.options) {
      expect(o).not.toHaveProperty('bookingUrl')
    }
  })
})
