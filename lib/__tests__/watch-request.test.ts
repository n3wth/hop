import { describe, it, expect } from 'vitest'
import { watchRequestFromParams } from '@/lib/watch-request'
import type { SearchParams } from '@/lib/types'

// "Watch this route" must send createWatchExplicit EXACTLY the trip the
// verdict on screen was computed for — no paraphrasing, no invented defaults.
// These assertions pin the request shape 1:1 against SearchResult.params.

describe('watchRequestFromParams', () => {
  it('copies from/to/depart/adults verbatim', () => {
    const params: SearchParams = { from: 'SFO', to: 'NRT', depart: '2026-08-04', adults: 2 }
    const req = watchRequestFromParams(params)
    expect(req.from).toBe(params.from)
    expect(req.to).toBe(params.to)
    expect(req.depart).toBe(params.depart)
    expect(req.adults).toBe(params.adults)
  })

  it('maps return -> ret 1:1, undefined for one-way', () => {
    const oneWay: SearchParams = { from: 'SFO', to: 'NRT', depart: '2026-08-04', adults: 1 }
    expect(watchRequestFromParams(oneWay).ret).toBeUndefined()

    const roundTrip: SearchParams = {
      from: 'SFO',
      to: 'NRT',
      depart: '2026-08-04',
      return: '2026-08-11',
      adults: 1,
    }
    expect(watchRequestFromParams(roundTrip).ret).toBe(roundTrip.return)
  })

  it('maps cabin -> minCabin 1:1, undefined when unset', () => {
    const noCabin: SearchParams = { from: 'SFO', to: 'NRT', depart: '2026-08-04', adults: 1 }
    expect(watchRequestFromParams(noCabin).minCabin).toBeUndefined()

    const business: SearchParams = {
      from: 'SFO',
      to: 'NRT',
      depart: '2026-08-04',
      adults: 1,
      cabin: 'business',
    }
    expect(watchRequestFromParams(business).minCabin).toBe('business')
  })

  it('never invents a minCpp — server clamps the omission to its own threshold floor', () => {
    const params: SearchParams = { from: 'SFO', to: 'NRT', depart: '2026-08-04', adults: 1 }
    const req = watchRequestFromParams(params)
    expect('minCpp' in req).toBe(false)
  })

  it('produces exactly the fields createWatchExplicit accepts, nothing extra', () => {
    const params: SearchParams = {
      from: 'LAX',
      to: 'HND',
      depart: '2026-09-01',
      return: '2026-09-15',
      adults: 3,
      cabin: 'premium',
    }
    const req = watchRequestFromParams(params)
    expect(Object.keys(req).sort()).toEqual(['adults', 'depart', 'from', 'minCabin', 'ret', 'to'])
    expect(req).toEqual({
      from: 'LAX',
      to: 'HND',
      depart: '2026-09-01',
      ret: '2026-09-15',
      adults: 3,
      minCabin: 'premium',
    })
  })

  it('is 1:1 with SearchResult.params for a representative sweep of trip shapes', () => {
    const cases: SearchParams[] = [
      { from: 'SFO', to: 'LAX', depart: '2026-07-09', adults: 1 },
      { from: 'JFK', to: 'CDG', depart: '2026-12-20', return: '2026-12-28', adults: 4 },
      {
        from: 'ORD',
        to: 'NRT',
        depart: '2027-01-05',
        return: '2027-01-19',
        adults: 2,
        cabin: 'first',
      },
      { from: 'SEA', to: 'SIN', depart: '2026-10-10', adults: 1, cabin: 'economy' },
    ]
    for (const params of cases) {
      const req = watchRequestFromParams(params)
      expect(req.from).toBe(params.from)
      expect(req.to).toBe(params.to)
      expect(req.depart).toBe(params.depart)
      expect(req.adults).toBe(params.adults)
      expect(req.ret).toBe(params.return)
      expect(req.minCabin).toBe(params.cabin)
    }
  })
})
