// Shimmer skeleton for the results plane. Mirrors the real layout — RouteBar,
// verdict hero, the four alternative cards, the wallet — so the loading state
// reads as the page taking shape, not a spinner. Warm cream/sunk tones, subtle
// sheen (.hop-skeleton). Shown by app/loading.tsx during navigation/search while
// the Server Component fetches (live APIs take ~3s).

function Bar({ w, h = 12, className = '' }: { w: string; h?: number; className?: string }) {
  return (
    <span
      className={`hop-skeleton block rounded-[6px] ${className}`}
      style={{ width: w, height: h }}
    />
  )
}

// One alternative-card placeholder — matches ResultRow's min height + structure.
function CardSkeleton() {
  return (
    <div className="flex min-h-[268px] flex-col rounded-[20px] border-[1.5px] border-border bg-paper px-[22px] pb-[22px] pt-6">
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
    <div aria-busy="true" aria-label="Loading flight results">
      {/* RouteBar placeholder — a single thin facts row */}
      <div className="mt-2 flex items-center gap-5 border-b border-hair pb-5">
        <Bar w="180px" h={16} />
        <Bar w="120px" h={12} />
        <Bar w="90px" h={12} />
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
          <div className="mb-[26px] border-b border-white/15 pb-4">
            <span className="block h-[12px] w-[110px] rounded-[6px] bg-white/15" />
          </div>
          <div className="space-y-[14px]">
            <span className="block h-[52px] w-[78%] rounded-[10px] bg-white/15" />
            <span className="block h-[52px] w-[58%] rounded-[10px] bg-white/15" />
          </div>
          <div className="mt-7 space-y-[10px]">
            <span className="block h-[15px] w-[70%] rounded-[6px] bg-white/10" />
            <span className="block h-[15px] w-[52%] rounded-[6px] bg-white/10" />
          </div>
          <div className="mt-[34px] flex gap-4">
            <span className="block h-[52px] w-[210px] rounded-[14px] bg-white/15" />
            <span className="block h-[52px] w-[130px] rounded-[14px] border border-white/20" />
          </div>
          <div className="mt-[42px] flex gap-10 border-t border-white/15 pt-[30px]">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-[8px]">
                <span className="block h-[11px] w-[60px] rounded-[5px] bg-white/10" />
                <span className="block h-[24px] w-[72px] rounded-[6px] bg-white/15" />
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
            <span className="block h-[140px] w-[140px] rounded-full bg-white/10" />
          </div>
          <div className="mx-5 mb-6 mt-6 space-y-[14px] rounded-[18px] bg-paper p-[22px] sm:mx-[26px] sm:mb-[26px] lg:mt-0">
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

      {/* "Other ways to fly" header placeholder */}
      <div className="mb-[22px] mt-14 flex items-end justify-between border-b-[1.5px] border-text pb-4">
        <Bar w="200px" h={22} />
        <Bar w="100px" h={13} />
      </div>

      {/* Alternative cards */}
      <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      {/* Wallet placeholder — dark panel */}
      <div className="mt-14 overflow-hidden rounded-[22px]" style={{ background: 'var(--color-text)' }}>
        <div className="px-[30px] pt-[10px]">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`grid items-center gap-5 py-[18px] ${i > 0 ? 'border-t border-white/[0.07]' : ''}`}
              style={{ gridTemplateColumns: '46px 1fr 200px 116px' }}
            >
              <span className="block h-[46px] w-[46px] rounded-[12px] bg-white/10" />
              <div className="space-y-[7px]">
                <span className="block h-[14px] w-[70%] rounded-[6px] bg-white/10" />
                <span className="block h-[12px] w-[40%] rounded-[6px] bg-white/[0.07]" />
              </div>
              <span className="block h-[8px] w-full rounded-full bg-white/10" />
              <span className="ml-auto block h-[16px] w-[64px] rounded-[6px] bg-white/10" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.03] px-[30px] py-[18px]">
          <span className="block h-[13px] w-[220px] rounded-[6px] bg-white/10" />
          <span className="block h-[20px] w-[56px] rounded-[6px] bg-white/10" />
        </div>
      </div>
    </div>
  )
}
