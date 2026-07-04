import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getOwnerSession } from '@/lib/owner'
import { computeBusinessDigest } from '@/lib/business-digest'
import { listHeartbeats } from '@/lib/cron-heartbeat'
import { getDegradationWindowCounts } from '@/lib/degradation-telemetry'
import { listOpenFindings } from '@/lib/improvement-findings'
import { listRecentTickets } from '@/lib/support-tickets'
import { listRecentEscalations } from '@/lib/escalation'
import { isSelfImproveEnabled } from '@/lib/env'
import { auth0 } from '@/lib/auth0'
import { toNavUser } from '@/lib/nav-user'
import AppShell from '@/components/AppShell'
import AdminDashboard from '@/components/admin/AdminDashboard'

// Owner-only ops overview — the /admin landing page. Every figure is read
// through an existing lib/* accessor (business digest, cron heartbeats,
// degradation telemetry, improvement findings, support/escalation lists);
// this page adds no new queries, only composes what already exists.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
}

export default async function AdminPage() {
  // notFound (not 403) so the route doesn't confirm it exists to non-owners.
  const owner = await getOwnerSession()
  if (!owner) notFound()

  const [session, digest, heartbeats, degradation, findings, tickets, escalations] = await Promise.all([
    auth0.getSession(),
    computeBusinessDigest(),
    listHeartbeats(),
    getDegradationWindowCounts(),
    listOpenFindings(),
    listRecentTickets(5),
    listRecentEscalations(5),
  ])

  return (
    // Same chrome as every other surface (TopNav + tab bar) — /admin is an
    // internal tool, not a separate site. The header search stays hidden.
    <AppShell user={toNavUser(session?.user)} hideSearch>
      <AdminDashboard
        ownerEmail={owner.email}
        digest={digest}
        heartbeats={heartbeats}
        degradation={degradation}
        findings={findings}
        recentTickets={tickets}
        recentEscalations={escalations}
        selfImproveEnabled={isSelfImproveEnabled()}
      />
    </AppShell>
  )
}
