// Owner-only billing/revenue console — read models behind /admin/billing.
// MRR reuses lib/unit-economics.ts#computeMrr (the SAME figure Overview
// shows — never a second hand-rolled calculation). This file adds the two
// things Overview doesn't have: a status breakdown across ALL subscription
// rows (not just active/trialing) and a recent-subscriptions list. Direct
// Drizzle (service-role), same precedent as lib/admin-users.ts and
// lib/admin-stats.ts — the withDb Postgrest shim's TABLE_MAP doesn't cover
// the auth `user` table this needs to join against. Every export is
// read-only and returns null on a degraded db rather than throwing.

import { desc, eq, sql } from 'drizzle-orm'
import { getDb } from './db'
import { user, hopCustomers, hopSubscriptions } from './db/schema'
import { computeMrr } from './unit-economics'

export interface AdminSubscriptionRow {
  email: string
  status: string
  priceId: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
}

const RECENT_LIMIT = 20

// Newest-updated-first subscription rows, joined out to the owner's email.
// null = db unavailable; [] = genuinely no subscriptions yet.
export async function listSubscriptions(
  limit: number = RECENT_LIMIT,
): Promise<AdminSubscriptionRow[] | null> {
  const db = getDb()
  if (!db) return null
  try {
    const rows = await db
      .select({
        email: user.email,
        status: hopSubscriptions.status,
        priceId: hopSubscriptions.stripePriceId,
        currentPeriodEnd: hopSubscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: hopSubscriptions.cancelAtPeriodEnd,
      })
      .from(hopSubscriptions)
      .innerJoin(hopCustomers, eq(hopSubscriptions.customerId, hopCustomers.id))
      .innerJoin(user, eq(hopCustomers.userId, user.id))
      .orderBy(desc(hopSubscriptions.updatedAt))
      .limit(limit)

    // hop_subscriptions' timestamp columns are declared via the schema's tz()
    // helper (mode: 'string'), so Drizzle already hands back ISO strings here
    // — unlike the Better Auth `user` table's plain Date columns elsewhere.
    return rows.map((r) => ({
      email: r.email,
      status: r.status,
      priceId: r.priceId,
      currentPeriodEnd: r.currentPeriodEnd,
      cancelAtPeriodEnd: r.cancelAtPeriodEnd,
    }))
  } catch (error) {
    console.error('[admin-billing] listSubscriptions failed:', error)
    return null
  }
}

// Count of subscription rows per Stripe status (active/trialing/past_due/
// canceled/…) — whatever statuses actually exist, not a fixed enum, so a
// status this code doesn't anticipate still shows up rather than vanishing.
// null = db unavailable; {} = table is empty.
export async function getSubscriptionStatusCounts(): Promise<Record<string, number> | null> {
  const db = getDb()
  if (!db) return null
  try {
    const rows = await db
      .select({ status: hopSubscriptions.status, count: sql<number>`count(*)` })
      .from(hopSubscriptions)
      .groupBy(hopSubscriptions.status)
    const counts: Record<string, number> = {}
    for (const r of rows) counts[r.status] = Number(r.count)
    return counts
  } catch (error) {
    console.error('[admin-billing] getSubscriptionStatusCounts failed:', error)
    return null
  }
}

export interface BillingOverview {
  /** Same figure as Overview's unit-economics tile. null = MRR undeterminable (no price id configured, or db down). */
  mrrUsd: number | null
  activePaidCount: number | null
  /** Row count per Stripe status, across ALL subscriptions ever recorded. */
  statusCounts: Record<string, number>
  recent: AdminSubscriptionRow[]
}

// Composes the three reads above. null ONLY on a hard DB failure — a
// reachable db with zero subscription rows returns a real BillingOverview
// with empty collections, never a fabricated zero disguised as "unavailable".
export async function getBillingOverview(): Promise<BillingOverview | null> {
  const [mrr, statusCounts, recent] = await Promise.all([
    computeMrr(),
    getSubscriptionStatusCounts(),
    listSubscriptions(),
  ])
  if (statusCounts === null || recent === null) return null
  return {
    mrrUsd: mrr?.mrrUsd ?? null,
    activePaidCount: mrr?.count ?? null,
    statusCounts,
    recent,
  }
}
