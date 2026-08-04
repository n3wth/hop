import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the withDb seam so the outbox's reserve/mark/release contract is
// testable without a real Postgres — the duplicate-detection path (the whole
// point of this ledger) is exercised via the same upsert+ignoreDuplicates
// shape lib/support-tickets.ts already uses.
vi.mock('@/lib/supabase-helpers', () => ({
  withDb: vi.fn(async (fallback: unknown) => fallback),
}))

import { withDb } from '@/lib/supabase-helpers'
import { reserve, markSent, release } from '@/lib/notification-outbox'

const mockWithDb = vi.mocked(withDb)

beforeEach(() => {
  vi.clearAllMocks()
  mockWithDb.mockImplementation(async (fallback: unknown) => fallback)
})

// A minimal fake of the from().upsert().select().maybeSingle() chain, and
// from().update().eq() / from().delete().eq() chains. `upsertResult` controls
// what maybeSingle() resolves to (simulating a fresh insert vs. a conflict
// that ignoreDuplicates turned into an empty RETURNING).
function fakeDb(opts: {
  upsertResult?: { data: unknown; error: unknown }
  updateResult?: { error: unknown }
  deleteResult?: { error: unknown }
} = {}) {
  const upsertResult = opts.upsertResult ?? { data: { id: 'row-1' }, error: null }
  const updateResult = opts.updateResult ?? { error: null }
  const deleteResult = opts.deleteResult ?? { error: null }

  const upsert = vi.fn(() => ({
    select: vi.fn(() => ({
      maybeSingle: vi.fn(async () => upsertResult),
    })),
  }))
  const update = vi.fn(() => ({
    eq: vi.fn(async () => updateResult),
  }))
  const del = vi.fn(() => ({
    eq: vi.fn(async () => deleteResult),
  }))
  const from = vi.fn(() => ({ upsert, update, delete: del }))
  return { from, upsert, update, delete: del }
}

describe('reserve', () => {
  it('returns {ok:false, reason:"invalid"} on missing input, without touching the db', async () => {
    await expect(reserve({ userId: '', kind: 'x', dedupeKey: 'y' })).resolves.toEqual({
      ok: false,
      reason: 'invalid',
    })
    expect(mockWithDb).not.toHaveBeenCalled()
  })

  it('upserts on (user_id, kind, dedupe_key) with ignoreDuplicates and returns {ok:true, id} on a fresh reservation', async () => {
    const db = fakeDb({ upsertResult: { data: { id: 'row-1' }, error: null } })
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)(db))

    const result = await reserve({
      userId: 'u1',
      kind: 'standing_order_alert',
      dedupeKey: 'fp-1',
      payload: { standingOrderId: 'so-1' },
    })

    expect(result).toEqual({ ok: true, id: 'row-1' })
    expect(db.from).toHaveBeenCalledWith('hop_notification_outbox')
    expect(db.upsert).toHaveBeenCalledWith(
      {
        user_id: 'u1',
        kind: 'standing_order_alert',
        dedupe_key: 'fp-1',
        status: 'reserved',
        payload: { standingOrderId: 'so-1' },
      },
      { onConflict: 'user_id,kind,dedupe_key', ignoreDuplicates: true },
    )
  })

  it('returns {ok:false, reason:"duplicate"} when a conflicting row already exists (empty RETURNING)', async () => {
    const db = fakeDb({ upsertResult: { data: null, error: null } })
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)(db))

    const result = await reserve({ userId: 'u1', kind: 'standing_order_alert', dedupeKey: 'fp-1' })
    expect(result).toEqual({ ok: false, reason: 'duplicate' })
  })

  it('returns {ok:false, reason:"db-error"} on a query error', async () => {
    const db = fakeDb({ upsertResult: { data: null, error: new Error('boom') } })
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)(db))

    const result = await reserve({ userId: 'u1', kind: 'standing_order_alert', dedupeKey: 'fp-1' })
    expect(result).toEqual({ ok: false, reason: 'db-error' })
  })

  it('falls back to {ok:false, reason:"db-error"} when withDb itself degrades (unconfigured db)', async () => {
    // Default mock: withDb resolves straight to the fallback.
    const result = await reserve({ userId: 'u1', kind: 'standing_order_alert', dedupeKey: 'fp-1' })
    expect(result).toEqual({ ok: false, reason: 'db-error' })
  })
})

describe('markSent', () => {
  it('updates status to sent and returns true on success', async () => {
    const db = fakeDb({ updateResult: { error: null } })
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)(db))

    await expect(markSent('row-1')).resolves.toBe(true)
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }))
  })

  it('returns false without touching the db for an empty id', async () => {
    await expect(markSent('')).resolves.toBe(false)
    expect(mockWithDb).not.toHaveBeenCalled()
  })

  it('returns false on a db error', async () => {
    const db = fakeDb({ updateResult: { error: new Error('boom') } })
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)(db))
    await expect(markSent('row-1')).resolves.toBe(false)
  })
})

describe('release', () => {
  it('deletes the row (not a status flip) so a re-reserve of the same key can succeed', async () => {
    const db = fakeDb({ deleteResult: { error: null } })
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)(db))

    await expect(release('row-1')).resolves.toBe(true)
    expect(db.delete).toHaveBeenCalled()
  })

  it('returns false without touching the db for an empty id', async () => {
    await expect(release('')).resolves.toBe(false)
    expect(mockWithDb).not.toHaveBeenCalled()
  })
})
