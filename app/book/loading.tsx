import AppShell from '@/components/AppShell'
import FareCheckSkeleton from '@/components/checkout/FareCheckSkeleton'
import { getSessionNavUser } from '@/lib/nav-user'

// Route-level loading UI for /book. Only covers the BRIEF window before the
// page's own fast checks (session, searchParams) resolve — the real slow part
// (OfferGate re-pricing the offer against Duffel) now has its own nested
// <Suspense> in app/book/page.tsx, so this renders the SAME FareCheckSkeleton
// rather than mirroring the full two-column CheckoutForm layout. That form is
// only ONE of three possible outcomes (expired-offer Notice and
// passport-required Notice are the others, and are common — Duffel offers
// expire within minutes) — a skeleton committed to the form's shape used to
// sit on screen for the whole Duffel round trip, then snap down to a small
// Notice card whenever the offer had expired.
export default async function Loading() {
  const user = await getSessionNavUser()
  return (
    <AppShell user={user} hideSearch>
      <div className="mx-auto max-w-[var(--container-checkout)] pb-4 pt-8 sm:pt-12">
        <FareCheckSkeleton />
      </div>
    </AppShell>
  )
}
