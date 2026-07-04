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

// ---------------------------------------------------------------------------
// Writes — the hop_customers mapping and the webhook's subscription upsert.
// All withDb-backed: fallbacks instead of throws, exactly like the reads.

// The Stripe customer id we minted for this user, if any.
export async function stripeCustomerIdFor(userId: string): Promise<string | null> {
  if (!userId) return null
  return withDb<string | null>(null, async (db) => {
    const { data, error } = await db
      .from('hop_customers')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data?.stripe_customer_id) return null
    return data.stripe_customer_id as string
  })
}

// Persist the user ↔ Stripe-customer mapping — the attribution row both
// getUserTier and the webhook key on. Idempotent via the user_id unique.
export async function saveStripeCustomer(
  userId: string,
  stripeCustomerId: string,
): Promise<boolean> {
  if (!userId || !stripeCustomerId) return false
  return withDb<boolean>(false, async (db) => {
    const { error } = await db.from('hop_customers').upsert(
      {
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    return !error
  })
}

export type RecordSubscriptionOutcome = 'ok' | 'no-attribution' | 'db-error'

// The webhook's single write path: resolve the customer row from our stored
// mapping — or self-heal it from the user ref WE minted into the event's
// metadata (covers sessions created before the mapping row existed) — then
// upsert the subscription record keyed by stripe_subscription_id.
//
// Never throws. 'no-attribution' = neither the mapping nor a metadata user
// ref ties the event to a user (the caller logs and 200-acks — permanent,
// retrying won't help). 'db-error' = storage unavailable (the caller 500s so
// Stripe retries).
export async function recordSubscription(args: {
  userId: string | null
  stripeCustomerId: string
  record: {
    subscriptionId: string
    priceId: string
    status: string
    currentPeriodStart: string
    currentPeriodEnd: string
    cancelAtPeriodEnd: boolean
  }
}): Promise<RecordSubscriptionOutcome> {
  const { userId, stripeCustomerId, record } = args
  if (!stripeCustomerId || !record.subscriptionId) return 'no-attribution'
  return withDb<RecordSubscriptionOutcome>('db-error', async (db) => {
    // A read ERROR is storage trouble (retryable) — only a clean empty read
    // means "we hold no mapping". Conflating them would 200-ack (and so drop)
    // a paying customer's event during a DB outage.
    const { data: cust, error: custErr } = await db
      .from('hop_customers')
      .select('id')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle()
    if (custErr) return 'db-error'
    let customerRowId: string | null = (cust?.id as string | undefined) ?? null

    if (!customerRowId && userId) {
      const { data: healed, error: healErr } = await db
        .from('hop_customers')
        .upsert(
          {
            user_id: userId,
            stripe_customer_id: stripeCustomerId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        )
        .select('id')
        .maybeSingle()
      if (healErr) return 'db-error'
      if (healed?.id) customerRowId = healed.id as string
    }

    if (!customerRowId) return 'no-attribution'

    const { error: subErr } = await db.from('hop_subscriptions').upsert(
      {
        customer_id: customerRowId,
        stripe_subscription_id: record.subscriptionId,
        stripe_price_id: record.priceId,
        status: record.status,
        current_period_start: record.currentPeriodStart,
        current_period_end: record.currentPeriodEnd,
        cancel_at_period_end: record.cancelAtPeriodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_subscription_id' },
    )
    if (subErr) return 'db-error'
    return 'ok'
  })
}
