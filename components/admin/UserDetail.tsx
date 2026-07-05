import Link from 'next/link'
import type { AdminUserDetail } from '@/lib/admin-users'

interface Props {
  detail: AdminUserDetail
}

// /admin/users/[id] — the owner-only single-account profile: identity,
// subscription state, programs/balances, and a few cross-surface counts
// (watches, bookings). Read-only, mirrors the flat-editorial internal-tool
// style of AdminDashboard/OpsPanel. Every figure comes straight off
// lib/admin-users.ts#getAdminUserDetail — no client-side derivation.
export default function UserDetail({ detail }: Props) {
  return (
    <div className="max-w-[var(--container-shell)] px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/admin/users" className="text-[12.5px] font-medium text-text3 transition-colors hover:text-text">
        ← Users
      </Link>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.01em] text-text">
            {detail.name || detail.email}
          </h1>
          <p className="mt-1 text-[13px] text-text3">{detail.email}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[var(--track-eyebrow)] ${
            detail.tier === 'premium' ? 'bg-good-bg text-good' : 'bg-sunk text-text3'
          }`}
        >
          {detail.tier}
        </span>
      </div>

      <Section title="Account">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Email verified" value={detail.emailVerified ? 'Yes' : 'No'} />
          <Field label="Joined" value={fmtDate(detail.createdAt)} />
          <Field label="AwardWallet" value={detail.awardWalletConnected ? 'Connected' : 'Not connected'} />
          <Field label="Home airport" value={detail.homeAirport || '—'} />
        </div>
      </Section>

      <Section title="Subscription">
        {detail.subscription ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Status" value={detail.subscription.status} />
            <Field label="Renews / ends" value={fmtDate(detail.subscription.currentPeriodEnd)} />
            <Field label="Cancel at period end" value={detail.subscription.cancelAtPeriodEnd ? 'Yes' : 'No'} />
          </div>
        ) : (
          <Empty>No Stripe subscription on file.</Empty>
        )}
      </Section>

      <Section title="Activity">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Active watches" value={String(detail.activeWatches)} />
          <Field label="Bookings" value={String(detail.bookingsCount)} />
        </div>
      </Section>

      <Section title={`Programs (${detail.balances.length})`}>
        {detail.balances.length === 0 ? (
          <Empty>No programs on file.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {detail.balances.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-paper px-3.5 py-2.5"
              >
                <span className="text-[13px] font-semibold text-text">{b.program}</span>
                <span className="hop-num text-[13px] text-text2">{b.balance.toLocaleString()} pts</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-[11px] font-bold uppercase tracking-[var(--track-eyebrow)] text-brand">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-border bg-paper p-4">
      <div className="text-[13px] font-semibold text-text">{value}</div>
      <div className="mt-1 text-[12px] text-text3">{label}</div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-border bg-paper/50 px-4 py-6 text-center text-[13px] text-text3">
      {children}
    </div>
  )
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return '—'
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
