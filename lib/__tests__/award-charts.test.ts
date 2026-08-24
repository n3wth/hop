import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cpp } from '@/lib/cpp'
import { assembleSearch } from '@/lib/search'
import { searchAwards as searchAwardsStub } from '@/lib/seatsaero'
import { searchAwards } from '@/lib/awards'
import {
  CHART_NOTE,
  TAX_USD,
  greatCircleMiles,
  quoteChart,
} from '@/lib/award-charts'
import { searchCash } from '@/lib/duffel'
import { recordCppObservations } from '@/lib/valuation-telemetry'

vi.mock('@/lib/duffel', () => ({ searchCash: vi.fn() }))
vi.mock('@/lib/valuation-telemetry', () => ({ recordCppObservations: vi.fn() }))

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  delete process.env.MOCK
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.clearAllMocks()
})

const CASH_254 = {
  id: 'c1',
  kind: 'cash' as const,
  airline: 'United',
  route: 'SFO → LAX',
  date: 'Aug 1',
  cashPrice: 254,
  tier: 'muted' as const,
  bookingUrl: '',
}

describe('quoteChart — published bands', () => {
  it('SFO-LAX is Alaska 4,500 saver floor + Aeroplan 6,000', () => {
    const result = quoteChart({ from: 'SFO', to: 'LAX', depart: '2026-09-01', adults: 1 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const alaska = result.data.find((o) => o.airlineCode === 'AS')
    const aeroplan = result.data.find((o) => o.airlineCode === 'AC')
    expect(alaska?.miles).toBe(4500)
    expect(alaska?.taxes).toBe(TAX_USD.usDomestic)
    expect(alaska?.availability).toBe('chart')
    expect(alaska?.note).toBe(CHART_NOTE)
    expect(alaska?.date).toBe('Chart')
    expect(aeroplan?.miles).toBe(6000)
  })

  it('BOS-SFO uses OurAirports coords (not the old 15-hub map)', () => {
    const miles = greatCircleMiles('BOS', 'SFO')
    expect(miles).toBeGreaterThan(2100)
    expect(miles).toBeLessThanOrEqual(3500)
    const result = quoteChart({ from: 'BOS', to: 'SFO', depart: '2026-09-01', adults: 1 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.find((o) => o.airlineCode === 'AS')?.miles).toBe(12500)
    expect(result.data.find((o) => o.airlineCode === 'AC')?.miles).toBe(12500)
  })

  it('SFO-LHR is Aeroplan Atlantic 42,500 starting-at', () => {
    const miles = greatCircleMiles('SFO', 'LHR')
    expect(miles).toBeGreaterThan(4000)
    expect(miles).toBeLessThanOrEqual(6000)
    const result = quoteChart({ from: 'SFO', to: 'LHR', depart: '2026-09-01', adults: 1 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const aeroplan = result.data.find((o) => o.airlineCode === 'AC')
    expect(aeroplan?.miles).toBe(42500)
    expect(aeroplan?.taxes).toBe(TAX_USD.europeAtlantic)
    expect(aeroplan?.availability).toBe('chart')
    expect(result.data.find((o) => o.airlineCode === 'AS')).toBeUndefined()
  })

  it('JFK-CDG is the shorter Atlantic band (32,500)', () => {
    const miles = greatCircleMiles('JFK', 'CDG')
    expect(miles).toBeGreaterThan(0)
    expect(miles).toBeLessThanOrEqual(4000)
    const result = quoteChart({ from: 'JFK', to: 'CDG', depart: '2026-09-01', adults: 1 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.find((o) => o.airlineCode === 'AC')?.miles).toBe(32500)
  })

  it('SFO-EZE has no published SA chart — empty, not invented miles', () => {
    expect(greatCircleMiles('SFO', 'EZE')).toBeGreaterThan(5000)
    const result = quoteChart({ from: 'SFO', to: 'EZE', depart: '2026-09-01', adults: 1 })
    expect(result).toEqual({ ok: true, data: [] })
  })

  it('SFO-NRT is Aeroplan Pacific 45,000 starting-at', () => {
    const miles = greatCircleMiles('SFO', 'NRT')
    expect(miles).toBeGreaterThan(5000)
    expect(miles).toBeLessThanOrEqual(7500)
    const result = quoteChart({ from: 'SFO', to: 'NRT', depart: '2026-09-01', adults: 1 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const aeroplan = result.data.find((o) => o.airlineCode === 'AC')
    expect(aeroplan?.miles).toBe(45000)
    expect(aeroplan?.taxes).toBe(TAX_USD.japanPacific)
    expect(aeroplan?.availability).toBe('chart')
  })

  it('does not relabel a neighboring cabin when the published cell is empty', () => {
    const business = quoteChart({
      from: 'SFO',
      to: 'LAX',
      depart: '2026-09-01',
      adults: 1,
      cabin: 'business',
    })
    expect(business.ok).toBe(true)
    if (!business.ok) return
    expect(business.data.find((o) => o.airlineCode === 'AS')).toBeUndefined()
    const acBiz = business.data.find((o) => o.airlineCode === 'AC')
    expect(acBiz?.miles).toBe(15000)
    expect(acBiz?.cabin).toBe('Business')

    const first = quoteChart({
      from: 'SFO',
      to: 'LAX',
      depart: '2026-09-01',
      adults: 1,
      cabin: 'first',
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const asFirst = first.data.find((o) => o.airlineCode === 'AS')
    expect(asFirst?.miles).toBe(15000)
    expect(asFirst?.cabin).toBe('First')
    expect(first.data.find((o) => o.airlineCode === 'AC')).toBeUndefined()
  })

  it('unknown IATA → empty, not a throw', () => {
    const result = quoteChart({ from: 'SFO', to: 'ZZZ', depart: '2026-09-01', adults: 1 })
    expect(result).toEqual({ ok: true, data: [] })
  })

  it('cpp(cash, chartTaxes, chartMiles) matches lib/cpp.ts', () => {
    const result = quoteChart({ from: 'SFO', to: 'LAX', depart: '2026-09-01', adults: 1 })
    if (!result.ok) throw new Error('expected ok')
    const alaska = result.data.find((o) => o.airlineCode === 'AS')!
    expect(cpp(254, alaska.taxes! * 2, alaska.miles! * 2)).toBe(2.6)
  })
})

describe('facade + seats.aero stub', () => {
  it('lib/awards returns the chart; lib/seatsaero is disabled and does not fetch', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const facade = await searchAwards({ from: 'SFO', to: 'LAX', depart: '2026-09-01', adults: 1 })
    const stub = await searchAwardsStub({ from: 'SFO', to: 'LAX', depart: '2026-09-01', adults: 1 })
    expect(facade.ok).toBe(true)
    expect(stub).toEqual({ ok: false, reason: 'disabled' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('assembleSearch MOCK=0 — in-memory charts', () => {
  it('SFO-LAX returns at least one chart award with cpp from lib/cpp.ts', async () => {
    vi.mocked(searchCash).mockResolvedValue({ ok: true, data: [CASH_254] })
    const result = await assembleSearch({
      from: 'SFO',
      to: 'LAX',
      depart: '2026-09-01',
      return: '2026-09-08',
      adults: 1,
    })
    const chart = result.options.find((o) => o.availability === 'chart')
    expect(chart).toBeTruthy()
    expect(chart?.note).toBe(CHART_NOTE)
    expect(result.degraded).not.toContain('awards')
    expect(chart?.cpp).toBe(cpp(254, chart!.taxes!, chart!.miles!))
    expect(vi.mocked(recordCppObservations)).toHaveBeenCalledWith([])
  })

  it('SFO-LHR computes live cpp from Duffel cash vs chart miles', async () => {
    vi.mocked(searchCash).mockResolvedValue({
      ok: true,
      data: [{ ...CASH_254, cashPrice: 890, route: 'SFO → LHR' }],
    })
    const result = await assembleSearch({
      from: 'SFO',
      to: 'LHR',
      depart: '2026-09-01',
      return: '2026-09-15',
      adults: 1,
    })
    const chart = result.options.find((o) => o.availability === 'chart' && o.airlineCode === 'AC')
    expect(chart).toBeTruthy()
    expect(chart?.miles).toBe(85000)
    expect(chart?.cpp).toBe(cpp(890, chart!.taxes!, chart!.miles!))
    expect(vi.mocked(recordCppObservations)).toHaveBeenCalledWith([])
  })

  it('SFO-NRT returns at least one chart award', async () => {
    vi.mocked(searchCash).mockResolvedValue({
      ok: true,
      data: [{ ...CASH_254, cashPrice: 1200, route: 'SFO → NRT' }],
    })
    const result = await assembleSearch({
      from: 'SFO',
      to: 'NRT',
      depart: '2026-09-01',
      return: '2026-09-15',
      adults: 1,
    })
    expect(result.options.some((o) => o.availability === 'chart' && o.airlineCode === 'AC')).toBe(
      true,
    )
  })

  it('empty chart is {ok:true} and does not degrade awards', async () => {
    vi.mocked(searchCash).mockResolvedValue({ ok: true, data: [CASH_254] })
    const result = await assembleSearch({
      from: 'SFO',
      to: 'ZZZ',
      depart: '2026-09-01',
      adults: 1,
    })
    expect(result.degraded).not.toContain('awards')
    expect(result.options.filter((o) => o.kind !== 'cash')).toEqual([])
  })
})
