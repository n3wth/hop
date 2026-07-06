// Newsletter foundation — R1.6 (signup capture) + R2.3 (weekly digest).
//
// Mirrors lib/escalation.ts's persistence contract exactly: every function
// wraps its work in withDb and NEVER throws — an unconfigured db or a write
// error degrades to a safe fallback (false/null/{ok:false}), never a crash.
//
// Double opt-in (unlike hop_escalations' single-step lead capture) because
// this seam eventually SENDS mail to the address (R2.3's weekly digest), so a
// typo'd or hostile address must never receive anything without proving it
// can be reached. Both tokens stay valid after use — confirmToken so a second
// click on the same email link is a no-op success rather than a broken-link
// error (re-confirming an already-confirmed row is harmless), and
// unsubscribeToken permanently so the one-click footer link always works.
//
// SQL (run manually — this code does NOT run DDL; the migration lives in
// drizzle/, generated from lib/db/schema.ts#newsletterSubscribers):
//
//   CREATE TABLE public.hop_newsletter_subscribers (
//     id                  uuid primary key default gen_random_uuid(),
//     user_id             text,                 -- Better Auth user.id; NULL when signed out
//     email               text not null,        -- stored lowercased; unique
//     confirm_token       text,                 -- kept after use; re-confirm is a no-op
//     unsubscribe_token   text not null,        -- permanent
//     confirmed_at        timestamptz,
//     unsubscribed_at     timestamptz,
//     last_digest_sent_at timestamptz,          -- R2.3's per-subscriber idempotency guard
//     created_at          timestamptz not null default now()
//   );

import { randomBytes } from 'node:crypto'
import { withDb } from '@/lib/supabase-helpers'
import { normalizeEmail } from '@/lib/escalation'

export { normalizeEmail }

const TABLE = 'hop_newsletter_subscribers'
const TOKEN_BYTES = 24

// Lowercased, validated email — the storage/dedupe key. Case-insensitive
// dedup without a citext column (R1.6 plan §8's recommended approach).
function normalizeEmailLower(raw: unknown): string | null {
  const email = normalizeEmail(raw)
  return email ? email.toLowerCase() : null
}

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex')
}

interface SubscriberRow {
  id: string
  user_id: string | null
  email: string | null
  unsubscribe_token: string | null
  confirmed_at: string | null
  unsubscribed_at: string | null
  last_digest_sent_at: string | null
}

export type SignupResult =
  | { ok: true; isNew: true; confirmToken: string }
  | { ok: true; isNew: false }
  | { ok: false }

// Store a pending (unconfirmed) subscriber row. Idempotent: re-submitting an
// already-known email returns {ok:true, isNew:false} — the caller must NOT
// send another confirmation email in that case (mirrors hop_escalations'
// dedup-not-error contract). Returns {ok:false} for an invalid email or any
// db failure. NEVER throws.
export async function createNewsletterSignup(input: {
  email: unknown
  userId?: string
}): Promise<SignupResult> {
  const email = normalizeEmailLower(input?.email)
  if (!email) return { ok: false }
  const userId =
    typeof input.userId === 'string' && input.userId.trim() ? input.userId.trim() : null
  const confirmToken = generateToken()
  const unsubscribeToken = generateToken()

  return withDb<SignupResult>({ ok: false }, async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .upsert(
        {
          user_id: userId,
          email,
          confirm_token: confirmToken,
          unsubscribe_token: unsubscribeToken,
        },
        { onConflict: 'email', ignoreDuplicates: true },
      )
      .select('id')
      .maybeSingle()
    if (error) return { ok: false }
    // ignoreDuplicates means a conflicting email inserts nothing and RETURNING
    // is empty — that's how a resubmit is detected without a race.
    if (!data?.id) return { ok: true, isNew: false }
    return { ok: true, isNew: true, confirmToken }
  })
}

// Flip confirm_token -> confirmed_at. The token is DELIBERATELY left in place
// (not nulled) so a second click on the same link — a real browser/email-
// client behavior (prefetch, retry, the user clicking twice) — still resolves
// the row and returns the same no-op success, rather than looking like an
// unknown/expired link. Reusing it grants nothing beyond re-confirming an
// already-confirmed row, which is harmless. false for an unknown token or any
// db failure. NEVER throws.
export async function confirmNewsletterSubscriber(token: unknown): Promise<boolean> {
  const t = typeof token === 'string' ? token.trim() : ''
  if (!t) return false
  return withDb(false, async (db) => {
    const { data, error: selectError } = await db
      .from(TABLE)
      .select('id, confirmed_at')
      .eq('confirm_token', t)
      .maybeSingle()
    if (selectError || !data?.id) return false
    if (data.confirmed_at) return true
    const { error } = await db
      .from(TABLE)
      .update({ confirmed_at: new Date().toISOString() })
      .eq('id', data.id)
    return !error
  })
}

// One-click unsubscribe (no login required). Idempotent and deliberately
// silent about whether the token matched — always returns the same shape so
// a stale/garbage link can't be used to probe which addresses are subscribed.
// NEVER throws.
export async function unsubscribeNewsletter(token: unknown): Promise<boolean> {
  const t = typeof token === 'string' ? token.trim() : ''
  if (!t) return false
  return withDb(false, async (db) => {
    const { error } = await db
      .from(TABLE)
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq('unsubscribe_token', t)
    return !error
  })
}

export interface DigestSubscriber {
  id: string
  userId: string | null
  email: string
  unsubscribeToken: string
}

// Confirmed, non-unsubscribed subscribers due for a send: never sent, or last
// sent more than `sinceMs` ago. This IS the R2.3 idempotency guard — a simple
// per-subscriber timestamp rather than hop_notification_outbox, which is
// keyed on a non-null user_id and doesn't fit anonymous subscribers. null
// (never []) on a degraded db, so "db down" can't misread as "nobody due"
// (mirrors lib/cron-heartbeat.ts#listHeartbeats). NEVER throws.
export async function listDueDigestSubscribers(sinceMs: number): Promise<DigestSubscriber[] | null> {
  return withDb<DigestSubscriber[] | null>(null, async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select('id, user_id, email, unsubscribe_token, confirmed_at, unsubscribed_at, last_digest_sent_at')
      .is('unsubscribed_at', null)
    if (error || !data) return null
    const cutoff = Date.now() - sinceMs
    return (data as SubscriberRow[])
      .filter((r) => {
        if (!r.email || !r.confirmed_at || !r.unsubscribe_token) return false
        if (!r.last_digest_sent_at) return true
        const t = Date.parse(r.last_digest_sent_at)
        return !Number.isFinite(t) || t < cutoff
      })
      .map((r) => ({
        id: r.id,
        userId: r.user_id,
        email: r.email as string,
        unsubscribeToken: r.unsubscribe_token as string,
      }))
  })
}

// Stamp a successful digest send so the next run's idempotency filter skips
// this subscriber until the guard window elapses. false on any failure —
// NEVER throws. A failure here just means a possible re-send next run, which
// is the safe direction (never silently drop a subscriber from all future
// digests because one stamp write failed).
export async function markDigestSent(id: string): Promise<boolean> {
  if (!id) return false
  return withDb(false, async (db) => {
    const { error } = await db
      .from(TABLE)
      .update({ last_digest_sent_at: new Date().toISOString() })
      .eq('id', id)
    return !error
  })
}
