// The login round-trip must return the visitor to the EXACT url they were on,
// query included — /book's offer/route params ARE the booking context, and
// dropping them strands the user on "No flight selected" after signing in.
import { describe, expect, it } from 'vitest'
import { loginHrefFor, safeReturnTo } from '@/lib/safe-return'

describe('loginHrefFor', () => {
  it('carries the full query through the returnTo', () => {
    const href = loginHrefFor('/book', {
      offer: 'off_123',
      from: 'SFO',
      to: 'NRT',
      depart: '2026-08-12',
    })
    const returnTo = new URL(href, 'https://hop.flights').searchParams.get('returnTo')
    expect(returnTo).toBe('/book?offer=off_123&from=SFO&to=NRT&depart=2026-08-12')
  })

  it('round-trips through safeReturnTo (what /login actually applies)', () => {
    const href = loginHrefFor('/book', { offer: 'off_123', from: 'SFO' })
    const raw = new URL(href, 'https://hop.flights').searchParams.get('returnTo') ?? undefined
    expect(safeReturnTo(raw)).toBe('/book?offer=off_123&from=SFO')
  })

  it('bare path when there is no query', () => {
    expect(loginHrefFor('/account', {})).toBe(`/login?returnTo=${encodeURIComponent('/account')}`)
  })

  it('takes the first value of repeated params and skips empties', () => {
    const href = loginHrefFor('/book', { offer: ['a', 'b'], from: undefined, to: '' })
    const returnTo = new URL(href, 'https://hop.flights').searchParams.get('returnTo')
    expect(returnTo).toBe('/book?offer=a')
  })
})

describe('safeReturnTo', () => {
  it('accepts app-relative paths with queries', () => {
    expect(safeReturnTo('/search?from=SFO&to=NRT')).toBe('/search?from=SFO&to=NRT')
  })
  it('rejects open-redirect shapes', () => {
    expect(safeReturnTo('https://evil.com')).toBeNull()
    expect(safeReturnTo('//evil.com')).toBeNull()
    expect(safeReturnTo('/\\evil.com')).toBeNull()
  })
})
