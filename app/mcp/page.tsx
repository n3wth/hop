import Link from 'next/link'
import Card from '@/components/ui/Card'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import EditorialHeader from '@/components/EditorialHeader'
import Icon from '@/components/Icon'
import { pageMeta, SITE_URL } from '@/lib/seo'
import { MCP_DAILY_LIMITS } from '@/lib/subscription'

// Public "use hop from your AI agent" surface (R2.1) — the MCP server itself
// (app/api/[transport]/route.ts) has been live since before this page existed;
// this is the discoverable front door for it (previously reachable only after
// sign-in, inside /account's McpAccess panel). No per-request data, so it
// prerenders like the rest of the SEO mesh.
export const dynamic = 'force-static'

export const metadata = pageMeta({
  title: 'hop for AI agents (MCP)',
  description:
    "Give Cursor, VS Code, or any MCP client hop's points-vs-cash verdict engine: computed cpp, transfer paths, and sweet spots — never LLM-generated numbers.",
  path: '/mcp',
})

const MCP_URL = `${SITE_URL}/api/mcp`

interface Tool {
  name: string
  description: string
}

// Mirrors the six server.tool() registrations in app/api/[transport]/route.ts —
// keep the names and one-line descriptions in sync if a tool is added/renamed.
const TOOLS: Tool[] = [
  {
    name: 'price_trip',
    description:
      "Price one destination: typical award miles, cash, cents-per-point, what you can put toward it, and a points/cash verdict.",
  },
  {
    name: 'verdict',
    description:
      'Full points-vs-cash call for a route — verdict, summary (cheapest cash, best miles, best cpp, $ saved), the pick, and the top options.',
  },
  {
    name: 'sweet_spots',
    description: "hop's top-value award redemptions ranked by cents-per-point.",
  },
  {
    name: 'transfer_paths',
    description:
      'Transfer reachability for a program — outbound partners with ratios, or which bank currencies reach it.',
  },
  {
    name: 'compare_programs',
    description:
      'Named loyalty programs head-to-head on a route, ranked by cents-per-point, with afford-it-or-not when balances are supplied.',
  },
  {
    name: 'best_card_for_program',
    description:
      'Top points-earning card for a program — issuer, earn rate, welcome bonus, annual fee, apply link.',
  },
]

const MCP_CONFIG_JSON = `{
  "mcpServers": {
    "hop": {
      "url": "${MCP_URL}",
      "headers": { "Authorization": "Bearer <your-hop-token>" }
    }
  }
}`

function ConfigBlock({ label, body }: { label: string; body: string }) {
  return (
    <Card surface="sunk" radius="sm" className="mt-3 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[var(--track-label)] text-text2">
        {label}
      </div>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[12.5px] leading-[1.5] text-text">
        {body}
      </pre>
    </Card>
  )
}

export default function McpLandingPage() {
  return (
    <AppShell user={null} hideSearch>
      <div className="mx-auto max-w-[var(--container-shell)]">
        <EditorialHeader
          eyebrow="For AI agents"
          title="The points engine, as a tool call"
          titleMaxW="max-w-[26ch]"
          intro="Every award tool can tell an agent a seat exists. hop tells it whether to burn points on it. Six tools, deterministic math, no LLM-generated numbers."
          introMaxW="max-w-[58ch]"
        >
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[13px] text-text3">
            <span>
              <b className="font-semibold text-text2">{TOOLS.length}</b> tools
            </span>
            <span className="hidden sm:inline">·</span>
            <span>streamable HTTP + legacy SSE</span>
            <span className="hidden sm:inline">·</span>
            <span>works with no token, personalized with one</span>
          </div>
        </EditorialHeader>

        {/* server URL + quickstart — static text; no token minted here (that
            needs a signed-in account, see McpAccess on /account). Stateless
            calls (no Authorization header) work today with caller-supplied
            balances, so a visitor can try this before signing in. */}
        <section className="mx-auto mt-12 max-w-[640px]">
          <Card surface="paper" radius="lg" className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[var(--track-label)] text-text2">
                  MCP server URL
                </div>
                <code className="mt-1 block truncate font-mono text-[13.5px] text-text">
                  {MCP_URL}
                </code>
              </div>
            </div>
            <p className="mt-4 text-[13.5px] leading-[1.55] text-text2">
              Point any MCP client at this URL over streamable HTTP. Without a token the tools
              still run — pass balances directly in the call, or link a hop account for a
              personalized read.{' '}
              <Link href="/account" className="font-semibold text-brand hover:text-brand-deep">
                Sign in to mint a token
              </Link>
              .
            </p>

            <ConfigBlock label="mcp_config.json" body={MCP_CONFIG_JSON} />
            <p className="mt-3 text-[12px] leading-[1.5] text-text2">
              Cursor / VS Code / any MCP client: add the server URL above with an Authorization header
              (or pass balances directly in tool calls without a token).
            </p>
          </Card>

          <p className="mt-4 text-center text-[13px] text-text3">
            No token: rate-limited per IP to stop abuse, no daily cap tracked. Link a hop token
            for a durable quota — Free{' '}
            <b className="font-semibold text-text2">{MCP_DAILY_LIMITS.free}</b> calls/day, Pro{' '}
            <b className="font-semibold text-text2">{MCP_DAILY_LIMITS.premium.toLocaleString('en-US')}</b>/day.
          </p>
        </section>

        {/* tool reference */}
        <section className="mt-16">
          <h2 className="text-center font-display text-[24px] font-semibold tracking-[-0.01em] text-text">
            The tools
          </h2>
          <div className="mx-auto mt-6 grid max-w-[900px] grid-cols-1 gap-4 sm:grid-cols-2">
            {TOOLS.map((t) => (
              <Card key={t.name} surface="paper" radius="lg" className="p-5">
                <div className="flex items-center gap-2">
                  <Icon name="settings" size={16} />
                  <code className="font-mono text-[14px] font-semibold text-text">{t.name}</code>
                </div>
                <p className="mt-2 text-[13.5px] leading-[1.5] text-text2">{t.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <div className="mx-auto mt-10 flex max-w-[900px] flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[14px]">
          <span className="text-text3">Keep exploring:</span>
          <Link href="/guides" className="font-semibold text-brand hover:text-brand-deep">
            Program guides
          </Link>
          <Link href="/sweet-spots" className="font-semibold text-brand hover:text-brand-deep">
            Sweet spots
          </Link>
          <Link href="/pricing" className="font-semibold text-brand hover:text-brand-deep">
            Pricing
          </Link>
          <Link href="/search" className="font-semibold text-brand hover:text-brand-deep">
            Run a search
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-[var(--container-shell)]">
        <SiteFooter />
      </div>
    </AppShell>
  )
}
