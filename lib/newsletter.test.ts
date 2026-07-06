import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the withDb seam so every persistence path (fresh insert vs. dedup
// no-op, confirm vs. already-confirmed, digest-guard filtering) is testable
// without a real Postgres — same approach as
// lib/__tests__/notification-outbox.test.ts.
vi.mock('@/lib/supabase-helpers', () => ({
  withDb: vi.fn(async (fallback: unknown) => fallback),
}))

import { withDb } from '@/lib/supabase-helpers'
import {
  createNewsletterSignup,
  confirmNewsletterSubscriber,
  unsubscribeNewsletter,
  listDueDigestSubscribers,
  markDigestSent,
  normalizeEmail,
} from '@/lib/newsletter'

const mockWithDb = vi.mocked(withDb)

beforeEach(() => {
  vi.clearAllMocks()
  mockWithDb.mockImplementation(async (fallback: unknown) => fallback)
})

describe('normalizeEmail (re-exported from lib/escalation)', () => {
  it('validates and trims', () => {
    expect(normalizeEmail('  you@example.com ')).toBe('you@example.com')
    expect(normalizeEmail('not-an-email')).toBeNull()
  })
})

describe('createNewsletterSignup', () => {
  it('returns {ok:false} for an invalid email, without touching the db', async () => {
    await expect(createNewsletterSignup({ email: 'nope' })).resolves.toEqual({ ok: false })
    expect(mockWithDb).not.toHaveBeenCalled()
  })

  it('lowercases the email before storing (case-insensitive dedup)', async () => {
    const upsert = vi.fn(() => ({ select: () => ({ maybeSingle: async () => ({ data: { id: 'row-1' }, error: null }) }) }))
    const from = vi.fn(() => ({ upsert }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    const result = await createNewsletterSignup({ email: 'YOU@Example.com' })
    expect(result).toEqual({ ok: true, isNew: true, confirmToken: expect.any(String) })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'you@example.com' }),
      expect.objectContaining({ onConflict: 'email', ignoreDuplicates: true }),
    )
  })

  it('returns {ok:true, isNew:false} on a resubmit (empty RETURNING from ignoreDuplicates)', async () => {
    const from = vi.fn(() => ({
      upsert: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    await expect(createNewsletterSignup({ email: 'you@example.com' })).resolves.toEqual({
      ok: true,
      isNew: false,
    })
  })

  it('returns {ok:false} on a query error', async () => {
    const from = vi.fn(() => ({
      upsert: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: new Error('boom') }) }) }),
    }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    await expect(createNewsletterSignup({ email: 'you@example.com' })).resolves.toEqual({ ok: false })
  })

  it('falls back to {ok:false} when withDb itself degrades (unconfigured db)', async () => {
    await expect(createNewsletterSignup({ email: 'you@example.com' })).resolves.toEqual({ ok: false })
  })
})

describe('confirmNewsletterSubscriber', () => {
  it('returns false for an empty token, without touching the db', async () => {
    await expect(confirmNewsletterSubscriber('')).resolves.toBe(false)
    expect(mockWithDb).not.toHaveBeenCalled()
  })

  it('returns false for an unknown token', async () => {
    const from = vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    await expect(confirmNewsletterSubscriber('bad-token')).resolves.toBe(false)
  })

  it('flips confirmed_at on a fresh confirm, leaving the token in place (a second click must still resolve)', async () => {
    const update = vi.fn(() => ({ eq: async () => ({ error: null }) }))
    const from = vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'row-1', confirmed_at: null }, error: null }) }) }),
      update,
    }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    await expect(confirmNewsletterSubscriber('good-token')).resolves.toBe(true)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ confirmed_at: expect.any(String) }))
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ confirm_token: null }))
  })

  it('a second click on the same still-valid token resolves the row again (no-op success, not a broken-link error)', async () => {
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { id: 'row-1', confirmed_at: '2026-01-01T00:00:00Z' }, error: null }) }),
      }),
    }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    await expect(confirmNewsletterSubscriber('good-token')).resolves.toBe(true)
  })

  it('is idempotent — a second confirm on an already-confirmed row is a no-op success', async () => {
    const update = vi.fn()
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { id: 'row-1', confirmed_at: '2026-01-01T00:00:00Z' }, error: null }) }),
      }),
      update,
    }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    await expect(confirmNewsletterSubscriber('good-token')).resolves.toBe(true)
    expect(update).not.toHaveBeenCalled()
  })
})

describe('unsubscribeNewsletter', () => {
  it('returns false for an empty token, without touching the db', async () => {
    await expect(unsubscribeNewsletter('')).resolves.toBe(false)
    expect(mockWithDb).not.toHaveBeenCalled()
  })

  it('stamps unsubscribed_at and returns true regardless of match (silent about validity)', async () => {
    const update = vi.fn(() => ({ eq: async () => ({ error: null }) }))
    const from = vi.fn(() => ({ update }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    await expect(unsubscribeNewsletter('any-token')).resolves.toBe(true)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ unsubscribed_at: expect.any(String) }))
  })
})

describe('listDueDigestSubscribers', () => {
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000

  it('returns null (unknown) on a db error, never []', async () => {
    const from = vi.fn(() => ({ select: () => ({ is: async () => ({ data: null, error: new Error('boom') }) }) }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    await expect(listDueDigestSubscribers(WEEK_MS)).resolves.toBeNull()
  })

  it('excludes unconfirmed rows and rows missing an unsubscribe token', async () => {
    const rows = [
      { id: '1', user_id: null, email: 'unconfirmed@example.com', unsubscribe_token: 'tok-1', confirmed_at: null, unsubscribed_at: null, last_digest_sent_at: null },
      { id: '2', user_id: null, email: 'no-token@example.com', unsubscribe_token: null, confirmed_at: '2026-01-01T00:00:00Z', unsubscribed_at: null, last_digest_sent_at: null },
    ]
    const from = vi.fn(() => ({ select: () => ({ is: async () => ({ data: rows, error: null }) }) }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    await expect(listDueDigestSubscribers(WEEK_MS)).resolves.toEqual([])
  })

  it('includes a never-sent confirmed subscriber and excludes one sent within the guard window', async () => {
    const now = Date.now()
    const rows = [
      { id: 'never-sent', user_id: 'u1', email: 'a@example.com', unsubscribe_token: 'tok-a', confirmed_at: '2026-01-01T00:00:00Z', unsubscribed_at: null, last_digest_sent_at: null },
      { id: 'sent-yesterday', user_id: null, email: 'b@example.com', unsubscribe_token: 'tok-b', confirmed_at: '2026-01-01T00:00:00Z', unsubscribed_at: null, last_digest_sent_at: new Date(now - 24 * 60 * 60 * 1000).toISOString() },
      { id: 'sent-9-days-ago', user_id: null, email: 'c@example.com', unsubscribe_token: 'tok-c', confirmed_at: '2026-01-01T00:00:00Z', unsubscribed_at: null, last_digest_sent_at: new Date(now - 9 * 24 * 60 * 60 * 1000).toISOString() },
    ]
    const from = vi.fn(() => ({ select: () => ({ is: async () => ({ data: rows, error: null }) }) }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    const due = await listDueDigestSubscribers(WEEK_MS)
    expect(due?.map((s) => s.id).sort()).toEqual(['never-sent', 'sent-9-days-ago'])
  })
})

describe('markDigestSent', () => {
  it('returns false without touching the db for an empty id', async () => {
    await expect(markDigestSent('')).resolves.toBe(false)
    expect(mockWithDb).not.toHaveBeenCalled()
  })

  it('stamps last_digest_sent_at and returns true on success', async () => {
    const update = vi.fn(() => ({ eq: async () => ({ error: null }) }))
    const from = vi.fn(() => ({ update }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    await expect(markDigestSent('row-1')).resolves.toBe(true)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ last_digest_sent_at: expect.any(String) }))
  })

  it('returns false on a db error', async () => {
    const from = vi.fn(() => ({ update: () => ({ eq: async () => ({ error: new Error('boom') }) }) }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    await expect(markDigestSent('row-1')).resolves.toBe(false)
  })
})
