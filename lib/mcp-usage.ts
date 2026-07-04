// Fire-and-forget usage log for the MCP server (app/api/[transport]/route.ts) —
// growth-hypothesis day-30 target: first metered B2B user. One row per
// successful tool call (hop_mcp_usage). NO economics, NO request payload —
// just who/what/when, enough to meter and to spot a heavy caller. Same
// contract as lib/degradation-telemetry.ts#recordDegradation: synchronous
// (void), fires the insert internally, and can NEVER throw or reject to the
// caller — a logging bug must never fail an MCP tool call.

import { withDb } from '@/lib/supabase-helpers'

const TABLE = 'hop_mcp_usage'

export interface McpUsageEvent {
  userId?: string | null
  tokenId?: string | null
  tool: string
}

// Recent usage rows for the admin agent-activity surface — tool + stamp only
// (no payloads exist to leak). null on any failure, never a throw; the surface
// then shows "unavailable" instead of a fabricated zero.
export interface McpUsageRow {
  tool: string
  createdAt: string | null
}

export async function listMcpUsageSince(sinceIso: string): Promise<McpUsageRow[] | null> {
  return withDb<McpUsageRow[] | null>(null, async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select('tool, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(2000)
    if (error || !Array.isArray(data)) return null
    return (data as Array<{ tool: string; created_at: string | null }>).map((r) => ({
      tool: r.tool,
      createdAt: r.created_at,
    }))
  })
}

// Aggregated view for the admin Agents surface: calls bucketed per day
// (oldest → newest) plus per-tool totals, busiest first. Lives here (not in a
// component) so render stays pure — the clock and the counting are I/O-side.
// null on any failure, matching every other accessor.
export interface McpUsageSummary {
  dayBuckets: number[]
  toolCounts: Array<[string, number]>
  windowDays: number
}

export async function mcpUsageSummary(
  windowDays: number,
  now: Date = new Date(),
): Promise<McpUsageSummary | null> {
  const DAY = 24 * 60 * 60 * 1000
  const end = now.getTime()
  const start = end - windowDays * DAY
  const rows = await listMcpUsageSince(new Date(start).toISOString())
  if (rows === null) return null
  const dayBuckets = new Array<number>(windowDays).fill(0)
  const byTool = new Map<string, number>()
  for (const row of rows) {
    byTool.set(row.tool, (byTool.get(row.tool) ?? 0) + 1)
    const ms = row.createdAt ? Date.parse(row.createdAt) : NaN
    if (!Number.isFinite(ms) || ms < start || ms >= end) continue
    dayBuckets[Math.floor((ms - start) / DAY)]++
  }
  const toolCounts = [...byTool.entries()].sort((a, b) => b[1] - a[1])
  return { dayBuckets, toolCounts, windowDays }
}

export function recordMcpUsage({ userId, tokenId, tool }: McpUsageEvent): void {
  if (typeof tool !== 'string' || tool.trim() === '') return
  try {
    void withDb(false, async (db) => {
      const { error } = await db.from(TABLE).insert({
        user_id: userId ?? null,
        token_id: tokenId ?? null,
        tool,
      })
      return !error
    })
  } catch {
    // Unreachable in practice (withDb never throws) — guarded anyway per the
    // fire-and-forget contract.
  }
}
