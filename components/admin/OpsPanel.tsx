import type { ReactNode } from 'react'
import type { PreflightRow, PreflightStatus } from '@/lib/admin-ops'
import type { DegradationEventRow } from '@/lib/degradation-telemetry'
import type { ValuationOverride } from '@/lib/valuation-overrides'
import type { ActiveStandingOrder } from '@/lib/standing-orders'
import type { OutclickRow, OutclickSummary } from '@/lib/outclicks'

interface Props {
  preflight: PreflightRow[]
  degradationEvents: DegradationEventRow[] | null
  selfImproveEnabled: boolean
  valuationEnabled: boolean
  valuationOverrides: ValuationOverride[]
  watches: ActiveStandingOrder[]
  outclickSummary: OutclickSummary | null
  recentOutclicks: OutclickRow[] | null
}

// /admin/ops — the launch-ops console: every flag seam's real state (the R0.4
// "are the lights on?" answer), the revenue-click ledger, the degradation
// drilldown, valuation-sync progress, and the live watch list. Read-only
// composition of lib/* accessors; flat editorial, mirrors AdminDashboard.
export default function OpsPanel({
  preflight,
  degradationEvents,
  selfImproveEnabled,
  valuationEnabled,
  valuationOverrides,
  watches,
  outclickSummary,
  recentOutclicks,
}: Props) {
  return (
    <div className="max-w-[var(--container-shell)] px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="font-display text-2xl font-semibold tracking-[-0.01em] text-text">Ops</h1>
      <p className="mt-1 text-[13px] text-text3">
        Flag seams, revenue ledger, degradation, and watches — what&apos;s actually on.
      </p>

      <Section title="Preflight">
        <div className="flex flex-col gap-2">
          {preflight.map((row) => (
            <div
              key={row.seam}
              className="flex flex-col gap-1 rounded-[var(--radius-sm)] border border-border bg-paper px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <div className="flex items-center gap-2.5">
                <StatusPill status={row.status} />
                <span className="text-[13px] font-semibold text-text">{row.seam}</span>
              </div>
              <span className="text-[12px] text-text3 sm:text-right">{row.detail}</span>
            </div>
          ))}
        </div>
      </Section>

      <div className="lg:grid lg:grid-cols-2 lg:gap-x-8">
        <Section title="Revenue clicks (7 days)">
          {outclickSummary === null ? (
            <Empty>Outclick ledger unavailable.</Empty>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-3">
                <MiniStat label="Total" value={outclickSummary.total} />
                <MiniStat label="Cash (Kiwi)" value={outclickSummary.last7d.cash ?? 0} />
                <MiniStat label="Card" value={outclickSummary.last7d.card ?? 0} />
              </div>
              {recentOutclicks === null || recentOutclicks.length === 0 ? (
                <Empty>
                  {recentOutclicks === null ? 'Recent clicks unavailable.' : 'No clicks yet.'}
                </Empty>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {recentOutclicks.map((c, i) => (
                    <div
                      key={`${c.createdAt}-${i}`}
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-paper px-3 py-2"
                    >
                      <span className="text-[12.5px] font-semibold text-text">
                        {c.kind} · {c.target}
                        {c.program ? <span className="font-normal text-text3"> · {c.program}</span> : null}
                      </span>
                      <span className="flex-shrink-0 text-[11.5px] text-text3">{fmtDate(c.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>

        <Section title="Degradation events">
          {degradationEvents === null ? (
            <Empty>
              {selfImproveEnabled
                ? 'Degradation log unavailable.'
                : 'Monitoring is off (HOP_ENABLE_SELF_IMPROVE).'}
            </Empty>
          ) : degradationEvents.length === 0 ? (
            <Empty>No degradation events recorded.</Empty>
          ) : (
            <div className="flex flex-col gap-1.5">
              {degradationEvents.map((e, i) => (
                <div
                  key={`${e.createdAt}-${i}`}
                  className="rounded-[var(--radius-sm)] border border-border bg-paper px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] font-semibold text-text">
                      {e.source}
                      {e.route ? <span className="font-normal text-text3"> · {e.route}</span> : null}
                    </span>
                    <span className="flex-shrink-0 text-[11.5px] text-text3">{fmtDate(e.createdAt)}</span>
                  </div>
                  {e.reason ? <div className="mt-0.5 text-[12px] text-text2">{e.reason}</div> : null}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-x-8">
        <Section title="Valuation sync">
          {!valuationEnabled ? (
            <Empty>Off (HOP_ENABLE_VALUATION_SYNC + worker URL + secret required).</Empty>
          ) : valuationOverrides.length === 0 ? (
            <Empty>Enabled — no observed programs synced yet.</Empty>
          ) : (
            <div className="flex flex-col gap-1.5">
              {valuationOverrides
                .slice()
                .sort((a, b) => b.sampleSize - a.sampleSize)
                .map((o) => (
                  <div
                    key={o.programId}
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-paper px-3 py-2"
                  >
                    <span className="text-[12.5px] font-semibold text-text">{o.programId}</span>
                    <span className="text-[12px] text-text3">
                      {o.cpp.toFixed(2)}¢ · {o.sampleSize} samples
                      {o.sampleSize >= 20 ? ' · live' : ' · below gate'}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </Section>

        <Section title="Active watches">
          {watches.length === 0 ? (
            <Empty>No active watches.</Empty>
          ) : (
            <div className="flex flex-col gap-1.5">
              {watches.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-paper px-3 py-2"
                >
                  <span className="text-[12.5px] font-semibold text-text">
                    {w.params.from} → {w.params.to}
                    <span className="font-normal text-text3">
                      {' '}
                      · ≥{Number(w.minCpp).toFixed(1)}¢ · {w.seats} seat{w.seats === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="flex-shrink-0 text-[11.5px] text-text3">
                    {w.notifyEmail ? 'email' : 'in-app only'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
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
    <div className="rounded-[var(--radius)] border border-dashed border-border bg-paper/50 px-4 py-6 text-center text-[13px] text-text3">
      {children}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-paper p-3.5">
      <div className="hop-num text-[20px] font-semibold text-text">{value}</div>
      <div className="mt-0.5 text-[12px] text-text3">{label}</div>
    </div>
  )
}

const PILL: Record<PreflightStatus, { label: string; className: string }> = {
  on: { label: 'on', className: 'bg-good-bg text-good' },
  off: { label: 'off', className: 'bg-sunk text-text3' },
  drift: { label: 'drift', className: 'bg-weak-bg text-weak' },
  warn: { label: 'warn', className: 'bg-ok-bg text-ok' },
}

function StatusPill({ status }: { status: PreflightStatus }) {
  const pill = PILL[status]
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[var(--track-eyebrow)] ${pill.className}`}
    >
      {pill.label}
    </span>
  )
}

function fmtDate(iso: string | null): string {
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
