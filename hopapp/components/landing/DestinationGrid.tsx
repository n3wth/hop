import Icon from '@/components/Icon'
import type { Destination } from '@/lib/destinations'
import { computeCpp } from '@/lib/destinations'

// 37500 → "37.5k", 12500 → "12.5k". Compact award figure for the card chip.
function compactMiles(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

// A single wanderlust card: emoji-marked passport stamp up top, the city, its
// country, an evocative vibe line, then the economics — "from X miles", a cpp
// chip, and the program that books it well. Flat, warm, solid. Hover only tints
// the border + surface (no lift, no shadow). Links into a real search seeded for
// that destination so the dream is one tap from the verdict.
function DestinationCard({
  d,
  origin,
}: {
  d: Destination
  origin: string
}) {
  const cppVal = computeCpp(d)
  const href = `/search?from=${encodeURIComponent(origin)}&to=${encodeURIComponent(
    d.code,
  )}&adults=1`

  return (
    <a
      href={href}
      className="group flex flex-col rounded-[18px] border border-border bg-paper p-5 transition-colors hover:border-brand-mint-deep hover:bg-brand-tint"
    >
      <div className="flex items-start justify-between">
        <span
          aria-hidden
          className="grid h-11 w-11 place-items-center rounded-[13px] bg-brand-light text-[22px] leading-none"
        >
          {d.emoji ?? '✈️'}
        </span>
        <span className="font-display text-[12px] font-semibold uppercase tracking-[0.12em] text-text3">
          {d.code}
        </span>
      </div>

      <div className="mt-4">
        <h3 className="font-display text-[20px] font-semibold leading-[1.1] tracking-[-0.01em] text-text">
          {d.city}
        </h3>
        <p className="mt-0.5 text-[12.5px] font-medium uppercase tracking-[0.08em] text-text3">
          {d.country}
        </p>
      </div>

      <p className="mt-2.5 text-[13.5px] leading-[1.5] text-text2">{d.vibe}</p>

      <div className="mt-4 flex items-center justify-between border-t border-hair pt-4">
        <span className="text-[13px] font-semibold text-text">
          from {compactMiles(d.typicalAwardMiles)}
          <span className="ml-1 text-[12px] font-medium text-text3">miles</span>
        </span>
        {cppVal !== undefined ? (
          <span className="rounded-full bg-good-bg px-2.5 py-1 text-[11.5px] font-semibold tabular-nums text-good">
            {cppVal.toFixed(1)}¢ / mi
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-text3">
        <Icon name="loyalty" size={13} className="flex-shrink-0 text-brand" />
        <span className="truncate">{d.bestProgram}</span>
      </div>
    </a>
  )
}

export default function DestinationGrid({
  destinations,
  origin = 'SFO',
}: {
  destinations: Destination[]
  origin?: string
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {destinations.map((d) => (
        <DestinationCard key={d.code} d={d} origin={origin} />
      ))}
    </div>
  )
}
