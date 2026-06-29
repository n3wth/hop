import { describe, it, expect } from 'vitest'
import {
  getTravelHistory,
  derivePatterns,
  travelHistorySummary,
  EMPTY_TRAVEL_HISTORY,
  type PastTrip,
} from '@/lib/travel-history'

// The seam is a STUB today: getTravelHistory must report not-connected with an
// empty history. derivePatterns is the pure logic that will run over REAL trips
// once Gmail is wired — tested now so it's ready.

describe('getTravelHistory() — placeholder stub', () => {
  it('returns the not-connected empty history (no Gmail call yet)', async () => {
    const h = await getTravelHistory('auth0|user')
    expect(h.connected).toBe(false)
    expect(h.trips).toEqual([])
    expect(h.patterns.usualMonths).toEqual([])
    expect(h).toEqual(EMPTY_TRAVEL_HISTORY)
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
