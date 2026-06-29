import AppShell from '@/components/AppShell'

// Route-level loading UI for /deals. Next wraps page.js in a Suspense boundary
// with this as the fallback, so it shows on navigation while the Server
// Component resolves destination photography + the session. Mirrors the real
// layout (centered editorial header, then a 1→2→3→4-up card grid) so the page
// doesn't reflow when content lands. Flat + on-system: no shadows; the pulse is
// the standard skeleton shimmer, already reduced-motion gated globally.
const SKELETON_COUNT = 8

function CardSkeleton() {
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-paper">
      {/* photo header placeholder — matches the card's 16/10 aspect */}
      <div className="aspect-[16/10] w-full animate-pulse bg-sunk" />
      {/* body placeholder */}
      <div className="flex flex-1 flex-col p-5">
        <div className="h-[14px] w-3/4 animate-pulse rounded-full bg-sunk" />
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3.5 border-t border-hair pt-4">
          <div className="h-[28px] animate-pulse rounded-[8px] bg-sunk" />
          <div className="h-[28px] animate-pulse rounded-[8px] bg-sunk" />
          <div className="col-span-2 h-[28px] animate-pulse rounded-[8px] bg-sunk" />
        </div>
        <div className="mt-auto flex items-center justify-between pt-5">
          <div className="h-[14px] w-2/5 animate-pulse rounded-full bg-sunk" />
        </div>
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <AppShell hideSearch>
      <div className="mx-auto max-w-[1180px] xl:max-w-[1340px] 2xl:max-w-[1500px]">
        {/* editorial header skeleton */}
        <header className="mx-auto max-w-[60ch] pt-10 text-center sm:pt-14">
          <div className="mx-auto h-[12px] w-[88px] animate-pulse rounded-full bg-sunk" />
          <div className="mx-auto mt-4 h-[44px] w-3/4 animate-pulse rounded-[10px] bg-sunk sm:h-[56px]" />
          <div className="mx-auto mt-5 h-[16px] w-5/6 animate-pulse rounded-full bg-sunk" />
        </header>

        {/* the feed skeleton */}
        <section className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </section>
      </div>
    </AppShell>
  )
}
