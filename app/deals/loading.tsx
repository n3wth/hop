import AppShell from '@/components/AppShell'
import { getSessionNavUser } from '@/lib/nav-user'

// Route-level loading UI for /deals. Next wraps page.js in a Suspense boundary
// with this as the fallback, so it shows on navigation while the Server
// Component resolves destination photography + the session. Mirrors the real
// layout (centered editorial header, the stat line, the "Ask hop" on-ramp
// band, then a 1→2→3→4→5-up card grid) so the page doesn't reflow when
// content lands. Flat + on-system: no shadows; the sheen is the shared
// .hop-skeleton shimmer, already frozen flat under prefers-reduced-motion
// globally. Count MUST match app/deals/page.tsx's topValue(N) call.
const SKELETON_COUNT = 24

// One feed-card placeholder — mirrors DealCard: a 16/10 photo header, a vibe
// line, the 2-col economics grid (miles / vs. cash, then full-width best-via),
// and the footer CTA row. Same radii + borders so the real card swaps in clean.
function CardSkeleton() {
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-paper">
      {/* photo header placeholder — matches the card's 16/10 aspect */}
      <div className="hop-skeleton aspect-[16/10] w-full" />
      {/* body placeholder */}
      <div className="flex flex-1 flex-col p-5">
        <span className="hop-skeleton hop-skeleton-line block w-3/4" />
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3.5 border-t border-hair pt-4">
          <span className="hop-skeleton block h-[28px] rounded-[8px]" />
          <span className="hop-skeleton block h-[28px] rounded-[8px]" />
          <span className="hop-skeleton col-span-2 block h-[28px] rounded-[8px]" />
        </div>
        <div className="mt-auto flex items-center justify-between pt-5">
          <span className="hop-skeleton hop-skeleton-line block w-2/5" />
        </div>
      </div>
    </div>
  )
}

export default async function Loading() {
  const user = await getSessionNavUser()
  return (
    <AppShell user={user} hideSearch>
      <div className="mx-auto max-w-[var(--container-shell)]">
        {/* editorial header skeleton — eyebrow, balanced display title, subline */}
        <header className="mx-auto max-w-[60ch] pt-10 text-center sm:pt-14">
          <span className="hop-skeleton hop-skeleton-line mx-auto block w-[88px]" />
          <span className="hop-skeleton mx-auto mt-4 block h-[44px] w-3/4 rounded-[10px] sm:h-[56px]" />
          <span className="hop-skeleton hop-skeleton-line mx-auto mt-5 block w-5/6" />
          {/* stat line ("N routes · from X · best value first") — the real
              page renders this as EditorialHeader children, right below the
              intro. DegradedNote only ever appears here, never elsewhere. */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
            <span className="hop-skeleton hop-skeleton-line block w-[64px]" />
            <span className="hop-skeleton hop-skeleton-line block w-[90px]" />
            <span className="hop-skeleton hop-skeleton-line block w-[110px]" />
          </div>
        </header>

        {/* "Ask hop" on-ramp band — mirrors the real page's concierge door so the
            feed lands at the same vertical offset (no jump when content swaps). */}
        <div className="mx-auto mt-7 flex max-w-[640px] items-center justify-between gap-4 rounded-[16px] border border-border bg-surface px-5 py-4">
          <span className="hop-skeleton hop-skeleton-line block w-3/5" />
          <span className="hop-skeleton block h-[42px] w-[112px] flex-shrink-0 rounded-[var(--radius)]" />
        </div>

        {/* the feed skeleton */}
        <section className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </section>
      </div>
    </AppShell>
  )
}
