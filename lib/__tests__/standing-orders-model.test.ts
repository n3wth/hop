import { describe, it, expect } from 'vitest'
import {
  clampCpp,
  clampSeats,
  clampPrograms,
  validateParams,
  validateDraft,
  offerFingerprint,
  programEligible,
  evaluateOrder,
  parseStandingOrderFallback,
  MIN_CPP_FLOOR,
  MAX_CPP_CEIL,
  MAX_SEATS,
} from '@/lib/standing-orders-model'
import type { FlightOption, SearchResult } from '@/lib/types'

// A minimal redemption option for the engine-output fixtures.
function award(over: Partial<FlightOption> = {}): FlightOption {
  return {
    id: 'a1',
    kind: 'award',
    airline: 'Alaska',
    program: 'Alaska Mileage Plan',
    route: 'SFO → NRT',
    date: 'Mar 25',
    miles: 60000,
    taxes: 50,
    cpp: 3.2,
    tier: 'green',
    bookingUrl: 'https://x',
    ...over,
  }
}

function result(over: Partial<SearchResult> = {}): SearchResult {
  return {
    params: { from: 'SFO', to: 'NRT', depart: '2026-03-25', adults: 1 },
    options: [],
    pick: award(),
    verdict: 'use-points',
    summary: {},
    balances: [],
    degraded: [],
    ...over,
  }
}

describe('clampCpp', () => {
  it('floors at hop verdict threshold', () => {
    expect(clampCpp(1.2)).toBe(MIN_CPP_FLOOR)
    expect(clampCpp(0)).toBe(MIN_CPP_FLOOR)
  })
  it('caps at the ceiling', () => {
    expect(clampCpp(99)).toBe(MAX_CPP_CEIL)
  })
  it('keeps a valid value, 1 decimal', () => {
    expect(clampCpp(3.25)).toBe(3.3)
    expect(clampCpp('2.7')).toBe(2.7)
  })
  it('garbage → floor', () => {
    expect(clampCpp('abc')).toBe(MIN_CPP_FLOOR)
    expect(clampCpp(undefined)).toBe(MIN_CPP_FLOOR)
  })
})

describe('clampSeats', () => {
  it('bounds to [1, MAX_SEATS]', () => {
    expect(clampSeats(0)).toBe(1)
    expect(clampSeats(100)).toBe(MAX_SEATS)
    expect(clampSeats(2)).toBe(2)
  })
  it('garbage → 1', () => {
    expect(clampSeats('x')).toBe(1)
  })
})

describe('clampPrograms', () => {
  it('trims, dedupes case-insensitively, caps length', () => {
    expect(clampPrograms(['Alaska', 'alaska ', '', 'Aeroplan'])).toEqual(['Alaska', 'Aeroplan'])
  })
  it('non-array → []', () => {
    expect(clampPrograms('Alaska')).toEqual([])
    expect(clampPrograms(null)).toEqual([])
  })
})

describe('validateParams', () => {
  it('accepts a valid route + date', () => {
    expect(validateParams({ from: 'sfo', to: 'nrt', depart: '2026-03-25', adults: 2 })).toEqual({
      from: 'SFO',
      to: 'NRT',
      depart: '2026-03-25',
      adults: 2,
    })
  })
  it('rejects same origin/destination', () => {
    expect(validateParams({ from: 'SFO', to: 'SFO', depart: '2026-03-25', adults: 1 })).toBeNull()
  })
  it('rejects non-IATA and missing date', () => {
    expect(validateParams({ from: 'SFOO', to: 'NRT', depart: '2026-03-25', adults: 1 })).toBeNull()
    expect(validateParams({ from: 'SFO', to: 'NRT', adults: 1 })).toBeNull()
  })
  it('carries a valid return', () => {
    const p = validateParams({ from: 'SFO', to: 'NRT', depart: '2026-03-25', return: '2026-04-05', adults: 1 })
    expect(p?.return).toBe('2026-04-05')
  })
})

describe('validateDraft', () => {
  it('clamps cpp up to the floor and defaults seats from adults', () => {
    const d = validateDraft({
      params: { from: 'SFO', to: 'NRT', depart: '2026-03-25', adults: 2 },
      minCpp: 1.0,
    })
    expect(d?.minCpp).toBe(MIN_CPP_FLOOR)
    expect(d?.seats).toBe(2)
  })
  it('rejects a draft with no usable route', () => {
    expect(validateDraft({ params: { from: 'X', to: 'Y' }, minCpp: 3 })).toBeNull()
    expect(validateDraft(null)).toBeNull()
  })
  it('keeps a valid cabin, drops an invalid one', () => {
    expect(
      validateDraft({ params: { from: 'SFO', to: 'NRT', depart: '2026-03-25', adults: 1 }, minCabin: 'business' })
        ?.minCabin,
    ).toBe('business')
    expect(
      validateDraft({ params: { from: 'SFO', to: 'NRT', depart: '2026-03-25', adults: 1 }, minCabin: 'royal' })
        ?.minCabin,
    ).toBeUndefined()
  })
})

describe('offerFingerprint', () => {
  it('is stable for the same deal and empty for cash', () => {
    const a = offerFingerprint(award())
    const b = offerFingerprint(award())
    expect(a).toBe(b)
    expect(a).not.toBe('')
    expect(offerFingerprint(award({ kind: 'cash', program: undefined }))).toBe('')
    expect(offerFingerprint(undefined)).toBe('')
  })
  it('changes when miles/taxes change', () => {
    expect(offerFingerprint(award({ miles: 60000 }))).not.toBe(offerFingerprint(award({ miles: 70000 })))
  })
})

describe('programEligible', () => {
  it('empty filter matches anything', () => {
    expect(programEligible(award(), [])).toBe(true)
  })
  it('loose substring match either direction', () => {
    expect(programEligible(award(), ['Alaska'])).toBe(true)
    expect(programEligible(award(), ['Delta'])).toBe(false)
  })
})

describe('evaluateOrder — the crossing rule', () => {
  const base = { minCpp: 2.5, seats: 1, eligiblePrograms: [] as string[], lastNotifiedOffer: null }

  it('crosses when a redemption clears cpp on a new offer', () => {
    const e = evaluateOrder(base, result())
    expect(e.crossed).toBe(true)
    expect(e.pick?.program).toBe('Alaska Mileage Plan')
    expect(e.fingerprint).not.toBe('')
  })

  it('does not cross below the cpp bar', () => {
    const e = evaluateOrder({ ...base, minCpp: 4.0 }, result())
    expect(e.crossed).toBe(false)
    expect(e.reason).toBe('below-cpp')
  })

  it('does not cross when the program is ineligible', () => {
    const e = evaluateOrder({ ...base, eligiblePrograms: ['Delta'] }, result())
    expect(e.crossed).toBe(false)
    expect(e.reason).toBe('program-ineligible')
  })

  it('does not re-alert the same offer (dedupe)', () => {
    const fp = offerFingerprint(award())
    const e = evaluateOrder({ ...base, lastNotifiedOffer: fp }, result())
    expect(e.crossed).toBe(false)
    expect(e.reason).toBe('already-notified')
  })

  it('does not cross when the pick is cash / no redemption', () => {
    const e = evaluateOrder(base, result({ pick: award({ kind: 'cash', program: undefined }) }))
    expect(e.crossed).toBe(false)
    expect(e.reason).toBe('no-redemption')
  })

  it('fires again on a DIFFERENT offer after a prior alert', () => {
    const oldFp = offerFingerprint(award({ miles: 50000 }))
    const e = evaluateOrder({ ...base, lastNotifiedOffer: oldFp }, result({ pick: award({ miles: 60000 }) }))
    expect(e.crossed).toBe(true)
  })
})

describe('parseStandingOrderFallback', () => {
  it('parses a full IATA route with an ISO date and cpp', () => {
    const d = parseStandingOrderFallback('watch SFO to NRT business 2026-03-25 above 2.5 cpp')
    expect(d?.params.from).toBe('SFO')
    expect(d?.params.to).toBe('NRT')
    expect(d?.params.depart).toBe('2026-03-25')
    expect(d?.minCpp).toBe(2.5)
    expect(d?.minCabin).toBe('business')
  })
  it('uses home airport when only a destination is given', () => {
    const d = parseStandingOrderFallback('watch flights to NRT 2026-03-25', 'SFO')
    expect(d?.params.from).toBe('SFO')
    expect(d?.params.to).toBe('NRT')
  })
  it('returns null without an ISO date (defers to AI / form)', () => {
    expect(parseStandingOrderFallback('watch SFO to NRT late March')).toBeNull()
  })
  it('returns null with no route', () => {
    expect(parseStandingOrderFallback('ping me when cheap 2026-03-25')).toBeNull()
    expect(parseStandingOrderFallback('')).toBeNull()
  })
  it('floors a sub-threshold cpp', () => {
    const d = parseStandingOrderFallback('SFO to NRT 2026-03-25 above 1 cpp')
    expect(d?.minCpp).toBe(MIN_CPP_FLOOR)
  })
})
