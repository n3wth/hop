import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase-helpers', () => ({
  withDb: vi.fn(async (fallback: unknown) => fallback),
}))

import { withDb } from '@/lib/supabase-helpers'
import { recordSuppression, isSuppressed } from '@/lib/email-suppressions'

const mockWithDb = vi.mocked(withDb)

beforeEach(() => {
  vi.clearAllMocks()
  mockWithDb.mockImplementation(async (fallback: unknown) => fallback)
})

describe('recordSuppression', () => {
  it('upserts on the email column (idempotent — a redelivered webhook is a no-op change)', async () => {
    const upsert = vi.fn(async () => ({ error: null }))
    const from = vi.fn(() => ({ upsert }))
    mockWithDb.mockImplementation(async (_fallback, fn) =>
      (fn as (db: unknown) => Promise<unknown>)({ from }),
    )

    await recordSuppression('bounced@example.com', 'bounced')

    expect(from).toHaveBeenCalledWith('hop_email_suppressions')
    expect(upsert).toHaveBeenCalledWith(
      { email: 'bounced@example.com', reason: 'bounced' },
      { onConflict: 'email' },
    )
  })

  it('calling it twice for the same address issues two idempotent upserts, not two rows', async () => {
    const upsert = vi.fn(async () => ({ error: null }))
    mockWithDb.mockImplementation(async (_fallback, fn) =>
      (fn as (db: unknown) => Promise<unknown>)({ from: () => ({ upsert }) }),
    )

    await recordSuppression('complained@example.com', 'complained')
    await recordSuppression('complained@example.com', 'complained')

    expect(upsert).toHaveBeenCalledTimes(2)
    expect(upsert).toHaveBeenNthCalledWith(
      1,
      { email: 'complained@example.com', reason: 'complained' },
      { onConflict: 'email' },
    )
    expect(upsert).toHaveBeenNthCalledWith(
      2,
      { email: 'complained@example.com', reason: 'complained' },
      { onConflict: 'email' },
    )
  })

  it('drops an unparseable email without touching the db', async () => {
    const upsert = vi.fn(async () => ({ error: null }))
    mockWithDb.mockImplementation(async (_fallback, fn) =>
      (fn as (db: unknown) => Promise<unknown>)({ from: () => ({ upsert }) }),
    )
    await recordSuppression('not-an-email', 'bounced')
    expect(upsert).not.toHaveBeenCalled()
  })

  it('never throws, even when the db write errors', async () => {
    mockWithDb.mockImplementation(async (_fallback, fn) =>
      (fn as (db: unknown) => Promise<unknown>)({
        from: () => ({ upsert: async () => ({ error: new Error('boom') }) }),
      }),
    )
    await expect(recordSuppression('a@example.com', 'bounced')).resolves.toBeUndefined()
  })
})

describe('isSuppressed — fails OPEN', () => {
  it('returns true when the address is on the list', async () => {
    mockWithDb.mockImplementation(async (_fallback, fn) =>
      (fn as (db: unknown) => Promise<unknown>)({
        from: () => ({
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { email: 'a@example.com' }, error: null }) }),
          }),
        }),
      }),
    )
    expect(await isSuppressed('a@example.com')).toBe(true)
  })

  it('returns false when the address is not on the list', async () => {
    mockWithDb.mockImplementation(async (_fallback, fn) =>
      (fn as (db: unknown) => Promise<unknown>)({
        from: () => ({
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        }),
      }),
    )
    expect(await isSuppressed('clean@example.com')).toBe(false)
  })

  it('fails OPEN (false) on a db read error — never blocks a send on a DB hiccup', async () => {
    mockWithDb.mockImplementation(async (_fallback, fn) =>
      (fn as (db: unknown) => Promise<unknown>)({
        from: () => ({
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: new Error('boom') }) }) }),
        }),
      }),
    )
    expect(await isSuppressed('a@example.com')).toBe(false)
  })

  it('fails OPEN (false) when the db is unconfigured (withDb falls back)', async () => {
    // Default mock: withDb resolves straight to the fallback (no client).
    expect(await isSuppressed('a@example.com')).toBe(false)
  })

  it('returns false without touching the db for an unparseable email', async () => {
    const from = vi.fn()
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))
    expect(await isSuppressed('not-an-email')).toBe(false)
    expect(from).not.toHaveBeenCalled()
  })
})
