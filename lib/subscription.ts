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
    // 1. Get or create customer mapping
    let { data: cust } = await db
      .from('hop_customers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    const stripeCustomerId = meta.customerId ?? 'cus_unknown'

    if (!cust) {
      const { data: newCust, error: insErr } = await db
        .from('hop_customers')
        .insert({
          user_id: userId,
          stripe_customer_id: stripeCustomerId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .maybeSingle()
      if (insErr || !newCust) return false
      cust = newCust
    }

    const customerId = cust.id

    // 2. Resolve subscriptionId
    const stripeSubId = meta.subscriptionId ?? 'sub_unknown'

    // 3. Get existing subscription
    const { data: existing } = await db
      .from('hop_subscriptions')
      .select('id, updated_at')
      .eq('stripe_subscription_id', stripeSubId)
      .maybeSingle()

    if (existing) {
      const storedMs = Date.parse(existing.updated_at)
      if (Number.isFinite(storedMs) && eventAtMs < storedMs) {
        // Skip outdated event
        return true
      }
    }

    const payload = {
      customer_id: customerId,
      stripe_subscription_id: stripeSubId,
      stripe_price_id: 'price_unknown',
      status: tier === 'premium' ? ('active' as const) : ('canceled' as const),
      current_period_start: new Date(eventAtMs).toISOString(),
      current_period_end: tier === 'premium'
        ? new Date(eventAtMs + 30 * 86400000).toISOString()
        : new Date(eventAtMs - 86400000).toISOString(),
      cancel_at_period_end: false,
      updated_at: new Date(eventAtMs).toISOString(),
    }

    if (existing) {
      const { error } = await db
        .from('hop_subscriptions')
        .update(payload)
        .eq('id', existing.id)
      return !error
    } else {
      const { error } = await db
        .from('hop_subscriptions')
        .insert({
          ...payload,
          created_at: new Date(eventAtMs).toISOString(),
        })
      return !error
    }
  })
}

export async function userIdForStripeCustomer(customerId: string): Promise<string | null> {
  if (!customerId) return null
  return withDb<string | null>(null, async (db) => {
    const { data, error } = await db
      .from('hop_customers')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    if (error || !data) return null
    return (data as { user_id: string | null }).user_id ?? null
  })
}
