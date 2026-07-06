// GET /api/cron/newsletter-digest — R2.3's weekly retention loop: "your
// wallet's best redemption this week" to every confirmed, non-unsubscribed
// newsletter subscriber (lib/newsletter.ts, R1.6). Runs the SAME engine the
// signed-in home page runs (lib/ledger-dream.ts#ledgerDream, itself built on
// lib/destinations.ts's computeCpp/topValue/affordableWith) — personalized
// when the subscriber's email resolves to a real hop account with live
// balances, otherwise ledgerDream's own honest save-toward sample. Every
// number in the email is engine-computed; nothing here is LLM-generated.
//
// IDEMPOTENCY: no generic outbox — hop_notification_outbox is keyed on a
// non-null user_id, and an anonymous newsletter subscriber may have none.
// Instead, a per-subscriber last_digest_sent_at guard
// (lib/newsletter.ts#listDueDigestSubscribers /#markDigestSent): due means
// never sent, or sent more than DIGEST_INTERVAL_MS ago; a successful send
// stamps the guard immediately after.
//
// SUPPRESSION: checks lib/email-suppressions.ts#isSuppressed before every
// send — addresses that bounced or complained (recorded by the Resend
// webhook, app/api/webhooks/resend/route.ts) never receive a digest.
//
// GATED: requires the Vercel cron auth header (CRON_SECRET) when set — checked
// FIRST, before anything else (same order as every other app/api/cron/* route,
// e.g. sync-stripe), so an unauthenticated caller can't even learn whether the
// feature flag is configured. Only once authorized does it check
// isNewsletterEnabled() (HOP_ENABLE_NEWSLETTER AND RESEND_API_KEY) — 503
// disabled otherwise, no DB reads, no sends. NEVER throws to the platform:
// one subscriber's failure can't sink the run.

import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { user as userTable } from '@/lib/db/schema'
import { getUserBalances } from '@/lib/accounts'
import { ledgerDream } from '@/lib/ledger-dream'
import { listDueDigestSubscribers, markDigestSent } from '@/lib/newsletter'
import { isSuppressed } from '@/lib/email-suppressions'
import { sendWeeklyDigestEmail } from '@/lib/email'
import { isNewsletterEnabled } from '@/lib/env'
import { recordHeartbeat } from '@/lib/cron-heartbeat'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { SITE_URL } from '@/lib/seo'
import type { Balance } from '@/lib/types'

// This route reads per-user data and must never be cached or statically rendered.
export const dynamic = 'force-dynamic'

// Idempotency guard window — see listDueDigestSubscribers. Deliberately
// shorter than the 7-day cron cadence (vercel.json's "0 13 * * 1"): the guard
// is stamped with the wall-clock time AFTER a run finishes (markDigestSent),
// so a window of exactly 7 days would let any nonzero processing latency
// push the stamp past the next run's cutoff and skip that subscriber,
// halving their effective cadence to every other week. 6 days leaves slack.
const DIGEST_INTERVAL_MS = 6 * 24 * 60 * 60 * 1000

// Resolve a subscriber's Better Auth user id by email so an account created
// AFTER signup still personalizes — a userId captured at signup time would
// miss that. `user` is Better Auth core, not behind the withDb Postgrest shim,
// so this goes direct through Drizzle (same precedent as lib/admin-users.ts /
// lib/business-digest.ts#activeUsersMetric). Never throws.
async function resolveUserId(email: string, storedUserId: string | null): Promise<string | null> {
  if (storedUserId) return storedUserId
  try {
    const db = getDb()
    if (!db) return null
    const rows = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, email)).limit(1)
    return rows[0]?.id ?? null
  } catch {
    return null
  }
}

function unsubscribeUrl(token: string): string {
  return `${SITE_URL}/api/newsletter-signup/unsubscribe?token=${encodeURIComponent(token)}`
}

export async function GET(request: Request) {
  // Auth FIRST, same as every other cron route (e.g. sync-stripe) — an
  // unauthenticated caller must not be able to learn whether the feature flag
  // is even configured before proving it's allowed to invoke this route.
  if (!isAuthorizedCron(request)) {
    return Response.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  }
  if (!isNewsletterEnabled()) {
    recordHeartbeat('newsletter-digest', false, 'disabled')
    return Response.json({ ok: false, disabled: true, reason: 'newsletter is off' }, { status: 503 })
  }

  const startedAt = Date.now()
  const subscribers = await listDueDigestSubscribers(DIGEST_INTERVAL_MS)
  // null = db unavailable/unknown — distinct from a genuinely empty due list,
  // so a degraded db can't silently read as "nobody due" in the heartbeat note.
  if (subscribers === null) {
    recordHeartbeat('newsletter-digest', false, 'db-unavailable')
    return Response.json({ ok: false, reason: 'db-unavailable' })
  }

  let sent = 0
  let suppressed = 0
  let personalized = 0
  const errors: string[] = []

  for (const sub of subscribers) {
    try {
      if (await isSuppressed(sub.email)) {
        suppressed++
        continue
      }

      const userId = await resolveUserId(sub.email, sub.userId)
      let balances: Balance[] = []
      if (userId) {
        balances = await getUserBalances(userId)
        if (balances.length > 0) personalized++
      }

      // THE UNCHANGED ENGINE. Same call the signed-in home page makes.
      const dream = ledgerDream(balances)
      const result = await sendWeeklyDigestEmail(sub.email, dream, unsubscribeUrl(sub.unsubscribeToken))
      if (result.ok) {
        await markDigestSent(sub.id)
        sent++
      } else {
        errors.push(`${sub.id}: ${result.reason}`)
      }
    } catch (e) {
      errors.push(`${sub.id}: ${e instanceof Error ? e.message : 'error'}`)
    }
  }

  recordHeartbeat(
    'newsletter-digest',
    true,
    [
      `due:${subscribers.length}`,
      `sent:${sent}`,
      `personalized:${personalized}`,
      suppressed > 0 ? `suppressed:${suppressed}` : '',
      errors.length > 0 ? `errors:${errors.length}` : '',
    ]
      .filter(Boolean)
      .join(' '),
  )

  return Response.json({
    ok: true,
    due: subscribers.length,
    sent,
    personalized,
    suppressed,
    durationMs: Date.now() - startedAt,
    errors: errors.length > 0 ? errors : undefined,
  })
}
