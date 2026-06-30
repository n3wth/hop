import { describe, it, expect } from 'vitest'
import { projectProfile, groupFacts } from '@/lib/memory-view'
import { validateProfile, type TravelProfile } from '@/lib/travel-profile-model'

describe('projectProfile', () => {
  it('returns [] for an empty / missing profile', () => {
    expect(projectProfile({})).toEqual([])
    expect(projectProfile(undefined)).toEqual([])
    expect(projectProfile(null)).toEqual([])
  })

  it('projects scalar fields into source-tagged rows', () => {
    const facts = projectProfile({ vacationDays: 25, travelParty: 'couple', cabin: 'business' })
    expect(facts.map((f) => [f.kind, f.value, f.group])).toEqual([
      ['vacationDays', '25 days', 'rhythm'],
      ['travelParty', 'Couple', 'rhythm'],
      ['cabin', 'Business', 'style'],
    ])
    expect(facts.every((f) => f.source === 'stated' && f.editable)).toBe(true)
  })

  it('singularizes a one-day vacation allowance', () => {
    expect(projectProfile({ vacationDays: 1 })[0].value).toBe('1 day')
  })

  it('emits one row per list ENTRY, each individually forgettable', () => {
    const facts = projectProfile({
      lovedDestinations: ['Lisbon', 'Tokyo'],
      avoidedDestinations: ['Cancun'],
      dietary: ['vegetarian'],
    })
    const loves = facts.filter((f) => f.kind === 'lovedDestinations')
    expect(loves.map((f) => f.value)).toEqual(['Lisbon', 'Tokyo'])
    // each list row carries the exact entry to forget + a stable id
    expect(loves[0]).toMatchObject({ entry: 'Lisbon', id: 'lovedDestinations:lisbon', group: 'places' })
    expect(facts.find((f) => f.kind === 'avoidedDestinations')?.value).toBe('Cancun')
    expect(facts.find((f) => f.kind === 'dietary')?.group).toBe('style')
  })

  it('every projected fact is tagged source "stated" and editable', () => {
    const facts = projectProfile({ vacationDays: 10, lovedDestinations: ['Rome'] })
    expect(facts.every((f) => f.source === 'stated')).toBe(true)
    expect(facts.every((f) => f.editable === true)).toBe(true)
  })

  it('never projects airline statuses (managed by their own editor)', () => {
    const facts = projectProfile({ airlineStatuses: [{ program: 'United', tier: 'Gold' }] })
    expect(facts).toEqual([])
  })

  it('yields no rows for a garbage profile once clamped through validateProfile', () => {
    const garbage = validateProfile({ vacationDays: 'lots', cabin: 'spaceship', lovedDestinations: 42 } as unknown)
    expect(projectProfile(garbage)).toEqual([])
  })

  it('round-trips a realistic validated profile into stable rows', () => {
    const raw: TravelProfile = {
      vacationDays: 25,
      cabin: 'business',
      lovedDestinations: ['Lisbon'],
      avoidedDestinations: ['Cancun'],
    }
    const facts = projectProfile(validateProfile(raw))
    expect(facts.map((f) => f.kind)).toEqual([
      'vacationDays',
      'cabin',
      'lovedDestinations',
      'avoidedDestinations',
    ])
  })
})

describe('groupFacts', () => {
  it('orders groups rhythm → style → places and drops empty ones', () => {
    const grouped = groupFacts(projectProfile({ cabin: 'economy', lovedDestinations: ['Oslo'] }))
    expect(grouped.map((g) => g.group)).toEqual(['style', 'places'])
    expect(grouped.find((g) => g.group === 'style')?.facts[0].kind).toBe('cabin')
  })

  it('returns [] when there are no facts', () => {
    expect(groupFacts([])).toEqual([])
  })
})
