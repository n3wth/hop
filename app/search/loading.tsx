import AppShell from '@/components/AppShell'
import ResultsSkeleton from '@/components/ResultsSkeleton'

// Route-level loading UI. Next wraps page.js in a Suspense boundary with this as
// the fallback, so it shows immediately on navigation/search while the Server
// Component fetches (live APIs take ~3s).
//
// loading.tsx can't read searchParams, so it must NOT render the search pill —
// it would flash a confidently-wrong route (e.g. SFO → LAX) that then snaps to
// the real trip. `hideSearch` swaps the wrong pill for neutral nav links; the
// route context lives in the skeleton below instead. The real shell still wraps
// it so only the results plane swaps in.
export default function Loading() {
  return (
    <AppShell hideSearch>
      {/* Same shell container as the loaded page (app/search/page.tsx) so the
          skeleton and the results occupy identical bounds — no snap on load. */}
      <div className="mx-auto max-w-[var(--container-shell)]">
        <ResultsSkeleton />
      </div>
    </AppShell>
  )
}
