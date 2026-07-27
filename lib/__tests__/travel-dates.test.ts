import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  clampTravelDates,
  DEFAULT_DEPART,
  isValidISO,
  resolveRelativeDate,
  resolveTravelDateIntent,
  todayISO,
} from '@/lib/travel-dates'

afterEach(() => {
  vi.useRealTimers()
})

// Freeze "today" at local midnight so comparisons are deterministic.
function setToday(iso: string) {
  vi.useFakeTimers()
  const [y, m, d] = iso.split('-').map(Number)
  vi.setSystemTime(new Date(y, m - 1, d, 12, 0, 0))
}

describe('todayISO / isValidISO', () => {
  it('formats local today as YYYY-MM-DD', () => {
    setToday('2026-08-05')
    expect(todayISO()).toBe('2026-08-05')
  })

  it('accepts only well-formed ISO dates', () => {
    expect(isValidISO('2026-07-09')).toBe(true)
    expect(isValidISO('07/09/2026')).toBe(false)
    expect(isValidISO('')).toBe(false)
    expect(isValidISO(undefined)).toBe(false)
  })
})

describe('clampTravelDates', () => {
  it('passes a valid future depart/return pair through', () => {
    setToday('2026-07-04')
    expect(clampTravelDates('2026-09-01', '2026-09-08')).toEqual({
      depart: '2026-09-01',
      return: '2026-09-08',
    })
  })

  it('rolls a past depart forward to today once the seed default is stale', () => {
    setToday('2027-01-15')
    expect(clampTravelDates('2026-07-09', undefined)).toEqual({ depart: '2027-01-15' })
    expect(clampTravelDates(undefined, undefined)).toEqual({ depart: '2027-01-15' })
  })

  it('uses the seed default for a past depart while the default is still future', () => {
    setToday('2026-07-04')
    expect(clampTravelDates('2026-07-01', undefined)).toEqual({ depart: DEFAULT_DEPART })
    expect(clampTravelDates('garbage', undefined)).toEqual({ depart: DEFAULT_DEPART })
  })

  it('is one-way when return is absent', () => {
    setToday('2026-07-04')
    expect(clampTravelDates('2026-09-01', undefined)).toEqual({ depart: '2026-09-01' })
  })

  it('drops a malformed or pre-departure return', () => {
    setToday('2026-07-04')
    expect(clampTravelDates('2026-09-01', '2026-08-30')).toEqual({ depart: '2026-09-01' })
    expect(clampTravelDates('2026-09-01', 'garbage')).toEqual({ depart: '2026-09-01' })
  })

  it('keeps a return that lands after a clamped depart', () => {
    setToday('2027-01-15')
    // depart clamps to today; the return survives because it is still >= depart.
    expect(clampTravelDates('2026-07-09', '2027-01-20')).toEqual({
      depart: '2027-01-15',
      return: '2027-01-20',
    })
  })
})

describe('relative travel-date intent', () => {
  it('resolves whole-day offsets from a supplied base', () => {
    expect(resolveRelativeDate('21', '2026-07-27')).toBe('2026-08-17')
    expect(resolveRelativeDate('28', '2026-07-27')).toBe('2026-08-24')
  })

  it('uses calendar-safe UTC arithmetic across a year rollover', () => {
    expect(resolveRelativeDate('21', '2026-12-20')).toBe('2027-01-10')
  })

  it('rejects malformed, out-of-range, and invalid-base input without throwing', () => {
    for (const raw of ['', '-1', '+1', '1.5', '01', '366', 'days']) {
      expect(resolveRelativeDate(raw, '2026-07-27')).toBeUndefined()
    }
    expect(resolveRelativeDate('365', '2026-07-27')).toBe('2027-07-27')
    expect(resolveRelativeDate('1', '2026-02-30')).toBeUndefined()
  })

  it('gives exact dates precedence while filling omitted values from offsets', () => {
    expect(
      resolveTravelDateIntent('2026-09-01', '2026-09-08', '21', '28', '2026-07-27'),
    ).toEqual({ depart: '2026-09-01', return: '2026-09-08' })
    expect(resolveTravelDateIntent(undefined, undefined, '21', '28', '2026-07-27')).toEqual({
      depart: '2026-08-17',
      return: '2026-08-24',
    })
  })

  it('preserves the existing return-before-depart clamp semantics', () => {
    setToday('2026-07-27')
    const intent = resolveTravelDateIntent(undefined, undefined, '28', '21', '2026-07-27')
    expect(clampTravelDates(intent.depart, intent.return)).toEqual({ depart: '2026-08-24' })
  })
})
