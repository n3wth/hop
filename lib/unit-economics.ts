// Owner-facing unit economics for /admin — revenue vs cost, every figure
// computed from ledgers or documented constants, never LLM-generated.
//
// MRR is estimated from hop_subscriptions rows × list prices (matching
// BillingSection). LLM cost is null until a PostHog billing export is wired.
// Infra is a monthly constant (override via HOP_INFRA_COST_MONTHLY_USD).

import { withDb } from '@/lib/supabase-helpers'
import { getOutclickSummary } from '@/lib/outclicks'
import { env, hasEnv } from '@/lib/env'

/** List prices — must stay in sync with components/BillingSection.tsx */
export const PRO_PRICE_MONTHLY_USD = 9.99
export const PRO_PRICE_YEARLY_USD = 99

const DEFAULT_INFRA_COST_MONTHLY_USD = 75

export interface UnitEconomics {
  /** Estimated monthly recurring revenue from active subs × list prices. null = degraded. */
  mrrUsd: number | null
  /** Active paid subscriptions counted toward MRR. null when MRR degraded. */
  activePaidCount: number | null
  /** Trailing 7-day outclicks by kind. null = ledger unavailable. */
  outclicksByKind: Record<string, number> | null
  outclicksTotal7d: number | null
  /** Open booking requests (status new). null = degraded. */
  escalationsNew: number | null
  /** Handled booking requests (status done). null = degraded. */
  escalationsDone: number | null
  /** PostHog LLM spend — not wired yet. */
  llmCostUsd: null
  /** Documented infra baseline (Neon + Vercel + email). */
  infraCostUsd: number
  /** MRR − infra when MRR is known (LLM omitted until wired). null when MRR degraded. */
  contributionUsd: number | null
}

export function readInfraCostMonthlyUsd(): number {
  const raw = process.env.HOP_INFRA_COST_MONTHLY_USD
  if (raw) {
    const n = parseFloat(raw)
    if (Number.isFinite(n) && n >= 0) return n
  }
  return DEFAULT_INFRA_COST_MONTHLY_USD
}

/** Pure MRR math from subscription rows — exported for tests. */
export function mrrFromSubscriptionRows(
  rows: Array<{ stripePriceId: string }>,
  monthlyPriceId: string,
  yearlyPriceId: string | null,
): { mrrUsd: number; count: number } {
  let mrrUsd = 0
  let count = 0
  for (const row of rows) {
    if (row.stripePriceId === monthlyPriceId) {
      mrrUsd += PRO_PRICE_MONTHLY_USD
      count++
    } else if (yearlyPriceId && row.stripePriceId === yearlyPriceId) {
      mrrUsd += PRO_PRICE_YEARLY_USD / 12
      count++
    }
  }
  return { mrrUsd: Math.round(mrrUsd * 100) / 100, count }
}

async function computeMrr(): Promise<{ mrrUsd: number; count: number } | null> {
  if (!hasEnv('STRIPE_PRICE_ID_PRO_MONTHLY')) return null
  const monthlyId = env.stripePriceIdProMonthly()
  const yearlyId = hasEnv('STRIPE_PRICE_ID_PRO_YEARLY') ? env.stripePriceIdProYearly() : null

  return withDb<{ mrrUsd: number; count: number } | null>(null, async (db) => {
    const { data, error } = await db
      .from('hop_subscriptions')
      .select('stripe_price_id')
      .in('status', ['active', 'trialing'])
      .gt('current_period_end', new Date().toISOString())
    if (error || !Array.isArray(data)) return null
    const rows = (data as Array<{ stripe_price_id?: string }>)
      .filter((r) => typeof r.stripe_price_id === 'string')
      .map((r) => ({ stripePriceId: r.stripe_price_id as string }))
    return mrrFromSubscriptionRows(rows, monthlyId, yearlyId)
  })
}

async function countEscalationsByStatus(): Promise<{ new: number; done: number } | null> {
  return withDb<{ new: number; done: number } | null>(null, async (db) => {
    const [newRes, doneRes] = await Promise.all([
      db.from('hop_escalations').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      db.from('hop_escalations').select('id', { count: 'exact', head: true }).eq('status', 'done'),
    ])
    if (newRes.error || doneRes.error) return null
    if (typeof newRes.count !== 'number' || typeof doneRes.count !== 'number') return null
    return { new: newRes.count, done: doneRes.count }
  })
}

export async function computeUnitEconomics(): Promise<UnitEconomics> {
  const infraCostUsd = readInfraCostMonthlyUsd()
  const [mrr, outclicks, escalations] = await Promise.all([
    computeMrr(),
    getOutclickSummary(),
    countEscalationsByStatus(),
  ])

  const mrrUsd = mrr?.mrrUsd ?? null
  const contributionUsd =
    mrrUsd !== null ? Math.round((mrrUsd - infraCostUsd) * 100) / 100 : null

  return {
    mrrUsd,
    activePaidCount: mrr?.count ?? null,
    outclicksByKind: outclicks?.last7d ?? null,
    outclicksTotal7d: outclicks?.total ?? null,
    escalationsNew: escalations?.new ?? null,
    escalationsDone: escalations?.done ?? null,
    llmCostUsd: null,
    infraCostUsd,
    contributionUsd,
  }
}
