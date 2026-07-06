import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

// Mock the withDb seam so every persistence path (fresh insert vs. dedup
// no-op, confirm vs. already-confirmed, digest-guard filtering) is testable
// without a real Postgres — same approach as
// lib/__tests__/notification-outbox.test.ts.
vi.mock('@/lib/supabase-helpers', () => ({
  withDb: vi.fn(async (fallback: unknown) => fallback),
}))

import { withDb } from '@/lib/supabase-helpers'
import { hashToken } from '@/lib/api-tokens'
import {
  createNewsletterSignup,
  confirmNewsletterSubscriber,
  unsubscribeNewsletter,
  listDueDigestSubscribers,
  markDigestSent,
  normalizeEmail,
  deriveUnsubscribeToken,
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

describe('deriveUnsubscribeToken', () => {
  it('is deterministic for the same email', () => {
    expect(deriveUnsubscribeToken('you@example.com')).toBe(deriveUnsubscribeToken('you@example.com'))
  })

  it('differs across emails', () => {
    expect(deriveUnsubscribeToken('you@example.com')).not.toBe(deriveUnsubscribeToken('them@example.com'))
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

  it('SECURITY: persists a HASH of both tokens, never the plaintext', async () => {
    interface InsertedRow {
      confirm_token: string
      unsubscribe_token: string
    }
    const upsert = vi.fn((_row: InsertedRow) => ({
      select: () => ({ maybeSingle: async () => ({ data: { id: 'row-1' }, error: null }) }),
    }))
    const from = vi.fn(() => ({ upsert }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    const result = await createNewsletterSignup({ email: 'you@example.com' })
    expect(result.ok).toBe(true)
    if (!result.ok || !result.isNew) throw new Error('expected a fresh signup')

    const insertedRow = upsert.mock.calls[0][0]

    // The row's confirm_token is the HASH of the plaintext handed back to the
    // caller (for the confirmation email link) — never the plaintext itself.
    expect(insertedRow.confirm_token).toBe(hashToken(result.confirmToken))
    expect(insertedRow.confirm_token).not.toBe(result.confirmToken)

    // unsubscribe_token is the hash of the email-derived plaintext — also
    // never the plaintext, and reproducible later from just the email.
    const expectedUnsubscribePlaintext = deriveUnsubscribeToken('you@example.com')
    expect(insertedRow.unsubscribe_token).toBe(hashToken(expectedUnsubscribePlaintext))
    expect(insertedRow.unsubscribe_token).not.toBe(expectedUnsubscribePlaintext)
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

  it('looks the row up by the HASH of the presented token, not the plaintext', async () => {
    let seenEq: string | undefined
    const from = vi.fn(() => ({
      select: () => ({
        eq: (_col: string, value: string) => {
          seenEq = value
          return { maybeSingle: async () => ({ data: null, error: null }) }
        },
      }),
    }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    await confirmNewsletterSubscriber('raw-plaintext-token')
    expect(seenEq).toBe(hashToken('raw-plaintext-token'))
    expect(seenEq).not.toBe('raw-plaintext-token')
  })

  it('ROUND TRIP: a token minted by createNewsletterSignup successfully confirms via hash lookup', async () => {
    // Signup: capture the hash that would be persisted.
    let storedConfirmHash = ''
    const signupFrom = vi.fn(() => ({
      upsert: (row: { confirm_token: string }) => {
        storedConfirmHash = row.confirm_token
        return { select: () => ({ maybeSingle: async () => ({ data: { id: 'row-1' }, error: null }) }) }
      },
    }))
    mockWithDb.mockImplementationOnce(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from: signupFrom }))
    const signup = await createNewsletterSignup({ email: 'round-trip@example.com' })
    if (!signup.ok || !signup.isNew) throw new Error('expected a fresh signup')

    // Confirm: the row is "found" only when looked up by the matching hash —
    // proves the raw token returned from signup still resolves correctly.
    const confirmFrom = vi.fn(() => ({
      select: () => ({
        eq: (_col: string, value: string) => ({
          maybeSingle: async () =>
            value === storedConfirmHash
              ? { data: { id: 'row-1', confirmed_at: null }, error: null }
              : { data: null, error: null },
        }),
      }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }))
    mockWithDb.mockImplementationOnce(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from: confirmFrom }))

    await expect(confirmNewsletterSubscriber(signup.confirmToken)).resolves.toBe(true)
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

  it('stamps unsubscribed_at and returns true when a row actually matched', async () => {
    const update = vi.fn(() => ({
      eq: () => ({ select: () => Promise.resolve({ data: [{ id: 'row-1' }], error: null }) }),
    }))
    const from = vi.fn(() => ({ update }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    await expect(unsubscribeNewsletter('any-token')).resolves.toBe(true)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ unsubscribed_at: expect.any(String) }))
  })

  it('looks the row up by the HASH of the presented token, not the plaintext', async () => {
    let seenEq: string | undefined
    const update = vi.fn(() => ({
      eq: (_col: string, value: string) => {
        seenEq = value
        return { select: () => Promise.resolve({ data: [{ id: 'row-1' }], error: null }) }
      },
    }))
    const from = vi.fn(() => ({ update }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    await unsubscribeNewsletter('raw-plaintext-token')
    expect(seenEq).toBe(hashToken('raw-plaintext-token'))
    expect(seenEq).not.toBe('raw-plaintext-token')
  })

  it('ROUND TRIP: the email-derived token embedded in a digest email successfully unsubscribes via hash lookup', async () => {
    const email = 'digest-subscriber@example.com'
    const plaintext = deriveUnsubscribeToken(email)
    const expectedHash = hashToken(plaintext)

    let matched = false
    const update = vi.fn(() => ({
      eq: (_col: string, value: string) => {
        matched = value === expectedHash
        return {
          select: () =>
            Promise.resolve(
              matched ? { data: [{ id: 'row-1' }], error: null } : { data: [], error: null },
            ),
        }
      },
    }))
    const from = vi.fn(() => ({ update }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    await expect(unsubscribeNewsletter(plaintext)).resolves.toBe(true)
    expect(matched).toBe(true)
  })

  // SECURITY/OBSERVABILITY: this is the defense-in-depth fix for the exact
  // failure mode a secret rotation would cause (see
  // lib/env.ts#resolveNewsletterUnsubscribeSecret and docs/ops-runbook.md's
  // "Newsletter unsubscribe secret" section) — the presented token hashes to
  // something no row has (e.g. because the unsubscribe secret changed since
  // this link was emailed), so the update matches zero rows. Previously this
  // returned true (any `!error` read as success); now it must report false
  // and log a warning so the mismatch is observable instead of silently
  // "succeeding" while the subscriber stays subscribed.
  it('returns false and warns when the update matches zero rows (simulated hash mismatch / rotated secret)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const update = vi.fn(() => ({
      eq: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
    }))
    const from = vi.fn(() => ({ update }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    await expect(unsubscribeNewsletter('stale-or-rotated-token')).resolves.toBe(false)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('matched zero rows'))
    warnSpy.mockRestore()
  })

  it('returns false on a query error, without warning about a zero-row match', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const update = vi.fn(() => ({
      eq: () => ({ select: () => Promise.resolve({ data: null, error: new Error('boom') }) }),
    }))
    const from = vi.fn(() => ({ update }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    await expect(unsubscribeNewsletter('any-token')).resolves.toBe(false)
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe('deriveUnsubscribeToken secret source (lib/env.ts#resolveNewsletterUnsubscribeSecret)', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('uses the dedicated NEWSLETTER_UNSUBSCRIBE_SECRET when set, independent of the auth secret', () => {
    process.env.BETTER_AUTH_SECRET = 'auth-secret-a'
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'dedicated-secret'
    const withDedicated = deriveUnsubscribeToken('you@example.com')

    // Rotating the auth secret must NOT change the derived token while the
    // dedicated secret stays fixed — this is the whole point of the decouple.
    process.env.BETTER_AUTH_SECRET = 'auth-secret-b-after-rotation'
    const afterAuthRotation = deriveUnsubscribeToken('you@example.com')

    expect(afterAuthRotation).toBe(withDedicated)
  })

  it('falls back to resolveAuthSecret() when NEWSLETTER_UNSUBSCRIBE_SECRET is unset', () => {
    delete process.env.NEWSLETTER_UNSUBSCRIBE_SECRET
    process.env.BETTER_AUTH_SECRET = 'only-the-auth-secret'
    const beforeRotation = deriveUnsubscribeToken('you@example.com')

    // Without the dedicated secret, rotating the auth secret DOES change the
    // derived token — this is exactly the rotation-breaks-links risk that
    // setting NEWSLETTER_UNSUBSCRIBE_SECRET protects against.
    process.env.BETTER_AUTH_SECRET = 'rotated-auth-secret'
    const afterRotation = deriveUnsubscribeToken('you@example.com')

    expect(afterRotation).not.toBe(beforeRotation)
  })
})

describe('listDueDigestSubscribers', () => {
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000

  it('returns null (unknown) on a db error, never []', async () => {
    const from = vi.fn(() => ({ select: () => ({ is: async () => ({ data: null, error: new Error('boom') }) }) }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    await expect(listDueDigestSubscribers(WEEK_MS)).resolves.toBeNull()
  })

  it('excludes unconfirmed rows and rows missing a stored unsubscribe-token hash', async () => {
    const rows = [
      { id: '1', user_id: null, email: 'unconfirmed@example.com', unsubscribe_token: 'hash-1', confirmed_at: null, unsubscribed_at: null, last_digest_sent_at: null },
      { id: '2', user_id: null, email: 'no-token@example.com', unsubscribe_token: null, confirmed_at: '2026-01-01T00:00:00Z', unsubscribed_at: null, last_digest_sent_at: null },
    ]
    const from = vi.fn(() => ({ select: () => ({ is: async () => ({ data: rows, error: null }) }) }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    await expect(listDueDigestSubscribers(WEEK_MS)).resolves.toEqual([])
  })

  it('includes a never-sent confirmed subscriber and excludes one sent within the guard window', async () => {
    const now = Date.now()
    const rows = [
      { id: 'never-sent', user_id: 'u1', email: 'a@example.com', unsubscribe_token: 'hash-a', confirmed_at: '2026-01-01T00:00:00Z', unsubscribed_at: null, last_digest_sent_at: null },
      { id: 'sent-yesterday', user_id: null, email: 'b@example.com', unsubscribe_token: 'hash-b', confirmed_at: '2026-01-01T00:00:00Z', unsubscribed_at: null, last_digest_sent_at: new Date(now - 24 * 60 * 60 * 1000).toISOString() },
      { id: 'sent-9-days-ago', user_id: null, email: 'c@example.com', unsubscribe_token: 'hash-c', confirmed_at: '2026-01-01T00:00:00Z', unsubscribed_at: null, last_digest_sent_at: new Date(now - 9 * 24 * 60 * 60 * 1000).toISOString() },
    ]
    const from = vi.fn(() => ({ select: () => ({ is: async () => ({ data: rows, error: null }) }) }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    const due = await listDueDigestSubscribers(WEEK_MS)
    expect(due?.map((s) => s.id).sort()).toEqual(['never-sent', 'sent-9-days-ago'])
  })

  it('returns the EMAIL-DERIVED plaintext unsubscribe token, not the stored hash column', async () => {
    const rows = [
      { id: 'row-1', user_id: null, email: 'derived@example.com', unsubscribe_token: 'some-stored-hash', confirmed_at: '2026-01-01T00:00:00Z', unsubscribed_at: null, last_digest_sent_at: null },
    ]
    const from = vi.fn(() => ({ select: () => ({ is: async () => ({ data: rows, error: null }) }) }))
    mockWithDb.mockImplementation(async (_fallback, fn) => (fn as (db: unknown) => Promise<unknown>)({ from }))

    const due = await listDueDigestSubscribers(WEEK_MS)
    expect(due?.[0].unsubscribeToken).toBe(deriveUnsubscribeToken('derived@example.com'))
    expect(due?.[0].unsubscribeToken).not.toBe('some-stored-hash')
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
