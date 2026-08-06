import type { AdminUserDetail } from '@/lib/admin-users'
import AdminPageHeader, { AdminPageShell } from '@/components/admin/AdminPageHeader'
import Card from '@/components/ui/Card'
import Eyebrow from '@/components/ui/Eyebrow'

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
    <AdminPageShell>
      <AdminPageHeader
        title={detail.name || detail.email}
        description={detail.email}
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Users', href: '/admin/users' },
          { label: detail.name || 'User' },
        ]}
        actions={
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[var(--track-eyebrow)] ${
              detail.tier === 'premium' ? 'bg-good-bg text-good' : 'bg-sunk text-text3'
            }`}
          >
            {detail.tier}
          </span>
        }
      />

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
              <Card
                key={b.id}
                surface="paper"
                radius="sm"
                className="flex items-center justify-between gap-3 px-3.5 py-2.5"
              >
                <span className="text-[13px] font-semibold text-text">{b.program}</span>
                <span className="hop-num text-[13px] text-text2">{b.balance.toLocaleString('en-US')} pts</span>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </AdminPageShell>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <Eyebrow as="h2" className="font-bold text-brand">{title}</Eyebrow>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Card surface="paper" radius="md" className="p-4">
      <div className="text-[13px] font-semibold text-text">{value}</div>
      <div className="mt-1 text-[12px] text-text3">{label}</div>
    </Card>
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
