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
