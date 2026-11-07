import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SearchParams } from '@/lib/types'
import { assembleSearch } from '@/lib/search'
import * as duffel from '@/lib/duffel'
import * as awards from '@/lib/awards'
import * as awardwallet from '@/lib/awardwallet'

const PARAMS: SearchParams = {
  from: 'SFO',
  to: 'LAX',
  depart: '2026-07-09',
  return: '2026-07-12',
  adults: 1,
}

// Snapshot + restore MOCK so individual tests can toggle the mock path.
const ORIGINAL_MOCK = process.env.MOCK

afterEach(() => {
  if (ORIGINAL_MOCK === undefined) delete process.env.MOCK
  else process.env.MOCK = ORIGINAL_MOCK
  vi.restoreAllMocks()
})

describe('assembleSearch — MOCK path', () => {
  beforeEach(() => {
    process.env.MOCK = '1'
  })

  it('Alaska is the pick and the verdict is use-points', async () => {
    const result = await assembleSearch(PARAMS)

    expect(result.pick).toBeDefined()
    expect(result.pick?.airlineCode).toBe('AS')
    expect(result.pick?.program).toContain('Alaska')
    expect(result.pick?.kind === 'award' || result.pick?.kind === 'transfer').toBe(true)
    expect(result.verdict).toBe('use-points')
  })

  it('options are ranked by cpp descending with the pick first', async () => {
    const result = await assembleSearch(PARAMS)

    expect(result.options.length).toBeGreaterThan(0)
    expect(result.options[0].id).toBe(result.pick?.id)

    const cpps = result.options
      .map((o) => o.cpp)
      .filter((c): c is number => c != null)
    const sorted = [...cpps].sort((a, b) => b - a)
    expect(cpps).toEqual(sorted)
  })

  it('summary reflects the points pick and balances load', async () => {
    const result = await assembleSearch(PARAMS)

    expect(result.summary.cheapestCash).toBe(254)
    expect(result.summary.bestMiles).toBe(result.pick?.miles)
    expect(result.summary.bestCpp).toBe(result.pick?.cpp)
    expect(result.summary.saveVsCash).toBeGreaterThan(0)
    expect(result.balances.length).toBeGreaterThan(0)
    expect(result.degraded).toEqual([])
  })

  it('saveVsCash is rounded to a whole dollar', async () => {
    const result = await assembleSearch(PARAMS)

    // ROUND TRIP: Alaska taxes are per direction (11.2 × 2 legs = 22.4).
    // cheapestCash 254 − 22.4 = 231.6 → 232
    expect(result.summary.saveVsCash).toBe(232)
    expect(Number.isInteger(result.summary.saveVsCash)).toBe(true)
  })

  it('an award in a program the user holds is "book-points", not transfer', async () => {
    const result = await assembleSearch(PARAMS)

    // Alaska: user holds 42,766 AS miles → book directly, kind stays award.
    const alaska = result.options.find((o) => o.airlineCode === 'AS')
    expect(alaska).toBeDefined()
    expect(alaska?.kind).toBe('award')
    expect(alaska?.action).toBe('book-points')
  })

  it('keeps Southwest as book-points (user holds WN)', async () => {
    const result = await assembleSearch(PARAMS)

    const wn = result.options.find((o) => o.airlineCode === 'WN')
    expect(wn?.kind).toBe('award')
    expect(wn?.action).toBe('book-points')
  })

  it('the Aeroplan row is a genuine transfer play', async () => {
    const result = await assembleSearch(PARAMS)

    // United · via Aeroplan: user does NOT hold Aeroplan directly, only reaches
    // it via Amex MR / Chase UR → transfer, not book-points.
    const aeroplan = result.options.find((o) =>
      o.program?.includes('Aeroplan'),
    )
    expect(aeroplan).toBeDefined()
    expect(aeroplan?.kind).toBe('transfer')
    expect(aeroplan?.action).toBe('transfer')
  })

  it('a weak award (cpp below 2.0) steers to cash', async () => {
    const result = await assembleSearch(PARAMS)

    // United MileagePlus at 1.8¢/pt → pay cash instead.
    const ua = result.options.find(
      (o) => o.program === 'United MileagePlus',
    )
    expect(ua).toBeDefined()
    expect(ua?.action).toBe('pay-cash')
  })

  it('cash options carry the book-cash action', async () => {
    const result = await assembleSearch(PARAMS)

    const cash = result.options.find((o) => o.kind === 'cash')
    expect(cash?.action).toBe('book-cash')
  })
})

describe('assembleSearch — live path degradation', () => {
  beforeEach(() => {
    delete process.env.MOCK
  })

  it('marks a failing source as degraded and still resolves', async () => {
    vi.spyOn(duffel, 'searchCash').mockResolvedValue({ ok: true, data: [] })
    vi.spyOn(awards, 'searchAwards').mockResolvedValue({
      ok: false,
      reason: 'simulated awards failure',
    })
    vi.spyOn(awardwallet, 'getBalances').mockResolvedValue({ ok: true, data: [] })

    const result = await assembleSearch(PARAMS)

    expect(result.degraded).toContain('awards')
    expect(result).toHaveProperty('verdict')
    expect(Array.isArray(result.options)).toBe(true)
  })

  it('handles all sources empty without crashing', async () => {
    vi.spyOn(duffel, 'searchCash').mockResolvedValue({ ok: true, data: [] })
    vi.spyOn(awards, 'searchAwards').mockResolvedValue({ ok: true, data: [] })
    vi.spyOn(awardwallet, 'getBalances').mockResolvedValue({ ok: true, data: [] })

    const result = await assembleSearch(PARAMS)

    expect(result.options).toEqual([])
    expect(result.pick).toBeUndefined()
    expect(result.verdict).toBe('none')
    expect(result.balances).toEqual([])
    expect(result.degraded).toEqual([])
  })

  it('collects failing cash + awards into degraded', async () => {
    vi.spyOn(duffel, 'searchCash').mockResolvedValue({ ok: false, reason: 'cash down' })
    vi.spyOn(awards, 'searchAwards').mockResolvedValue({ ok: false, reason: 'awards down' })
    vi.spyOn(awardwallet, 'getBalances').mockResolvedValue({ ok: false, reason: 'balances down' })

    const result = await assembleSearch(PARAMS)

    expect(result.degraded).toEqual(
      expect.arrayContaining(['cash', 'awards']),
    )
    expect(result.options).toEqual([])
    expect(result.verdict).toBe('none')
  })

  // A signed-out / no-program viewer has no wallet: balances are empty, never
  // degraded, and AwardWallet is never called live from the search path (live
  // calls from Vercel's rotating egress IPs trip AwardWallet's IP lockout).
  it('never calls AwardWallet for a signed-out viewer (no per-user balances)', async () => {
    vi.spyOn(duffel, 'searchCash').mockResolvedValue({ ok: true, data: [] })
    vi.spyOn(awards, 'searchAwards').mockResolvedValue({ ok: true, data: [] })
    const getBalancesSpy = vi
      .spyOn(awardwallet, 'getBalances')
      .mockResolvedValue({ ok: false, reason: 'balances down' })

    // No userBalances argument → signed-out / stateless path.
    const result = await assembleSearch(PARAMS)

    expect(getBalancesSpy).not.toHaveBeenCalled()
    expect(result.degraded).not.toContain('balances')
    expect(result.balances).toEqual([])
  })

  // A signed-in user supplies their own (possibly empty) balances; that path is
  // trusted and never hits the env-global fallback, so it never degrades balances.
  it('does NOT degrade balances when the caller supplies per-user balances', async () => {
    vi.spyOn(duffel, 'searchCash').mockResolvedValue({ ok: true, data: [] })
    vi.spyOn(awards, 'searchAwards').mockResolvedValue({ ok: true, data: [] })
    // getBalances() must NOT even be consulted when balances are supplied.
    const getBalancesSpy = vi
      .spyOn(awardwallet, 'getBalances')
      .mockResolvedValue({ ok: false, reason: 'balances down' })

    const result = await assembleSearch(PARAMS, [
      { program: 'Alaska Mileage Plan', code: 'AS', balance: 40000 },
    ])

    expect(result.degraded).not.toContain('balances')
    expect(getBalancesSpy).not.toHaveBeenCalled()
  })
})
