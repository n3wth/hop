import Link from 'next/link'
import Icon from '@/components/Icon'
import { tier } from '@/lib/cpp'
import { computeCpp, imageQuery, type Destination } from '@/lib/destinations'
import { POINTS_THRESHOLD_CPP } from '@/lib/search'
import type { DestImage } from '@/lib/images'

// Same good/ok/weak language every cpp figure on the site uses.
const TIER_TEXT: Record<ReturnType<typeof tier>, string> = {
  green: 'text-good',
  amber: 'text-ok',
  muted: 'text-weak',
}

function compactMiles(n: number): string {
  const k = n / 1000
  return `${Number.isInteger(k) ? k : k.toFixed(1)}K`
}

// A single reach tile — verdict-first, same hierarchy as the hero showcase
// card (ShowcaseRotator): a small city/country header, then the pill + cpp
// as the loudest line, then the award path. No AI narration, no streaming —
// every figure is the engine's (lib/destinations), rendered directly.
function ReachTile({
  d,
  photo,
  origin,
}: {
  d: Destination
  photo: DestImage | null
  origin: string
}) {
  const cppVal = computeCpp(d)
  const pointsWin = cppVal !== undefined && cppVal >= POINTS_THRESHOLD_CPP
  const href = `/search?from=${encodeURIComponent(origin)}&to=${encodeURIComponent(d.code)}&adults=1`
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-paper transition-colors duration-200 ease-[var(--ease-premium)] hover:border-brand-mint-deep"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden" style={{ background: 'var(--color-brand-deep)' }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.thumb} alt={photo.alt} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div aria-hidden className="h-full w-full" style={{ background: 'var(--color-brand-deep)' }} />
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(7,62,62,0.7) 0%, rgba(7,62,62,0.14) 46%, rgba(7,62,62,0) 68%)' }}
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-3">
          <span className={`fi fi-${d.countryCode} mb-1 h-[13px] w-[18px] flex-shrink-0 rounded-[2px]`} aria-hidden />
          <div className="min-w-0">
            <h3 className="truncate text-[11px] font-semibold uppercase tracking-[var(--track-label)] text-white">
              {d.country === d.city ? d.code : `${d.city} · ${d.country}`}
            </h3>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {pointsWin ? (
            <span className="inline-flex rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[var(--track-tag)] text-brand-deep">
              Points win
            </span>
          ) : null}
          {cppVal !== undefined ? (
            <span className={`hop-price text-[20px] leading-none ${TIER_TEXT[tier(cppVal)]}`}>
              {cppVal.toFixed(1)}¢/pt
            </span>
          ) : null}
        </div>
        <p className="truncate text-[12.5px] text-text2">
          from {compactMiles(d.typicalAwardMiles)} mi{d.cabin ? ` · ${d.cabin}` : ''} · {d.bestProgram}
        </p>
      </div>
    </Link>
  )
}

// "WHERE YOUR POINTS ALREADY REACH" — a compact, static row of the member's
// (or, signed-out/no-balance, a sample of the) best-value reachable
// redemptions. Pure presentation: the ranked destination list AND its photos
// are resolved by the caller (SignedInHome for real balances, the signed-out
// home for the sample set) from the SAME engine + photo fetch the hero
// showcase already used (lib/destinations#computeCpp /
// lib/ledger-dream#reachableDestinations, lib/images#destinationImages) —
// this component never re-derives its own ranking or re-fetches a photo, so
// it can't drift from (or double-fetch) what the hero already showed.
export default function LedgerDream({
  picks,
  origin,
  sample = false,
  photos,
}: {
  /** Ranked destinations to show (2-3), already excluding whatever the hero
      showcase displayed — the caller owns slicing so this row and the hero
      never repeat a city. */
  picks: Destination[]
  origin: string
  /** True when `picks` came from the generic best-value table (lib/destinations
      #topValue) rather than this member's real balances — signed-out, or a
      signed-in member with too few reachable destinations to personalize.
      Renders an explicit "sample" label rather than implying it's theirs. */
  sample?: boolean
  /** Map of imageQuery(d) → photo, fetched once by the caller alongside the
      hero's own photos. */
  photos: Record<string, DestImage | null | undefined>
}) {
  if (picks.length === 0) return null

  return (
    <section aria-label={sample ? 'Sample destinations' : 'Where your points already reach'}>
      <div className="mb-5 flex flex-col gap-2 sm:max-w-[60ch]">
        <span className="text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand">
          {sample ? 'Sample destinations' : 'Where your points already reach'}
        </span>
        <h2 className="text-balance font-display text-[26px] font-semibold leading-[1.08] tracking-[-0.02em] text-text sm:text-[34px]">
          {sample ? 'Where points already beat cash.' : 'Where your points already reach.'}
        </h2>
        <p className="text-[15px] leading-[1.55] text-text2">
          {sample
            ? `Illustrative — connect your programs and hop ranks these against your real balances.`
            : `${picks.length} ${picks.length === 1 ? 'city is' : 'cities are'} within reach on your current balances, ranked by ¢/pt.`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {picks.map((d) => (
          <ReachTile key={d.code} d={d} photo={photos[imageQuery(d)] ?? null} origin={origin} />
        ))}
      </div>

      <Link
        href={`/ask?q=${encodeURIComponent('Which of these can I actually book right now?')}`}
        className="mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand transition-colors hover:text-brand-deep"
      >
        <Icon name="lightbulb" size={12} />
        Ask hop about these trips
        <span aria-hidden className="text-[15px] leading-none">→</span>
      </Link>
    </section>
  )
}
