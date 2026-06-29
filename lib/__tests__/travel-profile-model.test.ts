import { describe, it, expect } from 'vitest'
import {
  validateProfile,
  mergeProfile,
  isEmptyProfile,
  profileSummary,
  type TravelProfile,
} from '@/lib/travel-profile-model'

// Pure tests — the profile model never touches the network or the DB. These
// prove the validator clamps everything (so the LLM can never inject garbage)
// and that merge unions lists / overwrites scalars deterministically.

describe('validateProfile() — clamps + rejects unknown fields', () => {
  it('returns {} for non-objects', () => {
    expect(validateProfile(null)).toEqual({})
    expect(validateProfile('nope')).toEqual({})
    expect(validateProfile(42)).toEqual({})
  })

  it('drops unknown fields entirely', () => {
    const out = validateProfile({ vacationDays: 10, hacker: 'rm -rf', __proto__: { x: 1 } })
    expect(out).toEqual({ vacationDays: 10 })
    expect('hacker' in out).toBe(false)
  })

  it('clamps vacationDays to 0..365 and truncates', () => {
    expect(validateProfile({ vacationDays: -5 }).vacationDays).toBe(0)
    expect(validateProfile({ vacationDays: 9999 }).vacationDays).toBe(365)
    expect(validateProfile({ vacationDays: 12.9 }).vacationDays).toBe(12)
  })

  it('only accepts valid travelParty / cabin enums', () => {
    expect(validateProfile({ travelParty: 'family' }).travelParty).toBe('family')
    expect(validateProfile({ travelParty: 'aliens' }).travelParty).toBeUndefined()
    expect(validateProfile({ cabin: 'business' }).cabin).toBe('business')
    expect(validateProfile({ cabin: 'spaceship' }).cabin).toBeUndefined()
  })

  it('cleans, trims, dedupes, and caps string lists', () => {
    const out = validateProfile({
      dietary: ['  vegan ', 'vegan', 'VEGAN', '', 123, 'gluten-free'],
    })
    expect(out.dietary).toEqual(['vegan', 'gluten-free'])
  })

  it('caps list length at 12', () => {
    const many = Array.from({ length: 30 }, (_, i) => `place-${i}`)
    expect(validateProfile({ lovedDestinations: many }).lovedDestinations).toHaveLength(12)
  })
})

describe('mergeProfile() — scalars overwrite, lists union', () => {
  it('overwrites scalars and unions lists, re-validated', () => {
    const base: TravelProfile = { vacationDays: 10, dietary: ['vegan'] }
    const patch: TravelProfile = { vacationDays: 20, dietary: ['gluten-free'] }
    const merged = mergeProfile(base, patch)
    expect(merged.vacationDays).toBe(20)
    expect(merged.dietary?.sort()).toEqual(['gluten-free', 'vegan'])
  })

  it('dedupes across base + patch on union', () => {
    const merged = mergeProfile({ dietary: ['vegan'] }, { dietary: ['vegan', 'kosher'] })
    expect(merged.dietary?.sort()).toEqual(['kosher', 'vegan'])
  })

  it('does not mutate inputs', () => {
    const base: TravelProfile = { dietary: ['vegan'] }
    mergeProfile(base, { dietary: ['kosher'] })
    expect(base.dietary).toEqual(['vegan'])
  })
})

describe('isEmptyProfile() / profileSummary()', () => {
  it('treats {} and undefined as empty', () => {
    expect(isEmptyProfile(undefined)).toBe(true)
    expect(isEmptyProfile({})).toBe(true)
    expect(isEmptyProfile({ vacationDays: 1 })).toBe(false)
  })

  it('summary is empty string when profile is empty', () => {
    expect(profileSummary({})).toBe('')
  })

  it('summary surfaces avoided destinations with a never-suggest note', () => {
    const s = profileSummary({ avoidedDestinations: ['Paris'], cabin: 'first' })
    expect(s).toContain('Paris')
    expect(s.toLowerCase()).toContain('never suggest')
    expect(s).toContain('first')
  })
})
