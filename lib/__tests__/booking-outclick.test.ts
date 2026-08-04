import { describe, it, expect } from 'vitest'

// The cash outclick seam (Linear N-302): isAllowedCashOutclickUrl is the ONLY
// line between /api/go/kiwi's ?to= param and a 302 Location header, so it gets
// the adversarial treatment — every open-redirect shape must fail closed.
// cashOutclickPath/cashBookingUrl mint the wrapper hrefs the UI renders.

import {
  cashBookingUrl,
  cashOutclickPath,
  isAllowedCashOutclickUrl,
  kiwiSearchUrl,
  normalizeOutclickRoute,
  tpKiwiAttributionUrl,
} from '@/lib/booking'
import type { SearchParams } from '@/lib/types'

const PARAMS: SearchParams = {
  from: 'SFO',
  to: 'LAX',
  depart: '2026-07-09',
  return: '2026-07-12',
  adults: 2,
}

describe('isAllowedCashOutclickUrl', () => {
  it('accepts the kiwi.com results deep-link our own builder mints', () => {
    expect(isAllowedCashOutclickUrl(kiwiSearchUrl(PARAMS))).toBe(true)
    expect(isAllowedCashOutclickUrl('https://www.kiwi.com/en/search/results/SFO/LAX/2026-07-09?adults=1')).toBe(true)
    expect(isAllowedCashOutclickUrl('https://kiwi.com/en/')).toBe(true)
  })

  it('accepts tp.media (Travelpayouts) redirects ONLY when ?u= is a kiwi.com deep-link', () => {
    expect(isAllowedCashOutclickUrl('https://tp.media/r?marker=545389&p=100&u=https%3A%2F%2Fwww.kiwi.com')).toBe(true)
    expect(isAllowedCashOutclickUrl('https://www.tp.media/r?u=https%3A%2F%2Fkiwi.com%2Fen%2F')).toBe(true)
    // exactly what our builder mints round-trips
    expect(isAllowedCashOutclickUrl(tpKiwiAttributionUrl(kiwiSearchUrl(PARAMS)))).toBe(true)
  })

  it('rejects tp.media whose ?u= is NOT kiwi.com — tp.media/r is an open redirector', () => {
    // The core open-redirect: tp.media forwards ?u= to ANY domain. An allowlisted
    // OUTER host must never be enough; the inner target has to be kiwi.com too.
    expect(isAllowedCashOutclickUrl('https://tp.media/r?marker=745576&u=https%3A%2F%2Fevil.example%2Fphish')).toBe(false)
    // no ?u= at all — not something our builder mints
    expect(isAllowedCashOutclickUrl('https://tp.media/r?marker=545389')).toBe(false)
    expect(isAllowedCashOutclickUrl('https://www.tp.media/r')).toBe(false)
    // inner target uses the same host-spoofing tricks the outer guard rejects
    expect(isAllowedCashOutclickUrl('https://tp.media/r?u=https%3A%2F%2Fwww.kiwi.com.evil.example%2F')).toBe(false)
    expect(isAllowedCashOutclickUrl('https://tp.media/r?u=https%3A%2F%2Fevil.kiwi.com%2F')).toBe(false)
    // inner target is a non-https / credentialed URL
    expect(isAllowedCashOutclickUrl('https://tp.media/r?u=http%3A%2F%2Fwww.kiwi.com%2F')).toBe(false)
    expect(isAllowedCashOutclickUrl('https://tp.media/r?u=https%3A%2F%2Fuser%3Apass%40www.kiwi.com%2F')).toBe(false)
    // inner is unparseable junk
    expect(isAllowedCashOutclickUrl('https://tp.media/r?u=not-a-url')).toBe(false)
  })

  it('rejects javascript:, data: and other non-https schemes', () => {
    expect(isAllowedCashOutclickUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedCashOutclickUrl('javascript://www.kiwi.com/%0aalert(1)')).toBe(false)
    expect(isAllowedCashOutclickUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isAllowedCashOutclickUrl('http://www.kiwi.com/en/')).toBe(false)
    expect(isAllowedCashOutclickUrl('ftp://www.kiwi.com/')).toBe(false)
  })

  it('rejects every other host — exact allowlist, no substring match', () => {
    expect(isAllowedCashOutclickUrl('https://evil.example/')).toBe(false)
    // allowlisted host as a SUBDOMAIN of an attacker domain
    expect(isAllowedCashOutclickUrl('https://www.kiwi.com.evil.example/')).toBe(false)
    // attacker subdomain of an allowlisted apex
    expect(isAllowedCashOutclickUrl('https://evil.kiwi.com/')).toBe(false)
    // allowlisted host in the PATH of an attacker URL
    expect(isAllowedCashOutclickUrl('https://evil.example/www.kiwi.com')).toBe(false)
    // allowlisted host in the QUERY (nested open-redirect attempt)
    expect(isAllowedCashOutclickUrl('https://evil.example/redirect?to=https://www.kiwi.com')).toBe(false)
  })

  it('rejects userinfo tricks — kiwi.com as credentials, host = attacker', () => {
    expect(isAllowedCashOutclickUrl('https://www.kiwi.com@evil.example/')).toBe(false)
    expect(isAllowedCashOutclickUrl('https://www.kiwi.com:pass@evil.example/')).toBe(false)
    // credentials on an otherwise-allowed host are rejected too — our builder
    // never mints them, so their presence means tampering
    expect(isAllowedCashOutclickUrl('https://user:pass@www.kiwi.com/')).toBe(false)
  })

  it('rejects explicit ports, protocol-relative and relative URLs, and junk', () => {
    expect(isAllowedCashOutclickUrl('https://www.kiwi.com:8443/en/')).toBe(false)
    expect(isAllowedCashOutclickUrl('//www.kiwi.com/en/')).toBe(false)
    expect(isAllowedCashOutclickUrl('/en/search')).toBe(false)
    expect(isAllowedCashOutclickUrl('www.kiwi.com/en/')).toBe(false)
    expect(isAllowedCashOutclickUrl('')).toBe(false)
    expect(isAllowedCashOutclickUrl('not a url')).toBe(false)
  })
})

describe('normalizeOutclickRoute', () => {
  it('normalizes IATA-IATA shapes and rejects everything else', () => {
    expect(normalizeOutclickRoute('SFO-LAX')).toBe('SFO-LAX')
    expect(normalizeOutclickRoute(' sfo-lax ')).toBe('SFO-LAX')
    expect(normalizeOutclickRoute('SFOX-LAX')).toBeNull()
    expect(normalizeOutclickRoute('https://evil.example')).toBeNull()
    expect(normalizeOutclickRoute('')).toBeNull()
    expect(normalizeOutclickRoute(null)).toBeNull()
    expect(normalizeOutclickRoute(undefined)).toBeNull()
  })
})

describe('cashOutclickPath', () => {
  it('builds the wrapper path with an encoded destination + route context', () => {
    const path = cashOutclickPath('https://www.kiwi.com/en/search/results/SFO/LAX/2026-07-09?adults=1', 'SFO-LAX')
    expect(path.startsWith('/api/go/kiwi?')).toBe(true)
    const query = new URL(path, 'http://localhost').searchParams
    expect(query.get('to')).toBe('https://www.kiwi.com/en/search/results/SFO/LAX/2026-07-09?adults=1')
    expect(query.get('route')).toBe('SFO-LAX')
  })

  it('omits a malformed route instead of shipping junk context', () => {
    const path = cashOutclickPath('https://www.kiwi.com/en/', 'not-a-route')
    const query = new URL(path, 'http://localhost').searchParams
    expect(query.get('route')).toBeNull()
    expect(query.get('to')).toBe('https://www.kiwi.com/en/')
  })
})

describe('tpKiwiAttributionUrl', () => {
  it('mints the tp.media redirect with this property\'s attribution ids', () => {
    const url = new URL(tpKiwiAttributionUrl('https://www.kiwi.com/en/'))
    expect(url.origin + url.pathname).toBe('https://tp.media/r')
    // The exact values Travelpayouts' link-conversion API returns for
    // hop.flights (trs 545389) + Kiwi.com — verified 2026-07-04 against
    // POST emrldtp.com/link-switch/v1/convert. If these drift, commissions
    // silently stop attributing.
    expect(url.searchParams.get('marker')).toBe('745576')
    expect(url.searchParams.get('trs')).toBe('545389')
    expect(url.searchParams.get('p')).toBe('4136')
    expect(url.searchParams.get('campaign_id')).toBe('111')
  })

  it('round-trips the wrapped Kiwi deep-link through ?u= and passes the allowlist', () => {
    const kiwi = kiwiSearchUrl(PARAMS)
    const wrapped = tpKiwiAttributionUrl(kiwi)
    expect(new URL(wrapped).searchParams.get('u')).toBe(kiwi)
    expect(isAllowedCashOutclickUrl(wrapped)).toBe(true)
  })
})

describe('cashBookingUrl (wrapper)', () => {
  it('round-trips: the wrapped destination is the tp.media attribution link and passes the allowlist', () => {
    const query = new URL(cashBookingUrl(PARAMS), 'http://localhost').searchParams
    const destination = query.get('to')!
    expect(destination).toBe(tpKiwiAttributionUrl(kiwiSearchUrl(PARAMS)))
    expect(isAllowedCashOutclickUrl(destination)).toBe(true)
    expect(query.get('route')).toBe('SFO-LAX')
  })

  it('normalizes lowercase/padded airport codes into the route context', () => {
    const query = new URL(
      cashBookingUrl({ ...PARAMS, from: ' sfo ', to: 'lax' }),
      'http://localhost',
    ).searchParams
    expect(query.get('route')).toBe('SFO-LAX')
  })
})
