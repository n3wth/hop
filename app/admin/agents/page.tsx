import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getOwnerSession } from '@/lib/owner'
import { listOpenFindings } from '@/lib/improvement-findings'
import { listRecentTickets } from '@/lib/support-tickets'
import { mcpUsageSummary } from '@/lib/mcp-usage'
import { listMcpTokens, listTopMcpCallers } from '@/lib/admin-mcp'
import AgentActivity from '@/components/admin/AgentActivity'

// Owner-only agent-activity surface: what the machines did — the
// self-improvement loop's filed findings (development), the support agent's
// drafted/sent replies (support), and MCP tool calls (agents using hop).
// Every figure is a counted row from an existing ledger; nothing is narrated.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Agents',
  robots: { index: false, follow: false },
}

const MCP_WINDOW_DAYS = 14

export default async function AdminAgentsPage() {
  // notFound (not 403) so the route doesn't confirm it exists to non-owners.
  if (!(await getOwnerSession())) notFound()

  const [findings, tickets, mcp, mcpTokens, mcpCallers] = await Promise.all([
    listOpenFindings(),
    listRecentTickets(20),
    mcpUsageSummary(MCP_WINDOW_DAYS),
    listMcpTokens(),
    listTopMcpCallers(MCP_WINDOW_DAYS),
  ])

  return (
    <AgentActivity
      findings={findings}
      // listRecentTickets is null on a failed read; this surface only counts
      // drafted/sent, so an empty list is an acceptable degradation here.
      tickets={tickets ?? []}
      dayBuckets={mcp?.dayBuckets ?? null}
      toolCounts={mcp?.toolCounts ?? null}
      mcpWindowDays={MCP_WINDOW_DAYS}
      mcpTokens={mcpTokens}
      mcpCallers={mcpCallers}
    />
  )
}
