import AppShell from '@/components/AppShell'
import ConfirmationSkeleton from '@/components/checkout/ConfirmationSkeleton'
import { getSessionNavUser } from '@/lib/nav-user'

// Route-level loading UI for the confirmation page. Only covers the brief
// window before the page's own fast checks resolve — the real slow part
// (OrderGate: ownership check + Duffel order fetch) has its own nested
// <Suspense> in page.tsx using this SAME ConfirmationSkeleton, so there's one
// skeleton, not two different guesses.
export default async function Loading() {
  const user = await getSessionNavUser()
  return (
    <AppShell user={user} hideSearch>
      <div className="mx-auto max-w-[var(--container-xs)] pb-4 pt-8 sm:pt-12">
        <ConfirmationSkeleton />
      </div>
    </AppShell>
  )
}
