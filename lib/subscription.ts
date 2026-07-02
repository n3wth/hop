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
