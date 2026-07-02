import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getDegradationWindowCounts,
  pruneDegradationEvents,
  recordDegradation,
} from '@/lib/degradation-telemetry'
import { assembleSearch } from '@/lib/search'
import { searchCash } from '@/lib/duffel'
import { searchAwards } from '@/lib/seatsaero'

// Write hygiene for the degradation seam (plan §6 "Degradation write
// hygiene"): gated no-op when the flag is off; the route column only ever
// persists a validated AAA-BBB IATA pair (junk → null); the mock path never
// records; and the lib/search.ts call site fires exactly when degraded[] is
// non-empty on a LIVE run.

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

  it('["cash"] with route SFO→LAX persists source + "SFO-LAX"', async () => {
    recordDegradation(['cash'], { from: 'SFO', to: 'LAX' })
    await flush()
    expect(inserts).toEqual([{ source: 'cash', route: 'SFO-LAX' }])
  })

  it('a junk route code persists a NULL route — never the string', async () => {
    recordDegradation(['cash'], { from: '<script>', to: 'LAX' })
    await flush()
    expect(inserts).toEqual([{ source: 'cash', route: null }])
  })

  it('lowercase / non-IATA codes are rejected to null (strict, no coercion)', async () => {
    recordDegradation(['awards'], { from: 'sfo', to: 'LAX' })
    await flush()
    expect(inserts).toEqual([{ source: 'awards', route: null }])
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

  it('a live run with failed upstreams records one event per degraded source', async () => {
    vi.mocked(searchCash).mockResolvedValue({ ok: false, reason: 'down' })
    vi.mocked(searchAwards).mockResolvedValue({ ok: false, reason: 'down' })

    const result = await assembleSearch(params, [])
    await flush()

    expect(result.degraded).toEqual(['cash', 'awards'])
    expect(inserts).toEqual([
      { source: 'cash', route: 'SFO-LAX' },
      { source: 'awards', route: 'SFO-LAX' },
    ])
  })

  it('a clean live run records nothing (degraded[] empty)', async () => {
    vi.mocked(searchCash).mockResolvedValue({ ok: true, data: [] })
    vi.mocked(searchAwards).mockResolvedValue({ ok: true, data: [] })

    const result = await assembleSearch(params, [])
    await flush()

    expect(result.degraded).toEqual([])
    expect(inserts).toHaveLength(0)
  })

  it('the mock path NEVER records (lib/search.ts:57 guard)', async () => {
    process.env.MOCK = '1'

    const result = await assembleSearch(params, [])
    await flush()

    expect(result.degraded).toEqual([])
    expect(inserts).toHaveLength(0)
    // The mocked upstreams were never even called on the mock path.
    expect(vi.mocked(searchCash)).not.toHaveBeenCalled()
    expect(vi.mocked(searchAwards)).not.toHaveBeenCalled()
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
