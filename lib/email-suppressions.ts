// Email suppression list — addresses that bounced or complained, per the
// Resend webhook (app/api/webhooks/resend/route.ts). Protects Resend
// deliverability/sender reputation: repeatedly sending to a bounced or
// complained address gets a sending domain throttled or suspended.
//
// ENFORCED CENTRALLY: lib/email.ts#dispatch() checks isSuppressed(to) before
// every send, so ALL senders inherit the guard automatically ({ok:false,
// reason:'suppressed'}). New send paths that go through dispatch() need no
// explicit check; the newsletter digest's own pre-check remains as a cheap
// skip (it avoids computing the dream for a suppressed address).
//
// Like every hop upstream client, this degrades via withDb and NEVER throws.
// isSuppressed() fails OPEN (false) on a DB error — see its own comment.

import { withDb } from '@/lib/supabase-helpers'
import { normalizeEmail } from '@/lib/escalation'

const TABLE = 'hop_email_suppressions'

export type SuppressionReason = 'bounced' | 'complained'

// Idempotent: re-upserting the same email+reason after a redelivered webhook
// event (Resend/Svix can retry a delivery) is a no-op change to the row.
export async function recordSuppression(email: string, reason: SuppressionReason): Promise<void> {
  const normalized = normalizeEmail(email)
  if (!normalized) return
  await withDb<null>(null, async (db) => {
    const { error } = await db
      .from(TABLE)
      .upsert({ email: normalized, reason }, { onConflict: 'email' })
    if (error) {
      console.error(`email-suppressions: upsert failed for reason=${reason}`, error)
    }
    return null
  })
}

// FAILS OPEN: a DB read error resolves to "not suppressed" rather than
// blocking sends. A false negative here just risks one more email to a bad
// address; a false positive would silently block a real user forever.
export async function isSuppressed(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email)
  if (!normalized) return false
  return withDb<boolean>(false, async (db) => {
    const { data, error } = await db.from(TABLE).select('email').eq('email', normalized).maybeSingle()
    if (error) {
      console.error('email-suppressions: read failed, failing open', error)
      return false
    }
    return Boolean(data)
  })
}
