import Link from 'next/link'
import { formatValue } from '@/lib/cpp'
import { liveValuationStats, type LiveValuationStat } from '@/lib/verdict-shelves'
import type { Balance } from '@/lib/types'

// "3.8¢/pt · was 3.1¢ baseline · 24 observations" — the price+delta lead,
// the static baseline it beat (or missed), and the sample size that earned
// its trust, straight from lib/verdict-shelves#liveValuationStats.
function StatCard({ stat }: { stat: LiveValuationStat }) {
  const up = stat.delta >= 0
  return (
    <div className="flex flex-col rounded-[var(--radius-lg)] border border-border bg-paper p-4">
      <span className="truncate text-[11px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-text3">
        {stat.programName}
      </span>
      <div className="mt-1.5 flex items-baseline gap-2">
        <p className="hop-price text-[22px] leading-none text-text">{formatValue(stat.liveCpp)}</p>
        <span className={`text-[11.5px] font-semibold ${up ? 'text-good' : 'text-weak'}`}>
          {up ? '+' : ''}
          {stat.delta.toFixed(1)}¢
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-[1.5] text-text2">
        was {stat.baselineCpp.toFixed(1)}¢ baseline · {stat.sampleSize} observations
      </p>
    </div>
  )
}

// ── YOUR POINTS, PRICED LIVE ─────────────────────────────────────────────────
// The intersection of getLiveValuations() (real, first-party-observed cpp —
// lib/valuations-live, ADR 0005) and the programs the member actually holds.
// Ships completely dark — renders nothing — until a HELD program crosses the
// ≥20-fresh-sample trust threshold; every number here is a real observed
// redemption, never a static guess.
export default async function LiveValuationShelf({ balances }: { balances: Balance[] }) {
  const stats = await liveValuationStats(balances)
  if (stats.length === 0) return null

  return (
    <section
      className="hop-rise"
      style={{ ['--hop-delay' as string]: '200ms' }}
      aria-label="Your points, priced live"
    >
      <div className="flex flex-col gap-2 sm:max-w-[60ch]">
        <span className="text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand">
          Your points, priced live
        </span>
        <h2 className="text-balance font-display text-[26px] font-semibold leading-[1.08] tracking-[-0.02em] text-text sm:text-[34px]">
          What your balances are really worth right now.
        </h2>
        <p className="text-[15px] leading-[1.55] text-text2">
          Real redemptions hop has observed for programs you hold — not a
          static guess.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.programId} stat={stat} />
        ))}
      </div>

      <Link
        href={`/ask?q=${encodeURIComponent('What changed in my points valuations recently?')}`}
        className="mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand transition-colors hover:text-brand-deep"
      >
        Ask hop what changed
        <span aria-hidden className="text-[15px] leading-none">→</span>
      </Link>
    </section>
  )
}
