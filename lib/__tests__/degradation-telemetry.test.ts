import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getDegradationWindowCounts,
  iataRouteCode,
  pruneDegradationEvents,
  recordDegradation,
  sanitizeReason,
} from '@/lib/degradation-telemetry'
import { captureServerEvent } from '@/lib/posthog-server'
import { assembleSearch } from '@/lib/search'
import { searchCash } from '@/lib/duffel'
import { searchAwards } from '@/lib/seatsaero'

// Write hygiene for the degradation seam (plan §6 "Degradation write
// hygiene"): gated no-op when the flag is off; the route column only ever
// persists a validated AAA-BBB IATA pair (junk → null); the reason column only
// ever persists a sanitized ≤120-char printable string (garbage → null); the
// mock path never records; and the lib/search.ts call site fires exactly when
// degraded[] is non-empty on a LIVE run — into Neon AND PostHog.

type Row = Record<string, unknown>
let fakeDb: unknown = null
let inserts: Row[] = []
let selectData: Row[] | null = []
let deleteError: { message: string } | null = null

const makeDb = () => ({
  from: () => ({
    insert: (rowsIn: Row[]) => {
      inserts.push(...rowsIn)
      return Promise.resolve({ error: null })
    },
    select: () => ({
      gte: () => Promise.resolve({ data: selectData, error: null }),
    }),
    delete: () => ({
      lt: () => Promise.resolve({ error: deleteError }),
    }),
  }),
})

vi.mock('@/lib/supabase-helpers', () => ({
  withDb: async <T>(fallback: T, fn: (db: unknown) => Promise<T>): Promise<T> => {
    if (!fakeDb) return fallback
    try {
      return await fn(fakeDb)
    } catch {
      return fallback
    }
  },
}))

// Upstream clients mocked so assembleSearch's degraded[] path is exercised
// live and keylessly.
vi.mock('@/lib/duffel', () => ({ searchCash: vi.fn() }))
vi.mock('@/lib/seatsaero', () => ({ searchAwards: vi.fn() }))
// PostHog capture mocked so the lib/search.ts emit is observable without a
// network; the REAL module is exercised via vi.importActual further down.
vi.mock('@/lib/posthog-server', () => ({ captureServerEvent: vi.fn() }))

const ORIGINAL_ENV = { ...process.env }

// Give the internal fire-and-forget write a tick to run.
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  fakeDb = makeDb()
  inserts = []
  selectData = []
  deleteError = null
  process.env.HOP_ENABLE_SELF_IMPROVE = '1'
  delete process.env.MOCK
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.clearAllMocks()
})

describe('recordDegradation() — gated, fire-and-forget, validated', () => {
  it('flag off → complete no-op (nothing touches the db)', async () => {
    delete process.env.HOP_ENABLE_SELF_IMPROVE
    recordDegradation(['cash'], { from: 'SFO', to: 'LAX' })
    await flush()
    expect(inserts).toHaveLength(0)
  })

  it('["cash"] with route SFO→LAX persists source + "SFO-LAX" (reason null)', async () => {
    recordDegradation(['cash'], { from: 'SFO', to: 'LAX' })
    await flush()
    expect(inserts).toEqual([{ source: 'cash', route: 'SFO-LAX', reason: null }])
  })

  it('a junk route code persists a NULL route — never the string', async () => {
    recordDegradation(['cash'], { from: '<script>', to: 'LAX' })
    await flush()
    expect(inserts).toEqual([{ source: 'cash', route: null, reason: null }])
  })

  it('lowercase / non-IATA codes are rejected to null (strict, no coercion)', async () => {
    recordDegradation(['awards'], { from: 'sfo', to: 'LAX' })
    await flush()
    expect(inserts).toEqual([{ source: 'awards', route: null, reason: null }])
  })

  it('a {source, reason} entry persists the sanitized reason', async () => {
    recordDegradation([{ source: 'cash', reason: 'Duffel responded 429' }], {
      from: 'SFO',
      to: 'LAX',
    })
    await flush()
    expect(inserts).toEqual([
      { source: 'cash', route: 'SFO-LAX', reason: 'Duffel responded 429' },
    ])
  })

  it('mixed string + object entries both persist (backward compat)', async () => {
    recordDegradation(['cash', { source: 'awards', reason: 'seats.aero timed out' }])
    await flush()
    expect(inserts).toEqual([
      { source: 'cash', route: null, reason: null },
      { source: 'awards', route: null, reason: 'seats.aero timed out' },
    ])
  })

  it('a garbage reason persists NULL — never the raw string', async () => {
    recordDegradation([{ source: 'cash', reason: '\x00\x07\n \t\x1b' }])
    await flush()
    expect(inserts).toEqual([{ source: 'cash', route: null, reason: null }])
  })

  it('an overlong reason is clamped to 120 chars on write', async () => {
    recordDegradation([{ source: 'cash', reason: 'x'.repeat(500) }])
    await flush()
    expect(inserts).toEqual([{ source: 'cash', route: null, reason: 'x'.repeat(120) }])
  })

  it('junk sources are dropped; an all-junk batch writes nothing', async () => {
    recordDegradation(['CASH!', '', 'x'.repeat(64)], { from: 'SFO', to: 'LAX' })
    await flush()
    expect(inserts).toHaveLength(0)
  })

  it('never throws, even when the db explodes mid-insert', async () => {
    fakeDb = {
      from: () => ({
        insert: () => Promise.reject(new Error('boom')),
      }),
    }
    expect(() => recordDegradation(['cash'])).not.toThrow()
    await flush()
  })
})

describe('lib/search.ts call site — live-only, after degraded[] is final', () => {
  const params = { from: 'SFO', to: 'LAX', depart: '2026-08-01', adults: 1 }

  it('a live run with failed upstreams records one event per degraded source, WITH its reason', async () => {
    vi.mocked(searchCash).mockResolvedValue({ ok: false, reason: 'Duffel responded 429' })
    vi.mocked(searchAwards).mockResolvedValue({ ok: false, reason: 'seats.aero timed out' })

    const result = await assembleSearch(params, [])
    await flush()

    expect(result.degraded).toEqual(['cash', 'awards'])
    expect(inserts).toEqual([
      { source: 'cash', route: 'SFO-LAX', reason: 'Duffel responded 429' },
      { source: 'awards', route: 'SFO-LAX', reason: 'seats.aero timed out' },
    ])
  })

  it('emits ONE PostHog "search_degraded" event with sources, sanitized reasons, and route', async () => {
    vi.mocked(searchCash).mockResolvedValue({ ok: false, reason: 'Duffel responded 429' })
    vi.mocked(searchAwards).mockResolvedValue({ ok: true, data: [] })

    await assembleSearch(params, [])
    await flush()

    expect(vi.mocked(captureServerEvent)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(captureServerEvent)).toHaveBeenCalledWith('search_degraded', {
      sources: ['cash'],
      reasons: { cash: 'Duffel responded 429' },
      route: 'SFO-LAX',
    })
  })

  it('a clean live run records nothing (degraded[] empty)', async () => {
    vi.mocked(searchCash).mockResolvedValue({ ok: true, data: [] })
    vi.mocked(searchAwards).mockResolvedValue({ ok: true, data: [] })

    const result = await assembleSearch(params, [])
    await flush()

    expect(result.degraded).toEqual([])
    expect(inserts).toHaveLength(0)
    expect(vi.mocked(captureServerEvent)).not.toHaveBeenCalled()
  })

  it('the mock path NEVER records (lib/search.ts:57 guard)', async () => {
    process.env.MOCK = '1'

    const result = await assembleSearch(params, [])
    await flush()

    expect(result.degraded).toEqual([])
    expect(inserts).toHaveLength(0)
    expect(vi.mocked(captureServerEvent)).not.toHaveBeenCalled()
    // The mocked upstreams were never even called on the mock path.
    expect(vi.mocked(searchCash)).not.toHaveBeenCalled()
    expect(vi.mocked(searchAwards)).not.toHaveBeenCalled()
  })
})

describe('sanitizeReason() — printable, collapsed, clamped, or null', () => {
  it('passes a clean upstream reason through unchanged', () => {
    expect(sanitizeReason('Duffel responded 429')).toBe('Duffel responded 429')
  })

  it('non-strings → null (garbage in, null out)', () => {
    expect(sanitizeReason(undefined)).toBeNull()
    expect(sanitizeReason(null)).toBeNull()
    expect(sanitizeReason(42)).toBeNull()
    expect(sanitizeReason({ msg: 'boom' })).toBeNull()
  })

  it('empty / whitespace-only / control-only strings → null', () => {
    expect(sanitizeReason('')).toBeNull()
    expect(sanitizeReason('   \n\t ')).toBeNull()
    expect(sanitizeReason('\x00\x07\x1b')).toBeNull()
  })

  it('strips non-printable chars and collapses whitespace', () => {
    expect(sanitizeReason('Duffel\nrequest\t\ttimed\x00out')).toBe('Duffel request timed out')
    expect(sanitizeReason('  spaced   out  ')).toBe('spaced out')
  })

  it('clamps to 120 chars with no trailing whitespace', () => {
    const clamped = sanitizeReason(`${'a'.repeat(119)} ${'b'.repeat(50)}`)
    expect(clamped).toBe('a'.repeat(119))
    expect(sanitizeReason('x'.repeat(121))).toHaveLength(120)
  })
})

describe('iataRouteCode() — the one route validator', () => {
  it('validated pair → "AAA-BBB"; anything else → null', () => {
    expect(iataRouteCode({ from: 'SFO', to: 'LAX' })).toBe('SFO-LAX')
    expect(iataRouteCode({ from: 'sfo', to: 'LAX' })).toBeNull()
    expect(iataRouteCode({ from: '<script>', to: 'LAX' })).toBeNull()
    expect(iataRouteCode(undefined)).toBeNull()
  })
})

describe('lib/posthog-server.ts (real module) — gated, fire-and-forget', () => {
  const realPosthog = async () =>
    vi.importActual<typeof import('@/lib/posthog-server')>('@/lib/posthog-server')

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('no key → complete no-op (fetch never called)', async () => {
    delete process.env.POSTHOG_KEY
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const { captureServerEvent: capture } = await realPosthog()
    capture('search_degraded', { sources: ['cash'] })
    await flush()

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('key present → POSTs the event to <host>/capture/ with the key in the body', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test'
    delete process.env.POSTHOG_KEY
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchSpy)

    const { captureServerEvent: capture } = await realPosthog()
    capture('search_degraded', { sources: ['cash'], reasons: { cash: 'down' }, route: 'SFO-LAX' })
    await flush()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toBe('https://us.i.posthog.com/capture/')
    const body = JSON.parse(init.body)
    expect(body.api_key).toBe('phc_test')
    expect(body.event).toBe('search_degraded')
    expect(body.properties).toMatchObject({
      sources: ['cash'],
      reasons: { cash: 'down' },
      route: 'SFO-LAX',
      $process_person_profile: false,
    })
  })

  it('never throws or rejects, even when fetch explodes', async () => {
    process.env.POSTHOG_KEY = 'phc_test'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const { captureServerEvent: capture } = await realPosthog()
    expect(() => capture('search_degraded', {})).not.toThrow()
    await flush()
  })
})

describe('getDegradationWindowCounts() — D2 input buckets', () => {
  const NOW = new Date('2026-07-02T12:00:00.000Z')
  const HOUR_MS = 60 * 60 * 1000
  const DAY_MS = 24 * HOUR_MS

  it('flag off → null (unknown)', async () => {
    delete process.env.HOP_ENABLE_SELF_IMPROVE
    await expect(getDegradationWindowCounts(NOW)).resolves.toBeNull()
  })

  it('db unavailable → null, never an empty all-clear', async () => {
    fakeDb = null
    await expect(getDegradationWindowCounts(NOW)).resolves.toBeNull()
  })

  it('buckets last-24h counts and prior-week daily means per source', async () => {
    selectData = [
      // Two cash events inside 24h.
      { source: 'cash', created_at: new Date(NOW.getTime() - 1 * HOUR_MS).toISOString() },
      { source: 'cash', created_at: new Date(NOW.getTime() - 23 * HOUR_MS).toISOString() },
      // Seven awards events across the prior week → daily mean 1.
      ...Array.from({ length: 7 }, (_, i) => ({
        source: 'awards',
        created_at: new Date(NOW.getTime() - (2 + i) * DAY_MS).toISOString(),
      })),
    ]
    const counts = await getDegradationWindowCounts(NOW)
    expect(counts).toEqual({
      last24h: { cash: 2 },
      priorWeekDailyMean: { awards: 1 },
    })
  })
})

describe('pruneDegradationEvents()', () => {
  it('true on success, false when the delete degrades (prune skipped)', async () => {
    await expect(pruneDegradationEvents()).resolves.toBe(true)
    deleteError = { message: 'boom' }
    await expect(pruneDegradationEvents()).resolves.toBe(false)
  })
})
