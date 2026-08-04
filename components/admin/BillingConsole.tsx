import type { ReactNode } from 'react'
import AdminPageHeader, { AdminPageShell } from '@/components/admin/AdminPageHeader'
import Card from '@/components/ui/Card'
import Eyebrow from '@/components/ui/Eyebrow'
import type { BillingOverview } from '@/lib/admin-billing'

interface Props {
  overview: BillingOverview
  billingEnabled: boolean
}

// /admin/billing — MRR, subscriber status breakdown, and the recent
// subscriptions list. MRR is the SAME figure Overview's unit-economics tile
// shows (lib/unit-economics.ts#computeMrr, reused not re-derived); this page
// adds the status breakdown + subscriber list Overview doesn't have room for.
// Read-only. Flat editorial, mirrors OpsPanel/UsersTable's vocabulary. Each
// section degrades independently — getBillingOverview only nulls the section
// whose own query failed, so e.g. a status-breakdown outage doesn't blank the
// MRR tile or the recent-subscriptions list.
export default function BillingConsole({ overview, billingEnabled }: Props) {
  const zeroDespiteEnabled =
    overview.recent !== null && overview.recent.length === 0 && billingEnabled

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Billing"
        description="MRR, subscriber mix, and recent activity."
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Billing' },
        ]}
      />

      <Section title="Overview">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile
            value={overview.mrrUsd === null ? '—' : `$${overview.mrrUsd.toFixed(2)}`}
            label="MRR"
            sub={overview.mrrUsd === null ? 'no monthly price id configured' : undefined}
          />
          <Tile
            value={overview.activePaidCount === null ? '—' : String(overview.activePaidCount)}
            label="Paying (in MRR)"
            sub="recognized price id, unexpired period"
          />
          {STATUS_ORDER.filter((s) => s !== 'active' && s !== 'trialing').map((s) => (
            <Tile
              key={s}
              value={overview.statusCounts === null ? '—' : String(overview.statusCounts[s] ?? 0)}
              label={STATUS_LABEL[s] ?? s}
            />
          ))}
        </div>
        {zeroDespiteEnabled ? (
          <p className="mt-3 text-[12px] text-text3">
            Billing is on but no subscriptions exist yet — if a customer has actually paid, check
            the checkout-webhook wiring (known open item: verify <code>hop_customers</code> rows are
            being created).
          </p>
        ) : null}
      </Section>

      <Section title="Status breakdown">
        {overview.statusCounts === null ? (
          <Empty>Couldn&apos;t load status breakdown — try again shortly.</Empty>
        ) : Object.keys(overview.statusCounts).length === 0 ? (
          <Empty>No subscriptions recorded yet.</Empty>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(overview.statusCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center gap-2 rounded-full border border-border bg-paper px-3 py-1.5"
                >
                  <StatusPill status={status} />
                  <span className="hop-num text-[13px] font-semibold text-text">{count}</span>
                </div>
              ))}
          </div>
        )}
      </Section>

      <Section title="Recent subscriptions">
        {overview.recent === null ? (
          <Empty>Couldn&apos;t load recent subscriptions — try again shortly.</Empty>
        ) : overview.recent.length === 0 ? (
          <Empty>No subscriptions yet.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {overview.recent.map((s, i) => (
              <Card
                key={`${s.email}-${i}`}
                surface="paper"
                radius="sm"
                className="flex flex-col gap-1 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-semibold text-text">{s.email}</div>
                  <div className="truncate font-mono text-[11.5px] text-text3">{s.priceId}</div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3 text-[12px] text-text3">
                  <StatusPill status={s.status} />
                  {s.cancelAtPeriodEnd ? (
                    <span className="text-weak">cancels {fmtDate(s.currentPeriodEnd)}</span>
                  ) : (
                    <span>renews {fmtDate(s.currentPeriodEnd)}</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </AdminPageShell>
  )
}

const STATUS_ORDER = ['active', 'trialing', 'past_due', 'canceled'] as const

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  trialing: 'Trialing',
  past_due: 'Past due',
  canceled: 'Canceled',
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-good-bg text-good',
  trialing: 'bg-good-bg text-good',
  past_due: 'bg-ok-bg text-ok',
  canceled: 'bg-sunk text-text3',
  unpaid: 'bg-weak-bg text-weak',
  incomplete: 'bg-sunk text-text3',
  incomplete_expired: 'bg-sunk text-text3',
  paused: 'bg-sunk text-text3',
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[var(--track-eyebrow)] ${STATUS_STYLE[status] ?? 'bg-sunk text-text3'}`}
    >
      {status}
    </span>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <Eyebrow as="h2" className="font-bold text-brand">{title}</Eyebrow>
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

function Tile({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <Card surface="paper" radius="md" className="p-4">
      <div className="hop-num text-[20px] font-semibold text-text">{value}</div>
      <div className="mt-1 text-[12.5px] text-text3">{label}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-text3">{sub}</div> : null}
    </Card>
  )
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return ''
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
