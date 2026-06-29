import { describe, it, expect } from 'vitest'
import {
  getTravelHistory,
  derivePatterns,
  travelHistorySummary,
  validateTrips,
  EMPTY_TRAVEL_HISTORY,
  type PastTrip,
} from '@/lib/travel-history'

// The Gmail seam is GATED OFF by default (env.isGmailHistoryEnabled requires a
// flag + Google creds). With it off, getTravelHistory must report not-connected
// with an empty history before touching Supabase. derivePatterns + validateTrips
// are pure and tested directly.

describe('getTravelHistory() — gated off / not connected', () => {
  it('returns the not-connected empty history when the seam is disabled', async () => {
    const h = await getTravelHistory('auth0|user')
    expect(h.connected).toBe(false)
    expect(h.trips).toEqual([])
    expect(h.patterns.usualMonths).toEqual([])
    expect(h).toEqual(EMPTY_TRAVEL_HISTORY)
  })
})

describe('validateTrips() — clamps stored jsonb', () => {
  it('keeps valid trips and drops malformed ones', () => {
    const raw = [
      { destinationCity: 'Tokyo', destinationCode: 'NRT', month: '2024-02', cabin: 'business', bookedWithPoints: true },
      { destinationCity: 'Bad', month: '2024-13' }, // bad month → dropped
      { month: '2024-02' }, // no city → dropped
      { destinationCity: 'NoMonth' }, // no month → dropped
      { destinationCity: 'Rome', month: '2024-07', cabin: 'spaceship' }, // bad cabin → kept, cabin dropped
      'garbage',
      null,
    ]
    const out = validateTrips(raw)
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({
      destinationCity: 'Tokyo',
      destinationCode: 'NRT',
      month: '2024-02',
      cabin: 'business',
      bookedWithPoints: true,
    })
    expect(out[1]).toEqual({ destinationCity: 'Rome', month: '2024-07' })
  })

  it('returns [] for non-array input', () => {
    expect(validateTrips(undefined)).toEqual([])
    expect(validateTrips({})).toEqual([])
    expect(validateTrips(null)).toEqual([])
  })
})

describe('derivePatterns() — pure, ready for real trips', () => {
  it('returns empty patterns for no trips', () => {
    expect(derivePatterns([])).toEqual({
      usualMonths: [],
      favoriteRegions: [],
      typicalCabin: undefined,
      tripsPerYear: undefined,
    })
  })

  it('ranks usual months and picks the typical cabin', () => {
    const trips: PastTrip[] = [
      { destinationCity: 'Tokyo', month: '2023-02', cabin: 'business' },
      { destinationCity: 'Bali', month: '2024-02', cabin: 'business' },
      { destinationCity: 'Rome', month: '2024-07', cabin: 'economy' },
    ]
    const p = derivePatterns(trips)
    expect(p.usualMonths[0]).toBe(2) // Feb most common
    expect(p.usualMonths).toContain(7)
    expect(p.typicalCabin).toBe('business')
  })

  it('computes trips/year across distinct calendar years', () => {
    const trips: PastTrip[] = [
      { destinationCity: 'A', month: '2023-01' },
      { destinationCity: 'B', month: '2023-06' },
      { destinationCity: 'C', month: '2024-03' },
      { destinationCity: 'D', month: '2024-09' },
    ]
    // 4 trips / 2 years = 2
    expect(derivePatterns(trips).tripsPerYear).toBe(2)
  })
})

describe('travelHistorySummary()', () => {
  it('is empty for the not-connected stub', () => {
    expect(travelHistorySummary(EMPTY_TRAVEL_HISTORY)).toBe('')
    expect(travelHistorySummary(undefined)).toBe('')
  })

  it('summarizes a connected history', () => {
    const s = travelHistorySummary({
      connected: true,
      trips: [{ destinationCity: 'Tokyo', month: '2024-02' }],
      patterns: { usualMonths: [2], favoriteRegions: ['Asia'], typicalCabin: 'business', tripsPerYear: 3 },
      note: '',
    })
    expect(s).toContain('Feb')
    expect(s).toContain('Asia')
    expect(s).toContain('business')
    expect(s).toContain('3')
  })
})
