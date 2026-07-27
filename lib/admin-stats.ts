// Owner-only growth counts read straight off the Better Auth user table —
// the two numbers the founder asks for first (how many accounts, how many
// this week). Direct Drizzle (the withDb shim doesn't map the auth tables).
// null = unknown (unconfigured/dead db), never a fake zero. SERVER ONLY.

import { sql, gte } from 'drizzle-orm'
import { getDb } from './db'
import { user } from './db/schema'

export interface UserCounts {
  total: number | null
  last7d: number | null
}

export async function getUserCounts(now: Date = new Date()): Promise<UserCounts> {
  const db = getDb()
  if (!db) return { total: null, last7d: null }
  try {
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const [[totalRow], [weekRow]] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(user),
      db.select({ count: sql<number>`count(*)` }).from(user).where(gte(user.createdAt, since)),
    ])
    return {
      total: Number(totalRow?.count ?? 0),
      last7d: Number(weekRow?.count ?? 0),
    }
  } catch {
    return { total: null, last7d: null }
  }
}
