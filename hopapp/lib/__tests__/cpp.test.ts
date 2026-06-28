import { describe, it, expect } from 'vitest'
import { cpp, tier, rankOptions } from '../cpp'
import type { FlightOption } from '@/lib/types'

describe('cpp()', () => {
  it('calculates correctly: cpp(254, 11.2, 4500) ≈ 5.4', () => {
    expect(cpp(254, 11.2, 4500)).toBe(5.4)
  })

  it('returns undefined when miles = 0', () => {
    expect(cpp(254, 11.2, 0)).toBeUndefined()
  })

  it('returns undefined when cashPrice = 0', () => {
    expect(cpp(0, 0, 4500)).toBeUndefined()
  })

  it('returns undefined when cashPrice is negative', () => {
    expect(cpp(-100, 0, 4500)).toBeUndefined()
  })

  it('returns undefined when miles is negative', () => {
    expect(cpp(254, 11.2, -100)).toBeUndefined()
  })
})

describe('tier()', () => {
  it('3.0 -> green', () => expect(tier(3.0)).toBe('green'))
  it('5.4 -> green', () => expect(tier(5.4)).toBe('green'))
  it('2.9 -> amber', () => expect(tier(2.9)).toBe('amber'))
  it('1.5 -> amber', () => expect(tier(1.5)).toBe('amber'))
  it('1.49 -> muted', () => expect(tier(1.49)).toBe('muted'))
  it('0 -> muted', () => expect(tier(0)).toBe('muted'))
  it('undefined -> muted', () => expect(tier(undefined)).toBe('muted'))
})

describe('rankOptions()', () => {
  const makeOption = (id: string, cppVal?: number): FlightOption => ({
    id,
    kind: 'award',
    airline: 'Test Airline',
    route: 'SFO → LAX',
    date: 'Jul 9',
    cpp: cppVal,
    tier: cppVal !== undefined ? tier(cppVal) : 'muted',
    bookingUrl: 'https://example.com',
  })

  it('sorts by cpp descending', () => {
    const options = [makeOption('a', 1.5), makeOption('b', 5.4), makeOption('c', 3.0)]
    const ranked = rankOptions(options)
    expect(ranked.map(o => o.id)).toEqual(['b', 'c', 'a'])
  })

  it('places undefined cpp last', () => {
    const options = [makeOption('a', undefined), makeOption('b', 2.0), makeOption('c', undefined)]
    const ranked = rankOptions(options)
    expect(ranked[0].id).toBe('b')
    expect(ranked[1].cpp).toBeUndefined()
    expect(ranked[2].cpp).toBeUndefined()
  })

  it('does not mutate the input array', () => {
    const options = [makeOption('a', 1.0), makeOption('b', 5.0)]
    const original = [...options]
    rankOptions(options)
    expect(options[0].id).toBe(original[0].id)
    expect(options[1].id).toBe(original[1].id)
  })
})
