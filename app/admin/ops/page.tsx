import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getOwnerSession } from '@/lib/owner'
import { gatherOpsPreflight } from '@/lib/admin-ops'
import { listRecentDegradationEvents } from '@/lib/degradation-telemetry'
import { getValuationOverrides } from '@/lib/valuation-overrides'
import { listActiveStandingOrders } from '@/lib/standing-orders'
import { getOutclickSummary, listRecentOutclicks } from '@/lib/outclicks'
import { isSelfImproveEnabled, isValuationSyncEnabled } from '@/lib/env'
import OpsPanel from '@/components/admin/OpsPanel'

// Owner-only ops console — the R0.4 "turn the lights on" confirmation surface.
// Every row is read through an existing lib/* accessor; this page adds no new
// queries, only composes what already exists (same rule as /admin).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Ops',
  robots: { index: false, follow: false },
}

export default async function AdminOpsPage() {
  // notFound (not 403) so the route doesn't confirm it exists to non-owners.
  if (!(await getOwnerSession())) notFound()

  const [degradationEvents, valuationOverrides, watches, outclickSummary, recentOutclicks] =
    await Promise.all([
      listRecentDegradationEvents(30),
      getValuationOverrides(),
      listActiveStandingOrders(),
      getOutclickSummary(),
      listRecentOutclicks(15),
    ])

  return (
    <OpsPanel
      preflight={gatherOpsPreflight()}
      degradationEvents={degradationEvents}
      selfImproveEnabled={isSelfImproveEnabled()}
      valuationEnabled={isValuationSyncEnabled()}
      valuationOverrides={valuationOverrides}
      watches={watches}
      outclickSummary={outclickSummary}
      recentOutclicks={recentOutclicks}
    />
  )
}
