// Newsletter lead capture (roadmap R1.6 / docs/plans/2026-07-02-newsletter-signup.md).
//
// Phase 1 only CAPTURES leads — no ESP integration, no sends. Mirrors
// lib/escalation.ts exactly: withDb never-throw persistence, nullable user_id
// for signed-out visitors, and a resubmit is a dedup no-op (never an error).
//
// SQL (run manually — this code does NOT run DDL). The CREATE TABLE lives in the
// Drizzle migration generated from the newsletterSignups table in
// lib/db/schema.ts. Summary:
//
//   CREATE TABLE public.hop_newsletter_signups (
//     id          uuid primary key default gen_random_uuid(),
//     user_id     text,                       -- Better Auth user id; NULL when signed out
//     email       text not null,              -- stored lowercased; unique
//     created_at  timestamptz not null default now()
//   );
//   CREATE UNIQUE INDEX hop_newsletter_signups_email_idx ON public.hop_newsletter_signups (email);
//   ALTER TABLE public.hop_newsletter_signups ENABLE ROW LEVEL SECURITY;
//   -- service-role bypasses RLS; no anon/auth policy (we scope in code).

import { withDb } from '@/lib/supabase-helpers'
import { normalizeEmail } from '@/lib/escalation'

const TABLE = 'hop_newsletter_signups'

export interface NewsletterSignup {
  id: string
  userId: string | null
  email: string
  createdAt?: string
}

interface NewsletterSignupRow {
  id: string
  user_id: string | null
  email: string | null
  created_at: string | null
}

function rowToSignup(row: NewsletterSignupRow): NewsletterSignup | null {
  const email = normalizeEmail(row.email)
  if (!email) return null
  return {
    id: row.id,
    userId: row.user_id ?? null,
    email,
    createdAt: row.created_at ?? undefined,
  }
}

// Store a newsletter lead. Validates + lowercases defensively (case-insensitive
// dedup via the unique index on email). Returns true when the address is now
// saved — including when it was already saved (dedup is a no-op success, never
// an error). Returns false for an unusable email or an unconfigured/failing db.
// NEVER throws — mirrors createEscalation's contract.
export async function createNewsletterSignup(input: {
  userId?: string
  email: unknown
}): Promise<boolean> {
  return withDb<boolean>(false, async (db) => {
    const email = normalizeEmail(input?.email)?.toLowerCase()
    if (!email) return false
    const userId =
      typeof input?.userId === 'string' && input.userId.trim() ? input.userId.trim() : null

    const { error } = await db
      .from(TABLE)
      .upsert({ user_id: userId, email }, { onConflict: 'email', ignoreDuplicates: true })
    return !error
  })
}

// ALL recent newsletter signups, newest first — owner-only export (no admin UI
// yet; a manual SQL/CLI pull, same shape as listRecentEscalations). null when
// the db is unconfigured or the read fails; [] only when genuinely empty.
// NEVER throws. Must only ever be called from a trusted server context.
export async function listRecentNewsletterSignups(limit = 100): Promise<NewsletterSignup[] | null> {
  return withDb<NewsletterSignup[] | null>(null, async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select('id, user_id, email, created_at')
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(1, limit), 250))
    if (error || !data) return null
    return (data as NewsletterSignupRow[])
      .map(rowToSignup)
      .filter((s): s is NewsletterSignup => s !== null)
  })
}
