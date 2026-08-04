import { describe, it, expect } from 'vitest'
import { validateCandidate, alreadyKnown, INFERRABLE_KINDS } from '@/lib/inferred-facts'
import type { TravelProfile } from '@/lib/travel-profile-model'

describe('validateCandidate', () => {
  it('accepts a valid high-confidence cabin/party/place inference', () => {
    expect(validateCandidate({ kind: 'cabin', value: 'Business', confidence: 0.8 })).toEqual({
      kind: 'cabin',
      value: 'business',
      confidence: 0.8,
    })
    expect(validateCandidate({ kind: 'travelParty', value: 'Couple', confidence: 0.7 })).toEqual({
      kind: 'travelParty',
      value: 'couple',
      confidence: 0.7,
    })
    expect(validateCandidate({ kind: 'lovedDestinations', value: '  Lisbon  ', confidence: 0.9 })).toEqual({
      kind: 'lovedDestinations',
      value: 'Lisbon',
      confidence: 0.9,
    })
  })

  it('rejects a kind hop must never infer (sensitive / not allowlisted)', () => {
    expect(validateCandidate({ kind: 'dietary', value: 'vegan', confidence: 0.9 })).toBeNull()
    expect(validateCandidate({ kind: 'accessibility', value: 'step-free', confidence: 0.9 })).toBeNull()
    expect(validateCandidate({ kind: 'vacationDays', value: '25', confidence: 0.9 })).toBeNull()
    expect(validateCandidate({ kind: 'airlineStatuses', value: 'United Gold', confidence: 0.9 })).toBeNull()
    // sensitive kinds are not in the allowlist
    expect(INFERRABLE_KINDS).not.toContain('dietary')
    expect(INFERRABLE_KINDS).not.toContain('accessibility')
  })

  it('rejects low or malformed confidence', () => {
    expect(validateCandidate({ kind: 'cabin', value: 'business', confidence: 0.4 })).toBeNull()
    expect(validateCandidate({ kind: 'cabin', value: 'business', confidence: 1.5 })).toBeNull()
    expect(validateCandidate({ kind: 'cabin', value: 'business', confidence: 'high' })).toBeNull()
  })

  it('rejects an invalid enum value or empty place', () => {
    expect(validateCandidate({ kind: 'cabin', value: 'spaceship', confidence: 0.9 })).toBeNull()
    expect(validateCandidate({ kind: 'travelParty', value: 'squad', confidence: 0.9 })).toBeNull()
    expect(validateCandidate({ kind: 'lovedDestinations', value: '   ', confidence: 0.9 })).toBeNull()
  })
})

describe('alreadyKnown', () => {
  const profile: TravelProfile = {
    cabin: 'business',
    lovedDestinations: ['Lisbon'],
  }
  const existing = [{ kind: 'avoidedDestinations', value: 'Cancun' }]
  const known = alreadyKnown(profile, existing)

  it('filters a scalar already set in the stated profile', () => {
    expect(known({ kind: 'cabin', value: 'first' })).toBe(true) // cabin already stated
    expect(known({ kind: 'travelParty', value: 'solo' })).toBe(false) // not set → new
  })

  it('filters a list value already stated (case-insensitive)', () => {
    expect(known({ kind: 'lovedDestinations', value: 'lisbon' })).toBe(true)
    expect(known({ kind: 'lovedDestinations', value: 'Tokyo' })).toBe(false)
  })

  it('filters a value already inferred (any status), case-insensitive', () => {
    expect(known({ kind: 'avoidedDestinations', value: 'cancun' })).toBe(true)
    expect(known({ kind: 'avoidedDestinations', value: 'Miami' })).toBe(false)
  })
})
