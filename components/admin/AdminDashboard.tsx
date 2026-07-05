import type { ReactNode } from 'react'
import Link from 'next/link'
import type { BusinessDigest, WeeklyMetric } from '@/lib/business-digest'
import type { CronHeartbeat } from '@/lib/cron-heartbeat'
import type { DegradationWindowCounts } from '@/lib/degradation-telemetry'
import type { ImprovementFinding } from '@/lib/improvement-findings'
import type { SupportTicket } from '@/lib/support-tickets'
import type { Escalation } from '@/lib/escalation'
import { CRON_JOBS } from '@/lib/health-checks'
import Sparkline from '@/components/admin/Sparkline'

interface Props {
  ownerEmail: string
  digest: BusinessDigest
  heartbeats: CronHeartbeat[] | null
  degradation: DegradationWindowCounts | null
  findings: ImprovementFinding[] | null
  /** null = the read failed (unknown), [] = genuinely empty. */
  recentTickets: SupportTicket[] | null
  recentEscalations: Escalation[] | null
  /** Whether HOP_ENABLE_SELF_IMPROVE is on — explains a null health section. */
  selfImproveEnabled: boolean
  /** Registered-user counts (lib/admin-stats). null = unknown, not zero. */
  usersTotal: number | null
  usersNew7d: number | null
  /** Preflight seams needing attention (drift/warn) — the /admin/ops badge. */
  preflightIssues: number
}

// The owner-gated ops overview: this week's funnel numbers, cron/degradation
// health, open self-improvement findings, and a recent-activity preview.
// Read-only — every figure comes from an existing lib/* accessor, so this
// component is pure presentation. Flat-editorial, internal tool (mirrors
// components/admin/SupportConsole.tsx).
export default function AdminDashboard({
  ownerEmail,
  digest,
  heartbeats,
  degradation,
  findings,
  recentTickets,
  recentEscalations,
  selfImproveEnabled,
  usersTotal,
  usersNew7d,
  preflightIssues,
}: Props) {
  return (
    <div className="max-w-[var(--container-shell)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.01em] text-text">Admin</h1>
          <p className="mt-1 text-[13px] text-text3">Signed in as {ownerEmail}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/ops"
            className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
              preflightIssues > 0
                ? 'border-ok bg-ok-bg text-ok hover:bg-sunk'
                : 'border-border bg-surface text-text2 hover:bg-sunk'
            }`}
          >
            {preflightIssues > 0 ? `Ops · ${preflightIssues} to review →` : 'Ops →'}
          </Link>
          <Link
            href="/admin/support"
            className="rounded-full border border-border bg-surface px-3.5 py-2 text-[13px] font-semibold text-text2 transition-colors hover:bg-sunk"
          >
            Inbox →
          </Link>
        </div>
      </div>

      <Section title="This week">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Stat label="Registered users" value={usersTotal} />
          <Stat label="New sign-ups" value={usersNew7d} sub="7 days" />
          <Stat label="Active users" metric={digest.activeUsers} sub="7-day sessions" />
          <Stat label="Booking requests" metric={digest.escalations} />
          <Stat label="New watches" metric={digest.ordersCreated} />
          <Stat label="Alerts fired" metric={digest.alertsFired} />
          <Stat label="Active watches" value={digest.activeWatches} />
          <Stat label="Paid subscribers" value={digest.activeSubscriptions} />
          <Stat
            label="Card outclicks"
            metric={digest.outclicks}
            sub={
              digest.outclicks && digest.outclicks.total !== null && digest.outclicks.total !== digest.outclicks.count
                ? `${digest.outclicks.total} total`
                : undefined
            }
          />
        </div>
      </Section>

      {/* Wide screens: health + findings side by side; below lg they stack. */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-x-8">
      <Section title="System health">
        {heartbeats === null && degradation === null ? (
          <Empty>
            {selfImproveEnabled
              ? 'No health data yet.'
              : 'Monitoring is off (HOP_ENABLE_SELF_IMPROVE).'}
          </Empty>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {CRON_JOBS.map((spec) => (
                <HeartbeatRow key={spec.job} spec={spec} heartbeat={heartbeats?.find((h) => h.job === spec.job) ?? null} />
              ))}
            </div>
            {degradation ? <DegradationList degradation={degradation} /> : null}
          </div>
        )}
      </Section>

      <Section title="Open findings">
        {!findings || findings.length === 0 ? (
          <Empty>{findings === null ? 'Findings are unavailable.' : 'No open findings.'}</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {findings
              .slice()
              .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'p1' ? -1 : 1))
              .map((f) => (
                <FindingRow key={f.id} finding={f} />
              ))}
          </div>
        )}
      </Section>
      </div>

      <Section title="Recent activity">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-[12px] font-semibold text-text2">Support tickets</h3>
            <div className="mt-2 flex flex-col gap-2">
              {recentTickets === null ? (
                <Empty>Tickets unavailable.</Empty>
              ) : recentTickets.length === 0 ? (
                <Empty>No tickets yet.</Empty>
              ) : (
                recentTickets.map((t) => (
                  <Link
                    key={t.id}
                    href="/admin/support"
                    className="block rounded-[var(--radius-sm)] border border-border bg-paper px-3 py-2.5 transition-colors hover:bg-sunk"
                  >
                    <div className="truncate text-[13px] font-semibold text-text">{t.fromEmail}</div>
                    <div className="truncate text-[12px] text-text3">{t.subject || '(no subject)'}</div>
                  </Link>
                ))
              )}
            </div>
          </div>
          <div>
            <h3 className="text-[12px] font-semibold text-text2">Booking requests</h3>
            <div className="mt-2 flex flex-col gap-2">
              {recentEscalations === null ? (
                <Empty>Booking requests unavailable.</Empty>
              ) : recentEscalations.length === 0 ? (
                <Empty>No booking requests yet.</Empty>
              ) : (
                recentEscalations.map((e) => (
                  <Link
                    key={e.id}
                    href="/admin/support"
                    className="block rounded-[var(--radius-sm)] border border-border bg-paper px-3 py-2.5 transition-colors hover:bg-sunk"
                  >
                    <div className="truncate text-[13px] font-semibold text-text">{e.email}</div>
                    <div className="truncate text-[12px] text-text3">{fmtDate(e.createdAt) || 'no date'}</div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
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

// A single stat tile — either a WeeklyMetric (count + last-week delta + weekly
// trend sparkline) or a plain point-in-time number. `value === null` /
// `metric === null` both read as "degraded", not zero — the em dash makes that
// visible instead of lying; a degraded trend simply drops the line.
function Stat({
  label,
  metric,
  value,
  sub,
}: {
  label: string
  metric?: WeeklyMetric | null
  value?: number | null
  sub?: string
}) {
  const count = metric !== undefined ? metric?.count ?? null : value ?? null
  const prev = metric?.prev ?? null
  const trend = metric?.trend ?? null
  return (
    <div className="rounded-[14px] border border-border bg-paper p-4">
      <div className="hop-num text-[22px] font-semibold text-text">{count === null ? '—' : count}</div>
      <div className="mt-1 text-[12.5px] text-text3">{label}</div>
      {trend ? (
        <div className="mt-2">
          <Sparkline data={trend} label={label} />
        </div>
      ) : null}
      {prev !== null ? <div className="mt-1 text-[11.5px] text-text3">last week {prev}</div> : null}
      {sub ? <div className="mt-1 text-[11.5px] text-text3">{sub}</div> : null}
    </div>
  )
}

type Tone = 'good' | 'ok' | 'weak' | 'muted'

const TONE_CLASS: Record<Tone, string> = {
  good: 'bg-good',
  ok: 'bg-ok',
  weak: 'bg-weak',
  muted: 'bg-text3',
}

function heartbeatStatus(
  spec: (typeof CRON_JOBS)[number],
  hb: CronHeartbeat | null,
): { label: string; tone: Tone } {
  if (!hb) return { label: 'never run', tone: 'weak' }
  if (!hb.ok) return { label: hb.note === 'disabled' ? 'disabled' : hb.note || 'failed', tone: hb.note === 'disabled' ? 'muted' : 'weak' }
  const age = Date.now() - Date.parse(hb.lastRunAt)
  if (!Number.isFinite(age)) return { label: 'unknown', tone: 'muted' }
  if (age > spec.expectedIntervalMs * 2) return { label: `stale · ${fmtAge(age)} ago`, tone: 'ok' }
  return { label: `ran ${fmtAge(age)} ago`, tone: 'good' }
}

function HeartbeatRow({ spec, heartbeat }: { spec: (typeof CRON_JOBS)[number]; heartbeat: CronHeartbeat | null }) {
  const status = heartbeatStatus(spec, heartbeat)
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-paper px-3.5 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${TONE_CLASS[status.tone]}`} aria-hidden />
        <span className="text-[13px] font-semibold text-text">{spec.job}</span>
      </div>
      <span className="text-[12px] text-text3">{status.label}</span>
    </div>
  )
}

function DegradationList({ degradation }: { degradation: DegradationWindowCounts }) {
  const sources = Array.from(
    new Set([...Object.keys(degradation.last24h), ...Object.keys(degradation.priorWeekDailyMean)]),
  ).sort()
  if (sources.length === 0) {
    return <Empty>No degraded upstream sources in the last 8 days.</Empty>
  }
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[12px] font-semibold text-text2">Degraded sources (last 24h vs. prior daily mean)</h3>
      {sources.map((source) => {
        const last24h = degradation.last24h[source] ?? 0
        const mean = degradation.priorWeekDailyMean[source] ?? 0
        const elevated = last24h > 0 && last24h > mean * 2 + 2
        return (
          <div
            key={source}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-paper px-3.5 py-2.5"
          >
            <span className="text-[13px] font-semibold text-text">{source}</span>
            <span className={`text-[12px] ${elevated ? 'text-warn' : 'text-text3'}`}>
              {last24h} today · {mean.toFixed(1)}/day baseline
            </span>
          </div>
        )
      })}
    </div>
  )
}

function FindingRow({ finding }: { finding: ImprovementFinding }) {
  const tone: Tone = finding.severity === 'p1' ? 'weak' : 'ok'
  return (
    <div className="rounded-[14px] border border-border bg-paper p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[var(--track-eyebrow)] ${
              tone === 'weak' ? 'bg-weak-bg text-weak' : 'bg-ok-bg text-ok'
            }`}
          >
            {finding.severity}
          </span>
          <span className="text-[13.5px] font-semibold text-text">{finding.title}</span>
        </div>
        {finding.linearIdentifier ? (
          <span className="flex-shrink-0 text-[11.5px] text-text3">{finding.linearIdentifier}</span>
        ) : null}
      </div>
      <p className="mt-2 text-[13px] leading-[1.5] text-text2">{finding.body}</p>
      <div className="mt-2 text-[11.5px] text-text3">
        first seen {fmtDate(finding.firstSeenAt) || 'unknown'} · last seen {fmtDate(finding.lastSeenAt) || 'unknown'}
      </div>
    </div>
  )
}

function fmtAge(ms: number): string {
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return ''
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
