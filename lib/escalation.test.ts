import { describe, it, expect } from 'vitest'
import {
  createEscalation,
  listEscalations,
  normalizeEmail,
  normalizeTrip,
} from '@/lib/escalation'

// lib/escalation must degrade gracefully like every other hop_* persistence
// module: never throw, and (with no Supabase configured in tests — withDb
// short-circuits to the fallback) return null/[] rather than reaching out.
// These tests run offline: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// are unset under vitest, so supabaseAdmin() is null and withDb returns the
// fallback without any network call. We also cover the pure validators.

describe('normalizeEmail', () => {
  it('accepts a plain address and trims it', () => {
    expect(normalizeEmail('  you@example.com ')).toBe('you@example.com')
  })

  it('rejects junk / non-strings', () => {
    expect(normalizeEmail('not-an-email')).toBeNull()
    expect(normalizeEmail('a@b')).toBeNull() // no dot in domain
    expect(normalizeEmail('a b@c.com')).toBeNull() // space
    expect(normalizeEmail('')).toBeNull()
    expect(normalizeEmail(undefined)).toBeNull()
    expect(normalizeEmail(42)).toBeNull()
    expect(normalizeEmail(null)).toBeNull()
  })
})

describe('normalizeTrip', () => {
  it('keeps primitive context and drops non-JSON-safe values', () => {
    const trip = normalizeTrip({
      route: '  SFO → NRT ',
      dates: 'late March',
      notes: '  2 in business ',
      totalPoints: 120000,
      flexible: true,
      nested: { nope: 1 }, // dropped
      list: [1, 2, 3], // dropped
      empty: '   ', // dropped (blank after trim)
      missing: null, // dropped
    })
    expect(trip).toEqual({
      route: 'SFO → NRT',
      dates: 'late March',
      notes: '2 in business',
      totalPoints: 120000,
      flexible: true,
    })
  })

  it('drops a non-finite number', () => {
    expect(normalizeTrip({ totalPoints: Number.NaN })).toEqual({})
    expect(normalizeTrip({ totalPoints: Infinity })).toEqual({})
  })

  it('returns {} for non-object input', () => {
    expect(normalizeTrip(null)).toEqual({})
    expect(normalizeTrip('nope')).toEqual({})
    expect(normalizeTrip([1, 2, 3])).toEqual({})
    expect(normalizeTrip(undefined)).toEqual({})
  })

  it('caps an over-long note instead of throwing', () => {
    const long = 'x'.repeat(5000)
    const trip = normalizeTrip({ notes: long })
    expect(typeof trip.notes).toBe('string')
    expect((trip.notes as string).length).toBeLessThanOrEqual(2000)
  })
})

describe('createEscalation (graceful, no db)', () => {
  it('returns null when the email is unusable (never throws)', async () => {
    await expect(createEscalation({ email: 'garbage' })).resolves.toBeNull()
    // @ts-expect-error — exercising a bad runtime shape on purpose.
    await expect(createEscalation({})).resolves.toBeNull()
  })

  it('returns null when no db is configured, even for a valid lead', async () => {
    // Valid email + context, but withDb short-circuits to the null fallback
    // because supabaseAdmin() is null in tests. Must resolve, not throw.
    await expect(
      createEscalation({
        userId: 'auth0|abc',
        email: 'traveler@example.com',
        trip: { route: 'SFO → NRT', totalPoints: 90000 },
      }),
    ).resolves.toBeNull()
  })
})

describe('listEscalations (graceful, no db)', () => {
  it('returns [] for an empty user id without touching the db', async () => {
    await expect(listEscalations('')).resolves.toEqual([])
  })

  it('returns [] when no db is configured (never throws)', async () => {
    await expect(listEscalations('auth0|abc')).resolves.toEqual([])
  })
})
