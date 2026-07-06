// Owner-only MCP token + caller visibility — the per-user breakdown
// lib/mcp-usage.ts's mcpUsageSummary() deliberately drops (it aggregates
// day/tool totals globally for the Agents surface's trend chart). This file
// answers "who is calling hop's engine, and with which tokens" — groundwork
// the business plan's B2 (quota tiers) needs before it can gate anything;
// this only surfaces usage, it enforces nothing. Direct Drizzle
// (service-role), same precedent as lib/admin-users.ts and
// lib/admin-billing.ts: joining the auth `user` table needs it. Every export
// is read-only, never throws, null on a degraded db.
//
// SECURITY: token rows NEVER select token_hash — only the display-safe
// columns lib/api-tokens.ts already exposes to token owners themselves
// (id/name/last_four/created_at/last_used_at) plus the owning email.

import { desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { getDb } from './db'
import { apiTokens, mcpUsage, user } from './db/schema'
import { isOwner } from './owner'

export interface AdminMcpTokenRow {
  email: string
  name: string | null
  lastFour: string
  createdAt: string | null
  lastUsedAt: string | null
}

// Newest-minted-first token inventory across ALL users. null = db
// unavailable OR the caller isn't the owner; [] = no tokens minted yet.
//
// DEFENSE IN DEPTH: every /admin page already gates on getOwnerSession()
// before calling in here, but this cross-user read is sensitive enough to
// re-check owner-ness at the source too — so a future call site that forgets
// the page-level gate (an API route, an MCP tool) fails closed instead of
// leaking every user's token inventory.
export async function listMcpTokens(limit = 100): Promise<AdminMcpTokenRow[] | null> {
  if (!(await isOwner())) return null
  const db = getDb()
  if (!db) return null
  try {
    const rows = await db
      .select({
        email: user.email,
        name: apiTokens.name,
        lastFour: apiTokens.lastFour,
        createdAt: apiTokens.createdAt,
        lastUsedAt: apiTokens.lastUsedAt,
      })
      .from(apiTokens)
      .innerJoin(user, eq(apiTokens.userId, user.id))
      .orderBy(desc(apiTokens.createdAt))
      .limit(limit)
    return rows
  } catch (error) {
    console.error('[admin-mcp] listMcpTokens failed:', error)
    return null
  }
}

interface RawCallerRow {
  userId: string | null
  callCount: number
  lastCallAt: string | null
}

export interface AdminMcpCallerRow {
  userId: string | null
  /** null for a genuinely unlinked/anonymous caller, OR when the email lookup itself failed. */
  email: string | null
  callCount: number
  lastCallAt: string | null
}

// Pure: attaches emails to already-grouped-by-userId call counts. A null
// userId is one synthetic "unlinked" row (SQL GROUP BY already merges every
// NULL into a single group, so no separate rollup step is needed) — exported
// so the grouping contract is testable without a DB.
export function attachCallerEmails(
  rows: RawCallerRow[],
  emailMap: Map<string, string>,
): AdminMcpCallerRow[] {
  return rows
    .map((r) => ({
      userId: r.userId,
      email: r.userId ? (emailMap.get(r.userId) ?? null) : null,
      callCount: r.callCount,
      lastCallAt: r.lastCallAt,
    }))
    .sort((a, b) => b.callCount - a.callCount)
}

// Top callers by tool-call volume within the trailing window. null = db
// unavailable OR the caller isn't the owner; [] = no calls in the window.
// Same defense-in-depth re-check as listMcpTokens above.
export async function listTopMcpCallers(
  windowDays = 14,
  limit = 20,
): Promise<AdminMcpCallerRow[] | null> {
  if (!(await isOwner())) return null
  const db = getDb()
  if (!db) return null
  try {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()
    const grouped = await db
      .select({
        userId: mcpUsage.userId,
        callCount: sql<number>`count(*)`,
        lastCallAt: sql<string>`max(${mcpUsage.createdAt})`,
      })
      .from(mcpUsage)
      .where(gte(mcpUsage.createdAt, since))
      .groupBy(mcpUsage.userId)

    const rawRows: RawCallerRow[] = grouped.map((r) => ({
      userId: r.userId,
      callCount: Number(r.callCount),
      lastCallAt: r.lastCallAt,
    }))

    const ids = rawRows.map((r) => r.userId).filter((id): id is string => id !== null)
    const emailRows = ids.length
      ? await db.select({ id: user.id, email: user.email }).from(user).where(inArray(user.id, ids))
      : []
    const emailMap = new Map(emailRows.map((e) => [e.id, e.email]))

    return attachCallerEmails(rawRows, emailMap).slice(0, limit)
  } catch (error) {
    console.error('[admin-mcp] listTopMcpCallers failed:', error)
    return null
  }
}
