import { withDb } from '@/lib/supabase-helpers'

export type Tier = 'free' | 'premium'

export const ALERT_LIMITS: Record<Tier, number> = {
  free: 3,
  premium: Infinity,
}

// Determine if the user has an active premium subscription.
export async function getUserTier(userId: string): Promise<Tier> {
  if (!userId) return 'free'
  return withDb<Tier>('free', async (db) => {
    // 1. Resolve Stripe customer ID mapping
    const { data: cust, error: custErr } = await db
      .from('hop_customers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (custErr || !cust) return 'free'

    // 2. Query active or trialing subscriptions
    const { data: sub, error: subErr } = await db
      .from('hop_subscriptions')
      .select('status, current_period_end')
      .eq('customer_id', cust.id)
      .in('status', ['active', 'trialing'])
      .order('current_period_end', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subErr || !sub) return 'free'

    // Verify subscription period is active
    const isFuture = new Date(sub.current_period_end) > new Date()
    return isFuture ? 'premium' : 'free'
  })
}

// Get alert cap for user based on tier.
export async function getAlertLimit(userId: string): Promise<number> {
  const tier = await getUserTier(userId)
  return ALERT_LIMITS[tier]
}

// Write a user's tier from a VERIFIED Stripe webhook event (the only caller).
// Pure upsert keyed by user_id, so a replayed event is a no-op. Out-of-order
// guard: a write whose eventAt predates the stored last_event_at is SKIPPED
// (returns true — the newer truth already won; e.g. a late `updated` can't
// resurrect premium after `deleted`). Returns false only on a real failure
// (unconfigured DB, write error) so the webhook route can 500 and let Stripe
// retry — retry is the recovery mechanism for a money-truth write.
export async function setUserTier(
  userId: string,
  tier: Tier,
  meta: { customerId?: string; subscriptionId?: string; eventAt: string },
): Promise<boolean> {
  if (!userId) return false
  const eventAtMs = Date.parse(meta.eventAt)
  if (!Number.isFinite(eventAtMs)) return false
  return withDb(false, async (db) => {
    const { data, error: readError } = await db
      .from(TABLE)
      .select('last_event_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (readError) return false
    const stored = (data as { last_event_at: string | null } | null)?.last_event_at
    if (stored) {
      const storedMs = Date.parse(stored)
      // Stale event — the row already reflects a newer one. Skip, report ok.
      if (Number.isFinite(storedMs) && eventAtMs < storedMs) return true
    }
    // Only carry the Stripe ids the event actually has — an event without a
    // customer/subscription ref must not null out ones we stored earlier
    // (stripe_customer_id is the fallback-attribution + auth-migration key).
    const row: {
      user_id: string
      tier: string
      last_event_at: string
      updated_at: string
      stripe_customer_id?: string
      stripe_subscription_id?: string
    } = {
      user_id: userId,
      tier: normalizeTier(tier),
      last_event_at: new Date(eventAtMs).toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (meta.customerId) row.stripe_customer_id = meta.customerId
    if (meta.subscriptionId) row.stripe_subscription_id = meta.subscriptionId
    const { error } = await db.from(TABLE).upsert(row, { onConflict: 'user_id' })
    return !error
  })
}

// Fallback attribution for lifecycle events that arrive without our
// metadata.user_id: look the customer up in OUR OWN rows (written by earlier,
// attributed events). Never trusts anything attacker-controlled — the mapping
// only exists because we minted it. null on no match / any failure.
export async function userIdForStripeCustomer(customerId: string): Promise<string | null> {
  if (!customerId) return null
  return withDb<string | null>(null, async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    if (error || !data) return null
    return (data as { user_id: string | null }).user_id ?? null
  })
}
