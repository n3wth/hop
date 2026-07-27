// Owner-only user-account directory — read models behind /admin/users. Joins
// the Better Auth `user` table with the hop_* domain tables it isn't linked
// to by FK, so this goes direct through Drizzle (getDb), same precedent as
// lib/admin-stats.ts and lib/account-deletion.ts: the withDb Postgrest shim's
// TABLE_MAP doesn't cover the auth tables. Every export is read-only and
// returns null on a degraded db rather than throwing — the page decides how
// to render "unavailable" vs. "empty".

import { eq, ilike, or, desc, inArray, sql } from 'drizzle-orm'
import { getDb } from './db'
import { user, manualBalances, hopCustomers, hopSubscriptions, bookings, userPrefs } from './db/schema'
import { getManualBalances, getUserAwId, type ManualBalance } from './accounts'
import { countActiveStandingOrders } from './standing-orders'
import { PREMIUM_STATUSES } from './billing'
import { isOwner } from './owner'

export const ADMIN_USERS_PAGE_SIZE = 25

export interface AdminUserRow {
  id: string
  name: string
  email: string
  createdAt: string
  tier: 'free' | 'premium'
  balancesCount: number
}

export interface AdminUserList {
  users: AdminUserRow[]
  total: number
}

// Paginated, optionally search-filtered (name/email substring) user list for
// the /admin/users index. null = db unavailable OR the caller isn't the
// owner; { users: [] } = genuinely no matches.
//
// DEFENSE IN DEPTH: the /admin/users page already gates on getOwnerSession()
// first, but this cross-user directory is sensitive enough to re-check
// owner-ness here too, so a future ungated call site fails closed.
export async function listAdminUsers(opts: {
  search?: string
  page?: number
} = {}): Promise<AdminUserList | null> {
  if (!(await isOwner())) return null
  const db = getDb()
  if (!db) return null
  const page = Math.max(1, opts.page ?? 1)
  const offset = (page - 1) * ADMIN_USERS_PAGE_SIZE
  const search = opts.search?.trim()

  try {
    const where = search
      ? or(ilike(user.email, `%${search}%`), ilike(user.name, `%${search}%`))
      : undefined

    const [rows, totalRows] = await Promise.all([
      db
        .select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt })
        .from(user)
        .where(where)
        .orderBy(desc(user.createdAt))
        .limit(ADMIN_USERS_PAGE_SIZE)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(user).where(where),
    ])

    const total = Number(totalRows[0]?.count ?? 0)
    if (rows.length === 0) return { users: [], total }

    const ids = rows.map((r) => r.id)
    const [premiumSubs, balCounts] = await Promise.all([
      db
        .select({
          userId: hopCustomers.userId,
          status: hopSubscriptions.status,
          currentPeriodEnd: hopSubscriptions.currentPeriodEnd,
        })
        .from(hopCustomers)
        .innerJoin(hopSubscriptions, eq(hopSubscriptions.customerId, hopCustomers.id))
        .where(inArray(hopCustomers.userId, ids)),
      db
        .select({ userId: manualBalances.userId, count: sql<number>`count(*)` })
        .from(manualBalances)
        .where(inArray(manualBalances.userId, ids))
        .groupBy(manualBalances.userId),
    ])

    // Same entitlement check as lib/subscription.ts#getUserTier and
    // getAdminUserDetail below: PREMIUM_STATUSES alone isn't enough — a
    // past_due row's period has typically already lapsed, so require the
    // period end to still be in the future too. Otherwise this list's badge
    // can disagree with the detail page's for the same user.
    const now = Date.now()
    const premiumIds = new Set(
      premiumSubs
        .filter((s) => PREMIUM_STATUSES.has(s.status) && new Date(s.currentPeriodEnd).getTime() > now)
        .map((s) => s.userId),
    )
    const balMap = new Map(balCounts.map((b) => [b.userId, Number(b.count)]))

    return {
      total,
      users: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        createdAt: r.createdAt.toISOString(),
        tier: premiumIds.has(r.id) ? 'premium' : 'free',
        balancesCount: balMap.get(r.id) ?? 0,
      })),
    }
  } catch (error) {
    console.error('[admin-users] listAdminUsers failed:', error)
    return null
  }
}

export interface AdminUserSubscription {
  status: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
}

export interface AdminUserDetail {
  id: string
  name: string
  email: string
  emailVerified: boolean
  createdAt: string
  tier: 'free' | 'premium'
  subscription: AdminUserSubscription | null
  balances: ManualBalance[]
  awardWalletConnected: boolean
  homeAirport: string | null
  activeWatches: number
  bookingsCount: number
}

// Full read-only profile for one user — the /admin/users/[id] detail page.
// null = user not found OR db unavailable OR the caller isn't the owner (the
// page treats all three as notFound, same defense-in-depth stance as the
// owner gate: never confirm which). This is the one export here that takes
// an arbitrary userId param, so the re-check matters most: a future ungated
// call site can't be tricked into returning one user's full profile
// (balances, subscription, bookings) to another.
export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  if (!userId || !userId.trim()) return null
  if (!(await isOwner())) return null
  const db = getDb()
  if (!db) return null

  try {
    const rows = await db.select().from(user).where(eq(user.id, userId)).limit(1)
    const u = rows[0]
    if (!u) return null

    const [balances, awId, prefsRows, activeWatches, bookingRows, subRows] = await Promise.all([
      getManualBalances(userId),
      getUserAwId(userId),
      db
        .select({ homeAirport: userPrefs.homeAirport })
        .from(userPrefs)
        .where(eq(userPrefs.userId, userId))
        .limit(1),
      countActiveStandingOrders(userId),
      db.select({ count: sql<number>`count(*)` }).from(bookings).where(eq(bookings.userId, userId)),
      db
        .select({
          status: hopSubscriptions.status,
          currentPeriodEnd: hopSubscriptions.currentPeriodEnd,
          cancelAtPeriodEnd: hopSubscriptions.cancelAtPeriodEnd,
        })
        .from(hopCustomers)
        .innerJoin(hopSubscriptions, eq(hopSubscriptions.customerId, hopCustomers.id))
        .where(eq(hopCustomers.userId, userId))
        .orderBy(desc(hopSubscriptions.currentPeriodEnd))
        .limit(1),
    ])

    const subscription = subRows[0] ?? null
    const tier: 'free' | 'premium' =
      subscription &&
      PREMIUM_STATUSES.has(subscription.status) &&
      new Date(subscription.currentPeriodEnd) > new Date()
        ? 'premium'
        : 'free'

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt.toISOString(),
      tier,
      subscription,
      balances,
      awardWalletConnected: awId !== null,
      homeAirport: prefsRows[0]?.homeAirport ?? null,
      activeWatches,
      bookingsCount: Number(bookingRows[0]?.count ?? 0),
    }
  } catch (error) {
    console.error('[admin-users] getAdminUserDetail failed:', error)
    return null
  }
}
