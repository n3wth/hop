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

describe('airlineStatuses — validation / merge / summary', () => {
  it('keeps well-formed {program, tier} pairs and trims them', () => {
    const out = validateProfile({
      airlineStatuses: [
        { program: '  United MileagePlus ', tier: ' Gold ' },
        { program: 'Delta SkyMiles', tier: 'Silver' },
      ],
    })
    expect(out.airlineStatuses).toEqual([
      { program: 'United MileagePlus', tier: 'Gold' },
      { program: 'Delta SkyMiles', tier: 'Silver' },
    ])
  })

  it('drops entries missing a program or tier, and non-objects', () => {
    const out = validateProfile({
      airlineStatuses: [
        { program: 'United', tier: '' },
        { program: '', tier: 'Gold' },
        { program: 'Delta' },
        'nope',
        null,
        { program: 'American AAdvantage', tier: 'Platinum' },
      ],
    })
    expect(out.airlineStatuses).toEqual([{ program: 'American AAdvantage', tier: 'Platinum' }])
  })

  it('dedupes by program (case-insensitive), last write wins', () => {
    const out = validateProfile({
      airlineStatuses: [
        { program: 'United', tier: 'Silver' },
        { program: 'united', tier: 'Gold' },
      ],
    })
    expect(out.airlineStatuses).toEqual([{ program: 'united', tier: 'Gold' }])
  })

  it('caps the status list at 12', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ program: `Airline ${i}`, tier: 'Gold' }))
    expect(validateProfile({ airlineStatuses: many }).airlineStatuses).toHaveLength(12)
  })

  it('omits airlineStatuses entirely when none are valid', () => {
    expect(validateProfile({ airlineStatuses: [{ program: 'United' }] }).airlineStatuses).toBeUndefined()
    expect(validateProfile({ airlineStatuses: 'bad' }).airlineStatuses).toBeUndefined()
  })

  it('merge overwrites a held tier for the same program, appends new ones', () => {
    const base: TravelProfile = { airlineStatuses: [{ program: 'United', tier: 'Silver' }] }
    const patch: TravelProfile = {
      airlineStatuses: [
        { program: 'United', tier: 'Gold' },
        { program: 'Delta', tier: 'Silver' },
      ],
    }
    const merged = mergeProfile(base, patch)
    expect(merged.airlineStatuses).toEqual([
      { program: 'United', tier: 'Gold' },
      { program: 'Delta', tier: 'Silver' },
    ])
  })

  it('counts a profile with only statuses as non-empty', () => {
    expect(isEmptyProfile({ airlineStatuses: [{ program: 'United', tier: 'Gold' }] })).toBe(false)
    expect(isEmptyProfile({ airlineStatuses: [] })).toBe(true)
  })

  it('summary renders statuses as "Program: Tier" pairs the concierge can read', () => {
    const s = profileSummary({
      airlineStatuses: [
        { program: 'United', tier: 'Gold' },
        { program: 'Delta', tier: 'Silver' },
      ],
    })
    expect(s).toContain('Elite status:')
    expect(s).toContain('United: Gold')
    expect(s).toContain('Delta: Silver')
  })
})
