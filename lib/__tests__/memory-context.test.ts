import { describe, it, expect } from 'vitest'
import { withoutAvoided, matchesPlace } from '@/lib/memory-context'
import type { Destination } from '@/lib/destinations'

// Minimal Destination fixtures in a cpp-ranked order (as topValue would hand them).
function dest(partial: Partial<Destination> & Pick<Destination, 'code' | 'city' | 'country' | 'countryCode'>): Destination {
  return {
    region: 'Test',
    vibe: '',
    tags: [],
    typicalAwardMiles: 30000,
    typicalCashUSD: 500,
    typicalTaxesUSD: 60,
    bestProgram: 'Test',
    imageHint: '',
    ...partial,
  }
}

const NRT = dest({ code: 'NRT', city: 'Tokyo', country: 'Japan', countryCode: 'jp' })
const LIS = dest({ code: 'LIS', city: 'Lisbon', country: 'Portugal', countryCode: 'pt' })
const CUN = dest({ code: 'CUN', city: 'Cancun', country: 'Mexico', countryCode: 'mx' })
const GIG = dest({ code: 'GIG', city: 'Rio de Janeiro', country: 'Brazil', countryCode: 'br' })
const RANKED = [NRT, LIS, CUN, GIG]

describe('matchesPlace', () => {
  it('matches city / country / countryCode case-insensitively', () => {
    expect(matchesPlace(NRT, 'tokyo')).toBe(true)
    expect(matchesPlace(NRT, 'Japan')).toBe(true)
    expect(matchesPlace(NRT, 'JP')).toBe(true)
  })
  it('is EXACT — a stray token cannot sweep a region', () => {
    const indy = dest({ code: 'IND', city: 'Indianapolis', country: 'United States', countryCode: 'us' })
    expect(matchesPlace(indy, 'India')).toBe(false)
    expect(matchesPlace(NRT, 'kyoto')).toBe(false)
    expect(matchesPlace(NRT, '')).toBe(false)
  })
})

describe('withoutAvoided', () => {
  it('is a NO-OP (same reference) when nothing is avoided — today\'s exact feed', () => {
    expect(withoutAvoided(RANKED, [])).toBe(RANKED)
  })

  it('drops avoided destinations, matched by city/country/code', () => {
    expect(withoutAvoided(RANKED, ['Cancun']).map((d) => d.code)).toEqual(['NRT', 'LIS', 'GIG'])
    expect(withoutAvoided(RANKED, ['mexico']).map((d) => d.code)).toEqual(['NRT', 'LIS', 'GIG'])
    expect(withoutAvoided(RANKED, ['jp']).map((d) => d.code)).toEqual(['LIS', 'CUN', 'GIG'])
  })

  it('PRESERVES the engine value order for survivors (never re-ranks)', () => {
    // avoiding a middle entry must not reorder the rest — value order intact.
    expect(withoutAvoided(RANKED, ['Lisbon']).map((d) => d.code)).toEqual(['NRT', 'CUN', 'GIG'])
  })

  it('drops multiple avoided places', () => {
    expect(withoutAvoided(RANKED, ['Tokyo', 'Brazil']).map((d) => d.code)).toEqual(['LIS', 'CUN'])
  })

  it('does not mutate the input', () => {
    const snapshot = RANKED.map((d) => d.code)
    withoutAvoided(RANKED, ['Cancun'])
    expect(RANKED.map((d) => d.code)).toEqual(snapshot)
  })

  it('ignores blank / whitespace avoided entries', () => {
    expect(withoutAvoided(RANKED, ['   ', ''])).toBe(RANKED)
  })
})
