import { describe, it, expect } from 'vitest'
import {
  priceTrip,
  parseWeather,
  monthToIndex,
  type OpenMeteoClimate,
  type PriceTripResult,
} from '@/lib/concierge-tools'
import { destinationByCode, computeCpp } from '@/lib/destinations'

// These tests exercise the PURE tool helpers only — no network, no AI SDK.
// They prove price_trip's economics are deterministic (read from hop's engine)
// and that the weather parser is defensive.

describe('priceTrip() — deterministic economics from hop\'s engine', () => {
  it('returns an error shape for an unknown IATA code', () => {
    const out = priceTrip('ZZZ', [])
    expect('error' in out).toBe(true)
    if ('error' in out) expect(out.code).toBe('ZZZ')
  })

  it('quotes miles/cash/cpp straight from the dataset + computeCpp (never invented)', () => {
    const out = priceTrip('NRT', []) as PriceTripResult
    const d = destinationByCode('NRT')!
    expect(out.milesNeeded).toBe(d.typicalAwardMiles)
    expect(out.cashUsd).toBe(d.typicalCashUSD)
    expect(out.cpp).toBe(computeCpp(d))
    expect(out.bestProgram).toBe(d.bestProgram)
    expect(out.city).toBe(d.city)
  })

  it('is fully deterministic: same inputs → identical output every call', () => {
    const a = priceTrip('NRT', [{ program: 'Amex MR', balance: 60000 }])
    const b = priceTrip('NRT', [{ program: 'Amex MR', balance: 60000 }])
    expect(a).toEqual(b)
  })

  it('counts a DIRECT holding of the booking program toward affordability', () => {
    const d = destinationByCode('NRT')!
    // NRT books via "ANA via Amex MR"; a direct ANA balance over the award counts.
    const out = priceTrip('NRT', [{ program: 'ANA Mileage Club', balance: d.typicalAwardMiles + 5000 }]) as PriceTripResult
    expect(out.youHave).toBeGreaterThanOrEqual(d.typicalAwardMiles)
    expect(out.affordable).toBe(true)
    expect(out.youHaveVia?.kind).toBe('direct')
  })

  it('counts a TRANSFERABLE bank currency toward the booking program (engine applies the ratio)', () => {
    // Amex MR transfers to ANA (1:1) — so a big MR balance makes NRT affordable
    // WITHOUT the user holding ANA directly. The engine, not the LLM, decides this.
    const out = priceTrip('NRT', [{ program: 'Amex MR', balance: 80000 }]) as PriceTripResult
    expect(out.youHave).toBeGreaterThan(0)
    expect(out.youHaveVia?.kind).toBe('transfer')
    expect(out.affordable).toBe(true)
  })

  it('verdict is "save" when the user cannot afford it with points held now', () => {
    const out = priceTrip('NRT', [{ program: 'Amex MR', balance: 1000 }]) as PriceTripResult
    expect(out.affordable).toBe(false)
    expect(out.verdict).toBe('save')
  })

  it('leaves affordability undefined when no balances are shared', () => {
    const out = priceTrip('NRT', []) as PriceTripResult
    expect(out.youHave).toBeUndefined()
    expect(out.affordable).toBeUndefined()
    // With no balances, verdict falls back to the CPP-based call (points/cash).
    expect(['points', 'cash']).toContain(out.verdict)
  })

  it('ignores malformed balance entries without throwing', () => {
    // @ts-expect-error — intentionally malformed input
    const out = priceTrip('NRT', [{ program: 123, balance: 'lots' }, null, undefined]) as PriceTripResult
    expect(out.code).toBe('NRT')
    expect(out.affordable).toBeUndefined()
  })
})

describe('parseWeather() — defensive open-meteo parsing', () => {
  const sample: OpenMeteoClimate = {
    daily: {
      time: ['2024-07-01', '2024-07-02', '2024-07-03'],
      temperature_2m_max: [30, 32, 34],
      temperature_2m_min: [22, 24, 20],
      precipitation_sum: [0, 0.5, 0.1],
    },
  }

  it('averages highs/lows/precip and names the month', () => {
    const out = parseWeather('Tokyo, Japan', 6, sample)
    expect(out.month).toBe('July')
    expect(out.highC).toBe(32) // (30+32+34)/3
    expect(out.lowC).toBe(22) // (22+24+20)/3
    expect(out.note).toContain('22–32°C')
    expect(out.note).toContain('Tokyo')
  })

  it('flags dry months via the precipitation note', () => {
    const out = parseWeather('Lisbon', 6, sample)
    expect(out.note.toLowerCase()).toContain('dry')
  })

  it('tolerates nulls and missing fields without NaN', () => {
    const out = parseWeather('Nowhere', 0, { daily: { temperature_2m_max: [null, null] } })
    expect(out.highC).toBeUndefined()
    expect(out.lowC).toBeUndefined()
    expect(out.note).toContain('No reliable climate data')
  })

  it('handles a completely empty payload gracefully', () => {
    const out = parseWeather('Void', 11, {})
    expect(out.month).toBe('December')
    expect(out.highC).toBeUndefined()
    expect(out.note).toContain('No reliable climate data')
  })
})

describe('monthToIndex()', () => {
  it('maps month names (any case / prefix) to a 0-based index', () => {
    expect(monthToIndex('January')).toBe(0)
    expect(monthToIndex('jul')).toBe(6)
    expect(monthToIndex('DECEMBER')).toBe(11)
  })

  it('maps 1-12 numbers to 0-based indices', () => {
    expect(monthToIndex(1)).toBe(0)
    expect(monthToIndex(12)).toBe(11)
    expect(monthToIndex('7')).toBe(6)
  })

  it('defaults to the current month for missing/garbage input', () => {
    expect(monthToIndex(undefined)).toBe(new Date().getUTCMonth())
    expect(monthToIndex('not-a-month')).toBe(new Date().getUTCMonth())
  })
})
