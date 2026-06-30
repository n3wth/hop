import { withDb } from '@/lib/supabase-helpers'

// Subscription tier — the gate for how many active standing-order alerts a user
// may keep. Read-only for now: there is NO billing yet (Stripe is N-289). Every
// user defaults to 'free' until a row says otherwise, so the cap applies broadly
// without any payment plumbing. Like every persistence helper here it degrades
// gracefully — a missing client, missing row, or any error resolves to 'free'
// and NEVER throws.
//
// Table: hop_subscriptions
//   user_id text pk           -- Auth0 sub
//   tier text not null default 'free'   -- 'free' | 'premium'
//   updated_at timestamptz not null default now()
//
// FULL CREATE TABLE + RLS/policy SQL is reported by the agent (NOT run here).

export type Tier = 'free' | 'premium'

// How many ACTIVE standing-order alerts each tier may keep. Free users get a
// small taste; premium is effectively uncapped (the engine still carries its own
// generous per-user ceiling — see lib/standing-orders.MAX_ORDERS_PER_USER — so a
// runaway can't bloat the cron). Enforced in the create server action.
export const ALERT_LIMITS: Record<Tier, number> = {
  free: 3,
  premium: Infinity,
}

const TABLE = 'hop_subscriptions'

function normalizeTier(raw: unknown): Tier {
  return raw === 'premium' ? 'premium' : 'free'
}

// This user's tier. Reads hop_subscriptions; defaults to 'free' on any miss
// (unconfigured client, no row, error). NEVER throws.
export async function getUserTier(userId: string): Promise<Tier> {
  if (!userId) return 'free'
  return withDb<Tier>('free', async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select('tier')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return 'free'
    return normalizeTier((data as { tier: string | null }).tier)
  })
}

// The active-alert allowance for this user. Convenience over getUserTier +
// ALERT_LIMITS so callers don't re-derive it.
export async function getAlertLimit(userId: string): Promise<number> {
  const tier = await getUserTier(userId)
  return ALERT_LIMITS[tier]
}
