import type { ReactNode } from 'react'
import AdminPageHeader, { AdminPageShell } from '@/components/admin/AdminPageHeader'
import type { ImprovementFinding } from '@/lib/improvement-findings'
import type { SupportTicket } from '@/lib/support-tickets'
import type { AdminMcpTokenRow, AdminMcpCallerRow } from '@/lib/admin-mcp'
import Sparkline from '@/components/admin/Sparkline'

// What the machines did — read-only, every figure a counted row:
//   Development · self-improvement findings (ADR 0007 class (a): detected by
//     the health sentinel, filed to Linear when configured). Dev-run history
//     itself lives in docs/autonomy-log.md + the Linear hop project.
//   Support · the support agent's drafted replies and what the owner sent.
//   MCP · agents calling hop's engine, bucketed per day.
// Flat editorial, internal tool — mirrors AdminDashboard's vocabulary.
export default function AgentActivity({
  findings,
  tickets,
  dayBuckets,
  toolCounts,
  mcpWindowDays,
  mcpTokens,
  mcpCallers,
}: {
  findings: ImprovementFinding[] | null
  tickets: SupportTicket[]
  /** MCP calls per day, oldest → newest (server-bucketed). null = degraded. */
  dayBuckets: number[] | null
  /** [tool, calls] pairs, busiest first (server-counted). null = degraded. */
  toolCounts: Array<[string, number]> | null
  mcpWindowDays: number
  /** Token inventory across all users, newest-minted first. null = degraded. */
  mcpTokens: AdminMcpTokenRow[] | null
  /** Busiest callers in the window, ranked. null = degraded. */
  mcpCallers: AdminMcpCallerRow[] | null
}) {
  const drafted = tickets.filter((t) => t.draftReply && !t.repliedAt).length
  const sent = tickets.filter((t) => t.repliedAt).length

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Agents"
        description={
          <>
            What the machines did — findings filed, replies drafted, engine calls made. Dev-run
            history lives in{' '}
            <a
              href="https://github.com/n3wth/hop/blob/main/docs/autonomy-log.md"
              className="font-medium text-text2 underline-offset-2 transition-colors hover:text-text hover:underline"
            >
              the autonomy log
            </a>{' '}
            and{' '}
            <a
              href="https://linear.app/newth/project/hop-9365da373b9a"
              className="font-medium text-text2 underline-offset-2 transition-colors hover:text-text hover:underline"
            >
              Linear
            </a>
            .
          </>
        }
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Agents' },
        ]}
      />

      <div className="mt-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
        <Section title="Development — self-improvement loop">
          {findings === null ? (
            <Empty>Findings are unavailable.</Empty>
          ) : findings.length === 0 ? (
            <Empty>No open findings — the sentinel has nothing to report.</Empty>
          ) : (
            <div className="flex flex-col gap-2">
              {findings.map((f) => (
                <div key={f.id} className="rounded-[12px] border border-border bg-paper px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0 truncate text-[13px] font-semibold text-text">{f.title}</div>
                    <span className="flex-shrink-0 text-[11px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-text3">
                      {f.severity}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[12px] text-text3">
                    <span>{f.kind}</span>
                    {f.linearIdentifier ? (
                      <a
                        href={`https://linear.app/newth/issue/${f.linearIdentifier}`}
                        className="font-medium text-text2 underline-offset-2 transition-colors hover:text-text hover:underline"
                      >
                        {f.linearIdentifier}
                      </a>
                    ) : null}
                    {f.lastSeenAt ? <span>last seen {fmtDate(f.lastSeenAt)}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Support — drafted by the agent">
          <div className="grid grid-cols-2 gap-3">
            <Tile value={drafted} label="Drafts awaiting your review" />
            <Tile value={sent} label="Replies sent" />
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {tickets
              .filter((t) => t.repliedAt)
              .slice(0, 5)
              .map((t) => (
                <div key={t.id} className="rounded-[12px] border border-border bg-paper px-3 py-2.5">
                  <div className="truncate text-[13px] font-semibold text-text">{t.fromEmail}</div>
                  <div className="truncate text-[12px] text-text3">
                    replied {fmtDate(t.repliedAt)} · {t.subject || '(no subject)'}
                  </div>
                </div>
              ))}
          </div>
        </Section>
      </div>

      <Section title={`Engine calls (MCP) — last ${mcpWindowDays} days`}>
        {dayBuckets === null || toolCounts === null ? (
          <Empty>MCP usage is unavailable.</Empty>
        ) : (
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <div className="hop-num text-[22px] font-semibold text-text">
                {dayBuckets.reduce((a, b) => a + b, 0)}
              </div>
              <div className="mt-1 text-[12.5px] text-text3">tool calls</div>
              <div className="mt-2">
                <Sparkline data={dayBuckets} label="MCP tool calls per day" width={168} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {toolCounts.slice(0, 6).map(([tool, count]) => (
                <div key={tool} className="flex items-baseline gap-3 text-[13px]">
                  <span className="hop-num w-10 text-right font-semibold text-text">{count}</span>
                  <span className="font-mono text-[12.5px] text-text2">{tool}</span>
                </div>
              ))}
              {toolCounts.length === 0 ? (
                <span className="text-[13px] text-text3">No calls in the window.</span>
              ) : null}
            </div>
          </div>
        )}
      </Section>

      <div className="lg:grid lg:grid-cols-2 lg:gap-x-8">
        <Section title={`Top MCP callers — last ${mcpWindowDays} days`}>
          {mcpCallers === null ? (
            <Empty>Caller ranking is unavailable.</Empty>
          ) : mcpCallers.length === 0 ? (
            <Empty>No calls in the window.</Empty>
          ) : (
            <div className="flex flex-col gap-1.5">
              {mcpCallers.slice(0, 10).map((c, i) => (
                <div
                  key={`${c.userId ?? 'unlinked'}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-paper px-3 py-2"
                >
                  <span className="truncate text-[12.5px] font-semibold text-text">
                    {c.email ?? 'Unlinked / stateless'}
                  </span>
                  <span className="flex-shrink-0 text-[12px] text-text3">
                    {c.callCount} call{c.callCount === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="MCP token inventory">
          {mcpTokens === null ? (
            <Empty>Token inventory is unavailable.</Empty>
          ) : mcpTokens.length === 0 ? (
            <Empty>No tokens minted yet.</Empty>
          ) : (
            <div className="flex flex-col gap-1.5">
              {mcpTokens.slice(0, 10).map((t, i) => (
                <div
                  key={`${t.email}-${t.lastFour}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-paper px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-semibold text-text">
                      {t.email}
                      {t.name ? <span className="font-normal text-text3"> · {t.name}</span> : null}
                    </div>
                    <div className="font-mono text-[11px] text-text3">…{t.lastFour}</div>
                  </div>
                  <span className="flex-shrink-0 text-right text-[11.5px] text-text3">
                    {t.lastUsedAt ? `used ${fmtDate(t.lastUsedAt)}` : 'never used'}
                    <br />
                    <span className="text-text3/70">no cap configured yet</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </AdminPageShell>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[11px] font-bold uppercase tracking-[var(--track-eyebrow)] text-brand">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-border bg-paper/50 px-4 py-6 text-center text-[13px] text-text3">
      {children}
    </div>
  )
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[14px] border border-border bg-paper p-4">
      <div className="hop-num text-[22px] font-semibold text-text">{value}</div>
      <div className="mt-1 text-[12.5px] text-text3">{label}</div>
    </div>
  )
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
