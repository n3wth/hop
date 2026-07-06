import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Balance, FlightOption, SearchParams, SearchResult } from '@/lib/types'
import {
  buildVerdictSnapshot,
  validateShareParams,
  newReceiptId,
  verdictContentHash,
  createSharedVerdict,
  getSharedVerdict,
  shareVerdict,
} from '@/lib/shared-verdicts'
import { _resetRateLimitForTest } from '@/lib/rate-limit'

// ── Fixtures ────────────────────────────────────────────────────────────────

const BALANCE_MARKER = 'FIXTURE_BALANCE_MARKER_618314'

function fixtureBalances(): Balance[] {
  return [{ program: BALANCE_MARKER, code: 'AX', balance: 618314 }]
}

function fixtureParams(overrides: Partial<SearchParams> = {}): SearchParams {
  return { from: 'SFO', to: 'NRT', depart: '2027-01-10', return: '2027-01-24', adults: 1, ...overrides }
}

function fixtureOption(overrides: Partial<FlightOption> = {}): FlightOption {
  return {
    id: 'opt_1',
    kind: 'award',
    airline: 'Alaska Atmos',
    program: 'Alaska Mileage Plan',
    route: 'SFO → NRT',
    date: 'Jan 10',
    miles: 60000,
    taxes: 22,
    cpp: 2.9,
    tier: 'green',
    youHave: 200000,
    action: 'book-points',
    bookingUrl: 'https://alaska.example/book',
    ...overrides,
  }
}

function fixtureCashOption(overrides: Partial<FlightOption> = {}): FlightOption {
  return {
    id: 'opt_cash',
    kind: 'cash',
    airline: 'ANA',
    route: 'SFO → NRT',
    date: 'Jan 10',
    cashPrice: 840,
    tier: 'muted',
    action: 'book-cash',
    bookingUrl: 'https://kiwi.example/book',
    ...overrides,
  }
}

function fixtureResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    params: fixtureParams(),
    options: [],
    pick: fixtureOption(),
    cashOption: fixtureCashOption(),
    verdict: 'use-points',
    summary: { cheapestCash: 840, bestMiles: 60000, bestCpp: 2.9, saveVsCash: 412 },
    balances: fixtureBalances(),
    degraded: [],
    ...overrides,
  }
}

// ── buildVerdictSnapshot ─────────────────────────────────────────────────────

describe('buildVerdictSnapshot — the strict mint gate', () => {
  it('projects a full snapshot from a clean use-points result', () => {
    const snap = buildVerdictSnapshot(fixtureResult())
    expect(snap).not.toBeNull()
    expect(snap!.verdict).toBe('use-points')
    expect(snap!.pick.miles).toBe(60000)
    expect(snap!.pick.cpp).toBe(2.9)
    expect(snap!.pick.tier).toBe('green')
    expect(snap!.summary.cheapestCash).toBe(840)
    expect(snap!.summary.saveVsCash).toBe(412)
    expect(typeof snap!.asOf).toBe('string')
    expect(Number.isNaN(Date.parse(snap!.asOf))).toBe(false)
  })

  it('refuses ANY non-empty degraded[] — even a pay-cash result with awards dark', () => {
    const degradedUsePoints = fixtureResult({ degraded: ['cash'] })
    expect(buildVerdictSnapshot(degradedUsePoints)).toBeNull()

    // The tempting-but-forbidden case: verdict says pay-cash, but that verdict
    // itself might be wrong because awards never came back.
    const payCashAwardsDark = fixtureResult({
      verdict: 'pay-cash',
      pick: fixtureCashOption(),
      degraded: ['awards'],
    })
    expect(buildVerdictSnapshot(payCashAwardsDark)).toBeNull()
  })

  it("verdict:'none' → null", () => {
    expect(buildVerdictSnapshot(fixtureResult({ verdict: 'none', pick: undefined }))).toBeNull()
  })

  it('use-points with no pick → null', () => {
    expect(buildVerdictSnapshot(fixtureResult({ pick: undefined }))).toBeNull()
  })

  it('missing summary.cheapestCash → null', () => {
    expect(
      buildVerdictSnapshot(
        fixtureResult({ summary: { cheapestCash: undefined, bestMiles: 60000, bestCpp: 2.9, saveVsCash: 412 } }),
      ),
    ).toBeNull()
  })

  it('never re-derives the verdict/tier at boundary cpp values (2.5 / 3.0 / 1.5)', () => {
    // Engine says pay-cash at exactly the points threshold (2.5) — the mapper
    // must NOT flip it to use-points just because 2.5 looks borderline-good.
    const atThreshold = fixtureResult({
      verdict: 'pay-cash',
      pick: fixtureOption({ cpp: 2.5, tier: 'amber' }),
      summary: { cheapestCash: 840, bestMiles: undefined, bestCpp: undefined, saveVsCash: 0 },
    })
    const snap1 = buildVerdictSnapshot(atThreshold)
    expect(snap1!.verdict).toBe('pay-cash')
    expect(snap1!.pick.cpp).toBe(2.5)
    expect(snap1!.pick.tier).toBe('amber')

    const atGreen = fixtureResult({ pick: fixtureOption({ cpp: 3.0, tier: 'green' }) })
    expect(buildVerdictSnapshot(atGreen)!.pick.tier).toBe('green')

    const atAmberFloor = fixtureResult({
      verdict: 'pay-cash',
      pick: fixtureOption({ cpp: 1.5, tier: 'amber' }),
      summary: { cheapestCash: 840, bestMiles: undefined, bestCpp: undefined, saveVsCash: 0 },
    })
    expect(buildVerdictSnapshot(atAmberFloor)!.pick.tier).toBe('amber')
  })
})

describe('buildVerdictSnapshot — structural privacy (no spread, ever)', () => {
  it('the projected pick/cashOption keys never include youHave, action, or bookingUrl', () => {
    const snap = buildVerdictSnapshot(fixtureResult())!
    expect('youHave' in snap.pick).toBe(false)
    expect('action' in snap.pick).toBe(false)
    expect('bookingUrl' in snap.pick).toBe(false)
    expect('youHave' in snap.cashOption!).toBe(false)
    expect('action' in snap.cashOption!).toBe(false)
    expect('bookingUrl' in snap.cashOption!).toBe(false)
  })

  it('no balance data can reach the serialized snapshot', () => {
    const snap = buildVerdictSnapshot(fixtureResult({ balances: fixtureBalances() }))!
    expect(JSON.stringify(snap)).not.toContain(BALANCE_MARKER)
    expect(JSON.stringify(snap)).not.toContain('618314')
  })
})

// ── validateShareParams ──────────────────────────────────────────────────────

describe('validateShareParams — strict, never default-fills', () => {
  const valid = {
    from: 'SFO',
    to: 'NRT',
    depart: '2099-01-10',
    return: '2099-01-24',
    adults: '2',
  }

  it('accepts a clean round trip', () => {
    expect(validateShareParams(valid)).toEqual({
      from: 'SFO',
      to: 'NRT',
      depart: '2099-01-10',
      return: '2099-01-24',
      adults: 2,
    })
  })

  it('accepts a clean one-way', () => {
    const { return: _drop, ...oneWay } = valid
    void _drop
    expect(validateShareParams(oneWay)).toEqual({
      from: 'SFO',
      to: 'NRT',
      depart: '2099-01-10',
      adults: 2,
    })
  })

  it('rejects missing from/to instead of defaulting to SFO→LAX', () => {
    expect(validateShareParams({ ...valid, from: undefined })).toBeNull()
    expect(validateShareParams({ ...valid, to: undefined })).toBeNull()
  })

  it('rejects to === from', () => {
    expect(validateShareParams({ ...valid, to: 'SFO' })).toBeNull()
  })

  it('rejects non-IATA / unknown codes', () => {
    expect(validateShareParams({ ...valid, from: 'ZZZ' })).toBeNull()
    expect(validateShareParams({ ...valid, to: 'nope' })).toBeNull()
  })

  it('rejects malformed or past depart', () => {
    expect(validateShareParams({ ...valid, depart: 'not-a-date' })).toBeNull()
    expect(validateShareParams({ ...valid, depart: '2000-01-01' })).toBeNull()
  })

  it('rejects a return before depart', () => {
    expect(validateShareParams({ ...valid, return: '2099-01-01' })).toBeNull()
  })

  it('rejects an unknown cabin', () => {
    expect(validateShareParams({ ...valid, cabin: 'super-plus' })).toBeNull()
  })

  it('accepts a known cabin', () => {
    expect(validateShareParams({ ...valid, cabin: 'business' })?.cabin).toBe('business')
  })

  it('rejects adults > 9', () => {
    expect(validateShareParams({ ...valid, adults: '10' })).toBeNull()
  })

  it('never default-fills garbage into a plausible route', () => {
    const result = validateShareParams({ from: 'not-a-code', to: '' })
    expect(result).toBeNull()
  })
})

// ── newReceiptId / verdictContentHash ────────────────────────────────────────

describe('newReceiptId', () => {
  it('matches the 12-char base32 shape', () => {
    expect(newReceiptId()).toMatch(/^[a-z2-7]{12}$/)
  })

  it('two calls differ', () => {
    expect(newReceiptId()).not.toBe(newReceiptId())
  })
})

describe('verdictContentHash', () => {
  it('is independent of key insertion order', () => {
    const p1: SearchParams = { from: 'SFO', to: 'NRT', depart: '2099-01-10', adults: 1 }
    const p2: SearchParams = { adults: 1, depart: '2099-01-10', to: 'NRT', from: 'SFO' }
    expect(verdictContentHash(p1, '2099-01-01')).toBe(verdictContentHash(p2, '2099-01-01'))
  })

  it('differs between a one-way and its round-trip counterpart', () => {
    const oneWay: SearchParams = { from: 'SFO', to: 'NRT', depart: '2099-01-10', adults: 1 }
    const roundTrip: SearchParams = { ...oneWay, return: '2099-01-24' }
    expect(verdictContentHash(oneWay, '2099-01-01')).not.toBe(verdictContentHash(roundTrip, '2099-01-01'))
  })

  it('differs across UTC days for the same trip', () => {
    const p: SearchParams = { from: 'SFO', to: 'NRT', depart: '2099-01-10', adults: 1 }
    expect(verdictContentHash(p, '2099-01-01')).not.toBe(verdictContentHash(p, '2099-01-02'))
  })

  it('is stable across repeated calls', () => {
    const p: SearchParams = { from: 'SFO', to: 'NRT', depart: '2099-01-10', adults: 1 }
    expect(verdictContentHash(p, '2099-01-01')).toBe(verdictContentHash(p, '2099-01-01'))
  })
})

// ── Persistence — withDb fallback with no DB configured ─────────────────────

describe('createSharedVerdict / getSharedVerdict — no DB configured', () => {
  it('createSharedVerdict degrades to {ok:false} rather than throwing', async () => {
    const snap = buildVerdictSnapshot(fixtureResult())!
    const res = await createSharedVerdict({ params: fixtureParams(), snapshot: snap, createdBy: null })
    expect(res.ok).toBe(false)
  })

  it('getSharedVerdict degrades to null rather than throwing', async () => {
    await expect(getSharedVerdict('abcdefghijkl')).resolves.toBeNull()
  })
})

// ── Orchestration — gate → rate-limit → validate → mint ─────────────────────

describe('shareVerdict() — gating and limits', () => {
  beforeEach(() => {
    _resetRateLimitForTest()
    vi.unstubAllEnvs()
  })

  it("flag off → 'disabled', before touching anything else", async () => {
    vi.stubEnv('HOP_ENABLE_SHARE_RECEIPTS', '')
    const res = await shareVerdict({
      raw: { from: 'SFO', to: 'NRT', depart: '2099-01-10' },
      rateLimitKey: 'test-key-disabled',
      createdBy: null,
    })
    expect(res).toEqual({ ok: false, reason: 'disabled' })
  })

  it("rate-limit exhaustion → 'rate-limited'", async () => {
    vi.stubEnv('HOP_ENABLE_SHARE_RECEIPTS', '1')
    const raw = { from: 'SFO', to: 'NRT', depart: '2099-01-10' }
    const key = 'test-key-rate-limited'
    // Burst through the bucket (capacity 5) with invalid params so we never
    // reach the engine — only the gate/rate-limit path is under test here.
    for (let i = 0; i < 5; i++) {
      await shareVerdict({ raw, rateLimitKey: key, createdBy: null })
    }
    const limited = await shareVerdict({ raw, rateLimitKey: key, createdBy: null })
    expect(limited).toEqual({ ok: false, reason: 'rate-limited' })
  })

  it("invalid params (past the rate limit) → 'invalid'", async () => {
    vi.stubEnv('HOP_ENABLE_SHARE_RECEIPTS', '1')
    const res = await shareVerdict({
      raw: { from: 'SFO', to: 'SFO', depart: '2099-01-10' },
      rateLimitKey: 'test-key-invalid',
      createdBy: null,
    })
    expect(res).toEqual({ ok: false, reason: 'invalid' })
  })
})
