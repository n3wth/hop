import Link from 'next/link'
import type { Destination } from '@/lib/destinations'
import { computeCpp } from '@/lib/destinations'
import { tier, formatValue } from '@/lib/cpp'
import type { CppTier } from '@/lib/types'

export interface DestinationSuggestionsProps {
  destinations: Destination[]
  /** Origin IATA the suggestion links depart from — may be a guessed default
      when hasKnownOrigin is false (see below), so it's always a valid code
      for the links even though the heading won't claim it as the visitor's. */
  fromCode: string
  /** True when fromCode is the visitor's own saved/cookied airport, not a
      guessed default — gates the heading's "from <code>" suffix INDEPENDENTLY
      of isPersonalized, so a guessed origin never gets attributed to the
      visitor as if it were real. */
  hasKnownOrigin: boolean
  depart: string
  ret: string
  /** True when `destinations` came from lib/destinations#affordableWith(the
      visitor's OWN points balance) — drives the honest subline. False means
      sample figures (signed out, or signed in with nothing connected /
      nothing reachable yet). */
  isPersonalized: boolean
  /** Only meaningful when isPersonalized — the balance these are reachable
      with, for the "computed from your N points" subline. */
  totalPoints?: number
  isSignedIn: boolean
}

// cpp tier → chip palette. Mirrors DealCard's CHIP map.
const CHIP: Record<CppTier, { bg: string; fg: string; bd: string }> = {
  green: { bg: 'var(--color-good-bg)', fg: 'var(--color-good)', bd: 'var(--color-brand-mint-deep)' },
  amber: { bg: 'var(--color-ok-bg)', fg: 'var(--color-ok)', bd: 'var(--color-gold-soft)' },
  muted: { bg: 'var(--color-sunk)', fg: 'var(--color-text3)', bd: 'var(--color-border)' },
}
const TIER_WORD: Record<CppTier, string> = { green: 'strong value', amber: 'fair value', muted: 'low value' }

// 37500 → "37.5K", 12500 → "12.5K".
function compactMiles(n: number): string {
  const k = n / 1000
  return `${Number.isInteger(k) ? k : k.toFixed(1)}K`
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

// The bare-/search launchpad's computed inspiration row — 3-4 destinations,
// each a real route/value the engine can back up, not a stock photo grid.
// No images (unlike DealCard on /deals): this is the fast, no-destination
// path (app/search/page.tsx), and a photo fetch would reintroduce the
// latency that path deliberately avoids. Flat text cards only.
export default function DestinationSuggestions({
  destinations,
  fromCode,
  hasKnownOrigin,
  depart,
  ret,
  isPersonalized,
  totalPoints,
  isSignedIn,
}: DestinationSuggestionsProps) {
  if (destinations.length === 0) return null

  return (
    <section className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b-[1.5px] border-text pb-4">
        <h2 className="font-display text-[21px] font-semibold tracking-[-0.01em] text-text sm:text-[24px]">
          {hasKnownOrigin ? `Worth a look from ${fromCode}` : 'Worth a look'}
        </h2>
        <p className="text-[13px] text-text3">
          {isPersonalized
            ? `Computed from your ${totalPoints?.toLocaleString('en-US')} points.`
            : isSignedIn
              ? 'Sample figures — add your programs to see what your points reach.'
              : 'Sample figures — sign in to see what your points reach.'}
        </p>
      </div>
      <div className="mt-[18px] grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-4">
        {destinations.map((dest) => {
          const value = computeCpp(dest)
          const t = tier(value)
          const chip = CHIP[t]
          const href = `/search?from=${fromCode}&to=${dest.code}&depart=${depart}&return=${ret}&adults=1`
          return (
            <Link
              key={dest.code}
              href={href}
              className="group flex flex-col rounded-[var(--radius-lg)] border border-border bg-paper p-5 text-left transition-colors hover:border-brand"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className={`fi fi-${dest.countryCode} h-[13px] w-[18px] flex-shrink-0 rounded-[2px]`}
                  />
                  <span className="truncate font-display text-[17px] font-semibold text-text">
                    {dest.city}
                  </span>
                </div>
                {value !== undefined ? (
                  <span
                    className="flex-shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                    style={{ background: chip.bg, borderColor: chip.bd, color: chip.fg }}
                    aria-label={`${value.toFixed(1)} cents per point — ${TIER_WORD[t]}`}
                  >
                    {formatValue(value)}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-[13px] text-text3">
                {fromCode} → {dest.code} · {compactMiles(dest.typicalAwardMiles)} mi
                {dest.cabin ? ` · ${dest.cabin}` : ''}
              </p>
              <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-[13px]">
                <span className="text-text2">vs. {money(dest.typicalCashUSD)} cash</span>
                <span className="font-semibold text-text transition-colors group-hover:text-brand">
                  See it →
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
