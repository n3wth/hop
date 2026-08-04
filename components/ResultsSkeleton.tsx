// Shimmer skeleton for the results plane. Mirrors the real rendered layout —
// the same max-width container, RouteBar, verdict hero, the four alternative
// cards, and the dark wallet — at the SAME breakpoints, so results swap in with
// no layout shift (the loading state reads as the page taking shape, not a
// spinner that snaps). Warm cream/sunk tones, subtle sheen (.hop-skeleton).
// Shown by app/search/loading.tsx while the Server Component fetches (~3s).

import Eyebrow from '@/components/ui/Eyebrow'

function Bar({ w, h = 12, className = '' }: { w: string; h?: number; className?: string }) {
  return (
    <span
      className={`hop-skeleton block rounded-[6px] ${className}`}
      style={{ width: w, height: h }}
    />
  )
}

// Right-aligned stat placeholder — value over caption, matching RouteBar's Stat.
function StatSkeleton() {
  return (
    <div className="flex flex-col items-end gap-[6px] leading-none">
      <Bar w="40px" h={18} />
      <Bar w="58px" h={10} />
    </div>
  )
}

// One alternative-card placeholder — matches ResultRow's min height + structure.
function CardSkeleton() {
  return (
    <div className="flex min-h-[268px] flex-col rounded-[20px] border-[1.5px] border-border bg-paper px-[18px] pb-[18px] pt-5 sm:px-[22px] sm:pb-[22px] sm:pt-6">
      <div className="flex items-start justify-between">
        <span className="hop-skeleton block h-[46px] w-[46px] rounded-[12px]" />
        <Bar w="48px" h={12} />
      </div>
      <div className="mt-[18px] space-y-[9px]">
        <Bar w="80%" h={18} />
        <Bar w="55%" h={11} />
      </div>
      <div className="mt-auto pt-[18px]">
        <Bar w="60%" h={26} />
        <div className="mt-[12px]">
          <Bar w="42%" h={20} />
        </div>
        <div className="mt-[16px] h-[6px] overflow-hidden rounded-full bg-border">
          <span className="hop-skeleton block h-full w-[70%] rounded-full" />
        </div>
      </div>
      <div className="mt-4 h-[42px] rounded-[11px] border-[1.5px] border-border" />
    </div>
  )
}

export default function ResultsSkeleton() {
  return (
    // Same width cap as the real results column (app/search/page.tsx) so wide
    // screens don't reflow when the skeleton is replaced.
    <div
      aria-busy="true"
      aria-label="Loading flight results"
      className="mx-auto max-w-[var(--container-shell)]"
    >
      {/* RouteBar placeholder — desktop (lg+) only, matching RouteBar: below lg
          the TopNav "Edit search" pill carries the trip context and no route
          row renders. Codes + arrow on the left, weighted stat group on the
          right (pt-4, NO bottom border) so the real line drops in without a
          vertical jump. */}
      <div className="hidden items-center justify-between pt-4 lg:flex">
        <div className="flex items-center gap-[18px]">
          <div className="flex flex-col gap-[6px]">
            <Bar w="44px" h={19} />
            <Bar w="68px" h={11} />
          </div>
          {/* typographic → between the codes */}
          <Bar w="22px" h={16} />
          <div className="flex flex-col gap-[6px]">
            <Bar w="44px" h={19} />
            <Bar w="68px" h={11} />
          </div>
        </div>

        {/* right-side stat group */}
        <div className="flex items-center gap-7">
          <StatSkeleton />
          <span className="h-9 w-px bg-hair" />
          <StatSkeleton />
          <span className="h-9 w-px bg-hair" />
          <StatSkeleton />
        </div>
      </div>

      {/* Verdict hero placeholder — teal plane. Grid + radius collapse at the
          SAME breakpoints as VerdictRail (single column below lg, 1fr/392px at
          lg) so swapping the skeleton for the real hero causes no layout shift. */}
      <section
        className="mt-[26px] grid grid-cols-1 overflow-hidden rounded-[20px] lg:grid-cols-[1fr_392px] lg:rounded-[28px]"
        style={{ background: 'var(--color-brand)' }}
      >
        {/* LEFT — headline + subline + stat strip (on-brand: tint shimmer on teal) */}
        <div className="px-6 pb-9 pt-8 sm:px-10 lg:px-[52px] lg:pb-[46px] lg:pt-12">
          {/* Same slot the loaded page's "BEST VALUE" kicker fills (VerdictRail) —
              real copy instead of a shimmer bar, so the wait reads as the engine
              doing something specific, not a generic spinner. */}
          <div className="mb-[26px] border-b border-white/15 pb-4">
            <Eyebrow as="span" onDark className="inline-flex items-center">
              Pricing cash. Checking award space.
            </Eyebrow>
          </div>
          <div className="space-y-[14px]">
            <span className="hop-skeleton-dark block h-[52px] w-[78%] rounded-[10px]" />
            <span className="hop-skeleton-dark block h-[52px] w-[58%] rounded-[10px]" />
          </div>
          <div className="mt-7 space-y-[10px]">
            <span className="hop-skeleton-dark block h-[15px] w-[70%] rounded-[6px]" />
            <span className="hop-skeleton-dark block h-[15px] w-[52%] rounded-[6px]" />
          </div>
          {/* CTA row — stacks full-width below sm like the loaded hero */}
          <div className="mt-7 flex flex-col gap-3 sm:mt-[34px] sm:flex-row sm:items-center sm:gap-4">
            <span className="hop-skeleton-dark block h-[52px] w-full rounded-[14px] sm:w-[210px]" />
            <span className="block h-[52px] w-full rounded-[14px] border border-white/20 sm:w-[130px]" />
          </div>
          {/* mirrors the loaded hero's stat strip — 2×2 grid on phones, flex
              row from sm — so the skeleton swaps out with no reflow at 375px */}
          <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/15 pt-6 sm:mt-8 sm:flex sm:flex-wrap sm:gap-10 sm:pt-7 lg:mt-[42px] lg:pt-[30px]">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-[8px]">
                <span className="hop-skeleton-dark block h-[11px] w-[60px] rounded-[5px]" />
                <span className="hop-skeleton-dark block h-[24px] w-[72px] rounded-[6px]" />
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — bunny well + boarding-pass card placeholder. Border + bunny
            well match VerdictRail's responsive treatment (top divider below lg,
            left divider at lg; well hidden below lg). */}
        <aside
          className="relative flex flex-col justify-between border-t border-dashed border-white/20 lg:border-l lg:border-t-0"
          style={{ background: 'var(--color-brand-deep)' }}
        >
          <div className="hidden flex-1 place-items-center pt-9 lg:grid">
            <span className="hop-skeleton-dark block h-[140px] w-[140px] rounded-full" />
          </div>
          <div className="mx-4 mb-5 mt-5 space-y-[14px] rounded-[18px] bg-paper p-[22px] sm:mx-[26px] sm:mb-[26px] sm:mt-6 lg:mt-0">
            <div className="flex items-center gap-[11px]">
              <span className="hop-skeleton block h-[40px] w-[40px] rounded-[10px]" />
              <div className="flex-1 space-y-[7px]">
                <Bar w="60%" h={14} />
                <Bar w="40%" h={11} />
              </div>
            </div>
            <div className="border-t border-dashed border-border" />
            <div className="flex items-center justify-between">
              <Bar w="48px" h={22} />
              <Bar w="80px" h={12} />
              <Bar w="48px" h={22} />
            </div>
          </div>
        </aside>
      </section>

      {/* "Other ways to fly" header placeholder — matches SectionHead's ink
          underline + the ResultsList expand/collapse toolbar beside it. */}
      <div className="mb-[22px] mt-14 flex items-end justify-between border-b-[1.5px] border-text pb-4">
        <Bar w="220px" h={24} />
        <Bar w="92px" h={13} />
      </div>

      {/* Alternative cards — same grid + gap as ResultsList (mt-[14px] above) */}
      <div className="mt-[14px] grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      {/* Wallet placeholder — dark panel. Padding + the column grid collapse at
          the same breakpoints as PointsPanel (compact below lg, 4-col at lg). */}
      <div className="mt-14 overflow-hidden rounded-[22px]" style={{ background: 'var(--color-brand-ink)' }}>
        <div className="px-4 pt-[14px] sm:px-[30px] sm:pt-[18px]">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`grid items-center gap-3 py-[16px] sm:gap-5 sm:py-[18px] [grid-template-columns:40px_1fr_auto] lg:[grid-template-columns:46px_1fr_200px_116px] ${i > 0 ? 'border-t border-white/[0.07]' : ''}`}
            >
              <span className="hop-skeleton-dark block h-[40px] w-[40px] rounded-[12px] lg:h-[46px] lg:w-[46px]" />
              <div className="space-y-[7px]">
                <span className="hop-skeleton-dark block h-[14px] w-[70%] rounded-[6px]" />
                <span className="hop-skeleton-dark block h-[12px] w-[40%] rounded-[6px]" />
              </div>
              {/* value bar — desktop only, matching PointsPanel */}
              <span className="hop-skeleton-dark hidden h-[8px] w-full rounded-full lg:block" />
              <span className="hop-skeleton-dark ml-auto block h-[16px] w-[64px] rounded-[6px]" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.03] px-4 py-[16px] sm:px-[30px] sm:py-[18px]">
          <span className="hop-skeleton-dark block h-[13px] w-[220px] rounded-[6px]" />
          <span className="hop-skeleton-dark block h-[20px] w-[56px] rounded-[6px]" />
        </div>
      </div>
    </div>
  )
}
