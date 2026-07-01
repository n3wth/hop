import { describe, it, expect } from 'vitest'
import { googleCalendarUrl } from '@/lib/calendar-link'

// Pull the decoded query params out of the built URL for assertions.
function params(url: string): URLSearchParams {
  return new URL(url).searchParams
}

describe('googleCalendarUrl', () => {
  it('builds an all-day round-trip event with an EXCLUSIVE end date (return + 1)', () => {
    const url = googleCalendarUrl({
      fromCode: 'SFO',
      toCode: 'NRT',
      fromCity: 'San Francisco',
      toCity: 'Tokyo',
      depart: '2026-07-09',
      return: '2026-07-16',
      cabin: 'business',
    })!
    expect(url.startsWith('https://calendar.google.com/calendar/render?')).toBe(true)
    const p = params(url)
    expect(p.get('action')).toBe('TEMPLATE')
    expect(p.get('text')).toBe('Trip to Tokyo')
    // end is EXCLUSIVE → Jul 16 return blocks through Jul 16, so end = Jul 17
    expect(p.get('dates')).toBe('20260709/20260717')
    expect(p.get('location')).toBe('Tokyo')
    expect(p.get('details')).toContain('San Francisco (SFO) → Tokyo (NRT)')
    expect(p.get('details')).toContain('Cabin: Business')
  })

  it('one-way → single all-day event (end = depart + 1)', () => {
    const url = googleCalendarUrl({ fromCode: 'JFK', toCode: 'LHR', depart: '2026-03-01' })!
    expect(params(url).get('dates')).toBe('20260301/20260302')
  })

  it('handles month/year rollover in the exclusive end', () => {
    const nye = googleCalendarUrl({ fromCode: 'A', toCode: 'B', toCity: 'B', depart: '2026-12-31' })!
    expect(params(nye).get('dates')).toBe('20261231/20270101')
    const eom = googleCalendarUrl({ fromCode: 'A', toCode: 'B', toCity: 'B', depart: '2026-01-01', return: '2026-01-31' })!
    expect(params(eom).get('dates')).toBe('20260101/20260201')
  })

  it('carries NO economics — only route/dates/city/cabin', () => {
    const url = googleCalendarUrl({
      fromCode: 'SFO',
      toCode: 'NRT',
      toCity: 'Tokyo',
      depart: '2026-07-09',
      return: '2026-07-16',
      cabin: 'business',
    })!
    // no dollar figures, cents-per-point, or miles/points anywhere in the payload
    expect(url).not.toMatch(/\$|¢|cpp|cents.?per.?point/i)
    expect(decodeURIComponent(url)).not.toMatch(/\bmiles\b|\bpoints\b|\bcash\b|\bcpp\b/i)
  })

  it('returns null for malformed / missing dates so the caller can hide the button', () => {
    expect(googleCalendarUrl({ fromCode: 'A', toCode: 'B', toCity: 'B', depart: 'soon' })).toBeNull()
    expect(googleCalendarUrl({ fromCode: 'A', toCode: 'B', toCity: 'B', depart: '' })).toBeNull()
    // a malformed return falls back to a one-way (day-after-depart), never throws
    const url = googleCalendarUrl({ fromCode: 'A', toCode: 'B', toCity: 'B', depart: '2026-07-09', return: 'bad' })!
    expect(params(url).get('dates')).toBe('20260709/20260710')
  })

  it('falls back to codes when city names are absent', () => {
    const url = googleCalendarUrl({ fromCode: 'XXX', toCode: 'YYY', depart: '2026-05-05' })!
    expect(params(url).get('text')).toBe('Trip to YYY')
    expect(params(url).get('details')).toContain('XXX (XXX) → YYY (YYY)')
  })
})
