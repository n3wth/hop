import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getOwnerSession } from '@/lib/owner'
import { getBillingOverview } from '@/lib/admin-billing'
import { isBillingEnabled } from '@/lib/env'
import BillingConsole from '@/components/admin/BillingConsole'

// Owner-only revenue console — MRR, subscriber status breakdown, and the
// recent-subscriptions list the business plan's unit-economics work (§B3)
// calls for. Every figure is read through lib/admin-billing.ts; this page
// adds no new queries.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Billing',
  robots: { index: false, follow: false },
}

export default async function AdminBillingPage() {
  // notFound (not 403) so the route doesn't confirm it exists to non-owners.
  if (!(await getOwnerSession())) notFound()

  const overview = await getBillingOverview()

  return <BillingConsole overview={overview} billingEnabled={isBillingEnabled()} />
}
