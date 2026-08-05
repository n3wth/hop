import Link from 'next/link'
import type { Destination } from '@/lib/destinations'
import { computeCpp } from '@/lib/destinations'
import { TierChip } from '@/components/ui/TierChip'
import Card from '@/components/ui/Card'

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
          const href = `/search?from=${fromCode}&to=${dest.code}&depart=${depart}&return=${ret}&adults=1`
          return (
            <Card
              key={dest.code}
              surface="paper"
              className="group flex flex-col p-5 text-left transition-colors hover:border-brand"
            >
              <Link href={href}>
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
                  {value !== undefined ? <TierChip cpp={value} /> : null}
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
            </Card>
          )
        })}
      </div>
    </section>
  )
}
