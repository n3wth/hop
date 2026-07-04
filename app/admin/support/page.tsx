import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getOwnerSession } from '@/lib/owner'
import { listRecentTickets } from '@/lib/support-tickets'
import { listRecentEscalations } from '@/lib/escalation'
import SupportConsole from '@/components/admin/SupportConsole'

// Owner-only operational surface — never cached, never indexed. Reads live support
// tickets + expert-booking leads and lets the owner send a (reviewed) reply.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Support',
  robots: { index: false, follow: false },
}

export default async function AdminSupportPage() {
  // notFound (not 403) so the route doesn't even confirm it exists to non-owners.
  if (!(await getOwnerSession())) notFound()

  const [tickets, escalations] = await Promise.all([
    listRecentTickets(),
    listRecentEscalations(),
  ])

  // Chrome (sidebar rail, account, nav) comes from app/admin/layout.tsx.
  return <SupportConsole tickets={tickets} escalations={escalations} />
}
