import { describe, expect, it } from 'vitest'
import { AIRPORTS, airportByCode, cityForCode, searchAirports } from './airports'

describe('airports dataset', () => {
  it('covers small regional airports, not just major hubs', () => {
    // Glacier Park Intl (Kalispell, MT) — the real-world gap this dataset fixes.
    expect(airportByCode('FCA')?.city).toBe('Kalispell')
  })

  it('is comprehensive (thousands of IATA codes, not a curated shortlist)', () => {
    expect(AIRPORTS.length).toBeGreaterThan(5000)
  })

  it('has no duplicate IATA codes', () => {
    const codes = new Set(AIRPORTS.map((a) => a.code))
    expect(codes.size).toBe(AIRPORTS.length)
  })
})

describe('airportByCode', () => {
  it('resolves a known code case-insensitively', () => {
    expect(airportByCode('sfo')?.city).toBe('San Francisco')
    expect(airportByCode('SFO')?.city).toBe('San Francisco')
  })

  it('returns undefined for an unknown code', () => {
    expect(airportByCode('ZZZ')).toBeUndefined()
  })
})

describe('cityForCode', () => {
  it('falls back to the raw code for an unmapped airport', () => {
    expect(cityForCode('ZZZ')).toBe('ZZZ')
  })
})

describe('searchAirports ranking', () => {
  it('ranks an exact code match first regardless of airport size', () => {
    const results = searchAirports('fca', 5)
    expect(results[0]?.code).toBe('FCA')
  })

  it('breaks ties in favor of the larger airport', () => {
    // Five real "San Jose" airports worldwide (CR/PH/US) all city-prefix-match
    // at the same score tier — the large one (SJC) should sort first.
    const results = searchAirports('san jose', 5)
    expect(results[0]?.code).toBe('SJC')
  })

  it('returns an empty array for no matches', () => {
    expect(searchAirports('zzzznotreal')).toEqual([])
  })

  it('respects the limit', () => {
    expect(searchAirports('a', 3)).toHaveLength(3)
  })

  it('returns size-ranked results for an empty query', () => {
    const results = searchAirports('', 5)
    expect(results).toHaveLength(5)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].size).toBeGreaterThanOrEqual(results[i].size)
    }
  })

  it('surfaces the busiest hubs for an empty query, not alphabetical large airports', () => {
    const codes = searchAirports('', 6).map((a) => a.code)
    // ATL is the world's busiest airport — it leads; the rest are recognizable
    // top-10 hubs, not the alphabetically-first "large" airports (AAL, ABJ, …).
    expect(codes[0]).toBe('ATL')
    expect(codes).toContain('DFW')
  })

  it('breaks same-tier ties by traffic rank, not alphabetically', () => {
    // Both Chicago airports city-prefix-match at the same score tier; ORD must
    // beat MDW even though MDW sorts first alphabetically.
    const results = searchAirports('chicago', 5)
    expect(results[0]?.code).toBe('ORD')
  })

  it('ranks LHR first among London airports', () => {
    const results = searchAirports('london', 6)
    expect(results[0]?.code).toBe('LHR')
  })
})
