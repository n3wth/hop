import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SearchParams } from '@/lib/types'
import { normalizeDuffelOffer, searchCash } from '@/lib/duffel'
import { normalizeSeatsAeroRecord, searchAwards } from '@/lib/seatsaero'
import {
  deriveCode,
  normalizeAwardWalletAccount,
  isPointsAccount,
  getBalances,
} from '@/lib/awardwallet'
import { pointsBookingUrl, cashBookingUrl, kiwiSearchUrl } from '@/lib/booking'
import { mockCash, mockAwards, mockBalances } from '@/lib/mock'
import { cacheClearMemory } from '@/lib/cache'

const PARAMS: SearchParams = {
  from: 'SFO',
  to: 'LAX',
  depart: '2026-07-09',
  return: '2026-07-12',
  adults: 1,
}

// Snapshot + restore env so individual tests can toggle key presence.
const ORIGINAL_ENV = { ...process.env }
afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  // searchCash caches by params (lib/duffel.ts) — clear the in-memory cache so
  // one test's cached result can't swallow the next test's stubbed fetch.
  cacheClearMemory()
})

describe('duffel normalizer', () => {
  it('maps an offer to a cash FlightOption', () => {
    const offer = {
      id: 'off_123',
      total_amount: '254.00',
      tax_amount: '38.20',
      owner: { name: 'United Airlines', iata_code: 'UA' },
      slices: [
        {
          origin: { iata_code: 'SFO' },
          destination: { iata_code: 'LAX' },
          duration: 'PT1H32M',
          segments: [
            {
              departing_at: '2026-07-09T08:00:00',
              arriving_at: '2026-07-09T09:32:00',
              duration: 'PT1H32M',
              marketing_carrier: { name: 'United', iata_code: 'UA' },
            },
          ],
        },
      ],
    }
    const opt = normalizeDuffelOffer(offer, PARAMS, 0)
    expect(opt.kind).toBe('cash')
    expect(opt.id).toBe('off_123')
    expect(opt.cashPrice).toBe(254)
    expect(opt.taxes).toBe(38.2)
    expect(opt.airline).toBe('United Airlines')
    expect(opt.airlineCode).toBe('UA')
    expect(opt.route).toBe('SFO → LAX')
    expect(opt.date).toBe('Jul 9')
    expect(opt.durationMin).toBe(92)
    expect(opt.direct).toBe(true)
    expect(opt.roundTrip).toBe(true) // params.return is set
    expect(opt.bookingUrl).toContain('kiwi.com')
  })

  it('falls back to params + generated id when fields are missing', () => {
    const opt = normalizeDuffelOffer({}, PARAMS, 2)
    expect(opt.id).toBe('duffel-2')
    expect(opt.route).toBe('SFO → LAX')
    expect(opt.airline).toBe('Unknown')
    expect(opt.cashPrice).toBe(0)
  })

  it('marks multi-segment slices as not direct', () => {
    const offer = {
      slices: [
        {
          segments: [
            { departing_at: '2026-07-09T08:00:00', marketing_carrier: { iata_code: 'UA' } },
            { departing_at: '2026-07-09T11:00:00', marketing_carrier: { iata_code: 'UA' } },
          ],
        },
      ],
    }
    const opt = normalizeDuffelOffer(offer, PARAMS, 0)
    expect(opt.direct).toBe(false)
  })

  it('returns {ok:false} (does not throw) when fetch fails', async () => {
    process.env.DUFFEL_API_KEY_LIVE = 'test-key'
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    )
    const result = await searchCash(PARAMS)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('Duffel request failed')
  })

  it('returns {ok:false} on a non-ok HTTP status', async () => {
    process.env.DUFFEL_API_KEY_LIVE = 'test-key'
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('nope', { status: 500 }))),
    )
    const result = await searchCash(PARAMS)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('500')
  })

  it('returns {ok:false} when the API key is absent', async () => {
    delete process.env.DUFFEL_API_KEY_LIVE
    const result = await searchCash(PARAMS)
    expect(result.ok).toBe(false)
  })

  it('parses a successful offer_requests response', async () => {
    process.env.DUFFEL_API_KEY_LIVE = 'test-key'
    const payload = {
      data: { offers: [{ id: 'o1', total_amount: '199.00', tax_amount: '20.00', owner: { name: 'Alaska', iata_code: 'AS' }, slices: [{ origin: { iata_code: 'SFO' }, destination: { iata_code: 'LAX' }, segments: [{ departing_at: '2026-07-09T08:00:00' }] }] }] },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }))),
    )
    const result = await searchCash(PARAMS)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(1)
      expect(result.data[0].cashPrice).toBe(199)
    }
  })

  // Read the JSON body the client POSTs to Duffel from a fetch spy.
  async function capturedDuffelBody(
    params: SearchParams,
  ): Promise<{ cabin_class: string; passengers: Array<{ type: string }> }> {
    process.env.DUFFEL_API_KEY_LIVE = 'test-key'
    const fetchSpy = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ data: { offers: [] } }), { status: 200 })),
    )
    vi.stubGlobal('fetch', fetchSpy)
    await searchCash(params)
    const init = (fetchSpy.mock.calls[0] as unknown[])[1] as RequestInit
    return JSON.parse(init.body as string).data
  }

  it('defaults to economy and adults-only when cabin/mix are absent (backward compatible)', async () => {
    const body = await capturedDuffelBody(PARAMS)
    expect(body.cabin_class).toBe('economy')
    expect(body.passengers).toEqual([{ type: 'adult' }])
  })

  it('maps each cabin to Duffel cabin_class', async () => {
    expect((await capturedDuffelBody({ ...PARAMS, cabin: 'premium' })).cabin_class).toBe('premium_economy')
    expect((await capturedDuffelBody({ ...PARAMS, cabin: 'business' })).cabin_class).toBe('business')
    expect((await capturedDuffelBody({ ...PARAMS, cabin: 'first' })).cabin_class).toBe('first')
    expect((await capturedDuffelBody({ ...PARAMS, cabin: 'economy' })).cabin_class).toBe('economy')
  })

  it('builds the passenger mix with adults, children, and lap infants', async () => {
    const body = await capturedDuffelBody({ ...PARAMS, adults: 2, children: 1, infants: 1 })
    expect(body.passengers).toEqual([
      { type: 'adult' },
      { type: 'adult' },
      { type: 'child' },
      { type: 'infant_without_seat' },
    ])
  })
})

describe('seats.aero normalizer', () => {
  it('maps an availability record to an award FlightOption (verified shape)', () => {
    const rec = {
      ID: 'avail_1',
      Route: { OriginAirport: 'SFO', DestinationAirport: 'LAX' },
      Date: '2026-07-09',
      Source: 'alaska',
      YAvailable: true,
      YMileageCost: '4500',
      YTotalTaxes: 1810, // VERIFIED: cents -> $18.10
      YAirlines: 'AS',
    }
    const opt = normalizeSeatsAeroRecord(rec, PARAMS, 0)
    expect(opt).toBeDefined()
    expect(opt!.kind).toBe('award')
    expect(opt!.miles).toBe(4500)
    expect(opt!.taxes).toBe(18.1)
    expect(opt!.airline).toBe('Alaska Atmos')
    expect(opt!.airlineCode).toBe('AS')
    expect(opt!.program).toBe('Alaska Atmos Rewards')
    expect(opt!.route).toBe('SFO → LAX')
    expect(opt!.date).toBe('Jul 9')
    expect(opt!.bookingUrl).toContain('alaskaair.com')
  })

  it('prefers the program carrier when it operates the cabin (multi-carrier list)', () => {
    // VERIFIED live: Alaska award space sells on "AA, AS" metal. The Alaska
    // (AS) brand should win for the monogram, not the first-listed partner AA.
    const rec = {
      Source: 'alaska',
      YAvailable: true,
      YMileageCost: '4500',
      YTotalTaxes: 1810,
      YAirlines: 'AA, AS',
    }
    const opt = normalizeSeatsAeroRecord(rec, PARAMS, 0)
    expect(opt!.airlineCode).toBe('AS')
  })

  it('falls back to the partner carrier when the program carrier is absent', () => {
    // VERIFIED live: JetBlue award space flown on pure UA metal — a genuine
    // partner booking, so the operating carrier code is the honest answer.
    const rec = {
      Source: 'jetblue',
      YAvailable: true,
      YMileageCost: '10000',
      YTotalTaxes: 560,
      YAirlines: 'UA',
    }
    const opt = normalizeSeatsAeroRecord(rec, PARAMS, 0)
    expect(opt!.program).toBe('JetBlue TrueBlue')
    expect(opt!.airlineCode).toBe('UA') // real metal, B6 not in the list
    expect(opt!.bookingUrl).toContain('jetblue') // still books in the program portal
  })

  it('title-cases an unmapped program slug for display', () => {
    const rec = { Source: 'azul', YAvailable: true, YMileageCost: '16830', YTotalTaxes: 2326 }
    const opt = normalizeSeatsAeroRecord(rec, PARAMS, 0)
    // azul/frontier/smiles are now mapped; an unknown slug still title-cases.
    expect(opt!.airline).toBe('Azul')
    const unknown = normalizeSeatsAeroRecord(
      { Source: 'somenewprogram', YAvailable: true, YMileageCost: '5000' },
      PARAMS,
      0,
    )
    expect(unknown!.airline).toBe('Somenewprogram')
  })

  it('prefers economy but falls back to business when only J is available', () => {
    const rec = {
      Source: 'united',
      YAvailable: false,
      YMileageCost: '0',
      JAvailable: true,
      JMileageCost: '25000',
      JTotalTaxes: 560,
    }
    const opt = normalizeSeatsAeroRecord(rec, PARAMS, 0)
    expect(opt!.miles).toBe(25000)
    expect(opt!.taxes).toBe(5.6)
  })

  it('skips records with no available cabin / zero miles', () => {
    const rec = { Source: 'united', YAvailable: false, YMileageCost: '0' }
    const opt = normalizeSeatsAeroRecord(rec, PARAMS, 0)
    expect(opt).toBeUndefined()
  })

  it('keeps the requested cabin when it is available (does not fall to cheaper economy)', () => {
    // All three cabins available; without a request, economy wins. Requesting
    // business should serve J, not the cheaper Y.
    const rec = {
      Source: 'united',
      YAvailable: true,
      YMileageCost: '12000',
      YTotalTaxes: 560,
      JAvailable: true,
      JMileageCost: '25000',
      JTotalTaxes: 560,
    }
    const economy = normalizeSeatsAeroRecord(rec, PARAMS, 0)
    expect(economy!.miles).toBe(12000)
    expect(economy!.cabin).toBe('Economy')

    const business = normalizeSeatsAeroRecord(rec, { ...PARAMS, cabin: 'business' }, 0)
    expect(business!.miles).toBe(25000)
    expect(business!.cabin).toBe('Business')
  })

  it('falls through to another cabin when the requested one is unavailable', () => {
    // Business requested but only economy available — keep the record, serve Y.
    const rec = { Source: 'united', YAvailable: true, YMileageCost: '9000', YTotalTaxes: 560 }
    const opt = normalizeSeatsAeroRecord(rec, { ...PARAMS, cabin: 'business' }, 0)
    expect(opt!.miles).toBe(9000)
    expect(opt!.cabin).toBe('Economy')
  })

  it('requesting premium serves the W cabin', () => {
    const rec = {
      Source: 'united',
      YAvailable: true,
      YMileageCost: '9000',
      WAvailable: true,
      WMileageCost: '15000',
      WTotalTaxes: 560,
    }
    const opt = normalizeSeatsAeroRecord(rec, { ...PARAMS, cabin: 'premium' }, 0)
    expect(opt!.miles).toBe(15000)
    expect(opt!.cabin).toBe('Premium Economy')
  })

  it('returns {ok:false} (does not throw) when fetch fails', async () => {
    process.env.SEATS_AERO_API_KEY = 'test-key'
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    )
    const result = await searchAwards(PARAMS)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('Seats.aero request failed')
  })

  it('returns {ok:false} on a non-ok HTTP status', async () => {
    process.env.SEATS_AERO_API_KEY = 'test-key'
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('nope', { status: 401 }))),
    )
    const result = await searchAwards(PARAMS)
    expect(result.ok).toBe(false)
  })

  it('parses and filters a successful search response', async () => {
    process.env.SEATS_AERO_API_KEY = 'test-key'
    const payload = {
      data: [
        { ID: 'a', Source: 'alaska', Route: { OriginAirport: 'SFO', DestinationAirport: 'LAX' }, Date: '2026-07-09', YAvailable: true, YMileageCost: '4500', YTotalTaxes: 1120 },
        { ID: 'b', Source: 'united', YAvailable: false, YMileageCost: '0' }, // filtered out
      ],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }))),
    )
    const result = await searchAwards(PARAMS)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(1)
      expect(result.data[0].miles).toBe(4500)
    }
  })
})

describe('awardwallet normalizer', () => {
  it('derives 2-letter monograms from known programs', () => {
    expect(deriveCode('Amex Membership Rewards')).toBe('AX')
    expect(deriveCode('British Airways Avios')).toBe('BA')
    expect(deriveCode('Bilt Rewards')).toBe('BR')
    expect(deriveCode('Chase Ultimate Rewards')).toBe('UR')
    expect(deriveCode('Alaska Atmos')).toBe('AS')
    expect(deriveCode('Southwest Rapid Rewards')).toBe('WN')
  })

  it('derives initials for unknown programs', () => {
    expect(deriveCode('Frontier Miles')).toBe('FR')
    expect(deriveCode('Spirit Saver Club')).toBe('SS')
  })

  it('maps an account to a Balance, stripping commas (real displayName shape)', () => {
    const balance = normalizeAwardWalletAccount({
      code: 'amex',
      displayName: 'Amex (Membership Rewards)',
      kind: 'Credit Cards',
      balance: '340,358',
      balanceRaw: 340358,
    })
    expect(balance.program).toBe('Amex (Membership Rewards)')
    expect(balance.code).toBe('AX')
    expect(balance.balance).toBe(340358)
  })

  it('extracts elite status from the properties array (varying key names)', () => {
    const ba = normalizeAwardWalletAccount({
      displayName: 'British Airways (Club)',
      kind: 'Airlines',
      balanceRaw: 103042,
      properties: [
        { name: 'Level', value: 'Bronze' },
        { name: 'Membership no', value: '63699525' },
      ],
    })
    expect(ba.status).toBe('Bronze')

    const delta = normalizeAwardWalletAccount({
      displayName: 'Delta Air Lines (SkyMiles)',
      kind: 'Airlines',
      balanceRaw: 3080,
      properties: [{ name: 'Membership Level', value: 'Member' }],
    })
    expect(delta.status).toBe('Member')
  })

  it('reads numeric balanceRaw when present', () => {
    const balance = normalizeAwardWalletAccount({ displayName: 'Bilt Rewards', balanceRaw: 49923 })
    expect(balance.balance).toBe(49923)
    expect(balance.status).toBeUndefined()
  })

  it('isPointsAccount keeps airlines/cards/hotels with a balance, drops the rest', () => {
    expect(isPointsAccount({ kind: 'Airlines', balanceRaw: 42766 })).toBe(true)
    expect(isPointsAccount({ kind: 'Credit Cards', balanceRaw: 340358 })).toBe(true)
    expect(isPointsAccount({ kind: 'Hotels', balanceRaw: 2341 })).toBe(true)
    // Rentals / Shopping loyalty cards are not redeemable travel currency.
    expect(isPointsAccount({ kind: 'Rentals', balance: 'n/a', balanceRaw: 0 })).toBe(false)
    expect(isPointsAccount({ kind: 'Shopping', balanceRaw: 0 })).toBe(false)
    // Zero balance excluded even for a points kind.
    expect(isPointsAccount({ kind: 'Airlines', balanceRaw: 0 })).toBe(false)
  })

  it('returns {ok:false} (does not throw) when fetch fails', async () => {
    process.env.AWARDWALLET_API_KEY = 'test-key'
    process.env.AWARDWALLET_USER_ID = '597319'
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    )
    const result = await getBalances()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('AwardWallet request failed')
  })

  it('returns {ok:false} when credentials are absent', async () => {
    delete process.env.AWARDWALLET_API_KEY
    delete process.env.AWARDWALLET_USER_ID
    const result = await getBalances()
    expect(result.ok).toBe(false)
  })

  it('parses a connectedUser response, filtering non-points accounts', async () => {
    process.env.AWARDWALLET_API_KEY = 'test-key'
    process.env.AWARDWALLET_USER_ID = '597319'
    // Verified live shape: displayName "Brand (Program)", category in `kind`,
    // status in `properties`, plus a Rentals account that must be dropped.
    const payload = {
      accounts: [
        {
          code: 'chase',
          displayName: 'Chase (Ultimate Rewards)',
          kind: 'Credit Cards',
          balance: '45,921',
          balanceRaw: 45921,
        },
        {
          code: 'alaskaair',
          displayName: 'Alaska Airlines (Atmos Rewards)',
          kind: 'Airlines',
          balanceRaw: 42766,
          properties: [{ name: 'Next Elite Level', value: 'Atmos Gold' }],
        },
        { code: 'avis', displayName: 'Avis (Preferred)', kind: 'Rentals', balance: 'n/a', balanceRaw: 0 },
      ],
    }
    const fetchSpy = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        void input
        void init
        return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }))
      },
    )
    vi.stubGlobal('fetch', fetchSpy)

    const result = await getBalances()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(2) // Avis filtered out
      expect(result.data[0].code).toBe('UR')
      expect(result.data[1].balance).toBe(42766)
    }

    // Verified: auth is the X-Authentication header, not Authorization.
    const init = fetchSpy.mock.calls[0][1] as RequestInit | undefined
    const headers = (init?.headers ?? {}) as Record<string, string>
    expect(headers['X-Authentication']).toBe('test-key')
    expect(headers['Authorization']).toBeUndefined()
  })

  it('returns {ok:false} on a non-2xx response, without throwing', async () => {
    process.env.AWARDWALLET_API_KEY = 'test-key'
    process.env.AWARDWALLET_USER_ID = '597319'
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('', { status: 403 }))),
    )
    const result = await getBalances()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('AwardWallet responded 403')
  })

  it('returns {ok:false} on an aborted/timed-out request', async () => {
    process.env.AWARDWALLET_API_KEY = 'test-key'
    process.env.AWARDWALLET_USER_ID = '597319'
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        const err = new Error('The operation was aborted')
        err.name = 'AbortError'
        return Promise.reject(err)
      }),
    )
    const result = await getBalances()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('AwardWallet request timed out')
  })

  it('returns {ok:false} (does not throw) on malformed JSON', async () => {
    process.env.AWARDWALLET_API_KEY = 'test-key'
    process.env.AWARDWALLET_USER_ID = '597319'
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('not json{', { status: 200 }))),
    )
    const result = await getBalances()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('AwardWallet request failed')
  })

  it('uses the explicit per-user id over the env global when both are present', async () => {
    process.env.AWARDWALLET_API_KEY = 'test-key'
    process.env.AWARDWALLET_USER_ID = 'env-global-id'
    const fetchSpy = vi.fn((input: RequestInfo | URL) => {
      void input
      return Promise.resolve(new Response(JSON.stringify({ accounts: [] }), { status: 200 }))
    })
    vi.stubGlobal('fetch', fetchSpy)

    const result = await getBalances('per-user-id')
    expect(result.ok).toBe(true)

    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain('per-user-id')
    expect(url).not.toContain('env-global-id')
  })

  it('falls back to the env global id when no per-user id is supplied', async () => {
    process.env.AWARDWALLET_API_KEY = 'test-key'
    process.env.AWARDWALLET_USER_ID = 'env-global-id'
    const fetchSpy = vi.fn((input: RequestInfo | URL) => {
      void input
      return Promise.resolve(new Response(JSON.stringify({ accounts: [] }), { status: 200 }))
    })
    vi.stubGlobal('fetch', fetchSpy)

    const result = await getBalances()
    expect(result.ok).toBe(true)

    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain('env-global-id')
  })

  it('returns {ok:false} when a per-user id is blank and no env fallback exists', async () => {
    process.env.AWARDWALLET_API_KEY = 'test-key'
    delete process.env.AWARDWALLET_USER_ID
    const result = await getBalances('   ')
    expect(result.ok).toBe(false)
  })
})

describe('booking urls', () => {
  it('routes award by program over airline code', () => {
    // United operated, but booked via Aeroplan portal.
    expect(pointsBookingUrl({ airlineCode: 'UA', program: 'Air Canada Aeroplan' })).toContain('aeroplan')
    expect(pointsBookingUrl({ airlineCode: 'AS' })).toContain('alaskaair.com')
    expect(pointsBookingUrl({ program: 'Southwest Rapid Rewards' })).toContain('southwest.com')
  })

  it('builds a round-trip Kiwi deep-link', () => {
    const url = kiwiSearchUrl(PARAMS)
    expect(url).toContain('kiwi.com')
    expect(url).toContain('SFO/LAX/2026-07-09')
    expect(url).toContain('LAX/SFO/2026-07-12')
    expect(url).toContain('adults=1')
  })

  it('wraps the cash CTA in the /api/go/kiwi outclick redirect (R0.6)', () => {
    const url = cashBookingUrl(PARAMS)
    expect(url.startsWith('/api/go/kiwi?')).toBe(true)
    const query = new URL(url, 'http://localhost').searchParams
    // The redirect destination is the tp.media attribution wrapper whose ?u=
    // is the Kiwi deep-link — attribution must not depend on the client tag.
    const destination = new URL(query.get('to')!)
    expect(destination.hostname).toBe('tp.media')
    expect(destination.searchParams.get('u')).toBe(kiwiSearchUrl(PARAMS))
    expect(query.get('route')).toBe('SFO-LAX')
  })

  it('defaults sensibly for an unknown program/airline', () => {
    expect(pointsBookingUrl({})).toContain('google.com/travel')
  })
})

describe('mock fixtures', () => {
  it('mockCash returns one cash option matching the design ($254 RT, ~$7.62 earn)', () => {
    const cash = mockCash()
    expect(cash).toHaveLength(1)
    expect(cash[0].kind).toBe('cash')
    expect(cash[0].cashPrice).toBe(254)
    expect(cash[0].earn).toBe(7.62)
    expect(cash[0].roundTrip).toBe(true)
  })

  it('mockAwards never bakes a cpp — the engine computes it vs live cash', () => {
    const awards = mockAwards()
    expect(awards).toHaveLength(4)
    const byCode = Object.fromEntries(awards.map((a) => [a.id, a]))
    expect(byCode['mock-award-as'].miles).toBe(4500)
    // cpp does not exist without a cash baseline: fixtures leave it undefined
    // and assembleSearch computes it (a stale hand-baked 5.6 once shipped).
    for (const a of awards) expect(a.cpp).toBeUndefined()
    expect(byCode['mock-award-as'].tier).toBe('muted')
    expect(byCode['mock-transfer-aeroplan'].kind).toBe('transfer')
    expect(byCode['mock-transfer-aeroplan'].miles).toBe(6000)
    expect(byCode['mock-transfer-aeroplan'].transferFrom).toHaveLength(2)
    expect(byCode['mock-award-ua'].miles).toBe(14100)
  })

  it('every mock option carries a tier and bookingUrl', () => {
    for (const opt of [...mockCash(), ...mockAwards()]) {
      expect(opt.tier).toBeDefined()
      // Awards deep-link out (absolute); cash goes through the first-party
      // /api/go/kiwi outclick wrapper (same-origin path) since R0.6.
      expect(opt.bookingUrl).toMatch(/^(https?:\/\/|\/api\/go\/kiwi\?)/)
    }
  })

  it('mockBalances returns the six design programs totaling 618,314', () => {
    const balances = mockBalances()
    expect(balances).toHaveLength(6)
    const total = balances.reduce((sum, b) => sum + b.balance, 0)
    expect(total).toBe(618314)
    expect(balances.map((b) => b.code)).toEqual(['AX', 'BA', 'BR', 'UR', 'AS', 'WN'])
  })
})
