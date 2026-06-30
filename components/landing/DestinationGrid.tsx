import Icon from '@/components/Icon'
import { formatValue, tier } from '@/lib/cpp'
import type { Destination } from '@/lib/destinations'
import { computeCpp, imageQuery } from '@/lib/destinations'
import type { DestImage } from '@/lib/images'

// Map a value tier to its token chip colors. Same good/ok/weak language the
// verdict uses, so a chip's color always means the same thing across surfaces.
const TIER_CHIP: Record<ReturnType<typeof tier>, string> = {
  green: 'bg-good-bg text-good',
  amber: 'bg-ok-bg text-ok',
  muted: 'bg-weak-bg text-weak',
}

// 37500 → "37.5k", 12500 → "12.5k". Compact award figure for the card chip.
function compactMiles(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

// A single wanderlust card: a real destination photo up top with the city + its
// country flag overlaid, then the economics — "from X miles", a ¢/pt value chip
// (colored by tier()), and the program that books it well. Flat, warm, solid: no
// card shadow/lift; hover scales
// the IMAGE inside its clipped frame and tints the border. Links into a real
// search seeded for that destination so the dream is one tap from the verdict.
function DestinationCard({
  d,
  origin,
  photo,
  index = 0,
  stagger = false,
}: {
  d: Destination
  origin: string
  photo?: DestImage | null
  /** Position in the grid — drives the staggered entrance delay. */
  index?: number
  /** Opt into a staggered hop-rise entrance (marketing surfaces only). */
  stagger?: boolean
}) {
  const cppVal = computeCpp(d)
  const href = `/search?from=${encodeURIComponent(origin)}&to=${encodeURIComponent(
    d.code,
  )}&adults=1`

  return (
    <a
      href={href}
      className={`group flex flex-col overflow-hidden rounded-[18px] border border-border bg-paper transition-colors hover:border-brand-mint-deep${
        stagger ? ' hop-rise' : ''
      }`}
      style={stagger ? { ['--hop-delay' as string]: `${120 + index * 70}ms` } : undefined}
    >
      {/* ── photo header ─────────────────────────────────────────────────── */}
      <div
        className="relative aspect-[16/11] w-full overflow-hidden"
        style={{ background: 'var(--color-brand-deep)' }}
      >
        {photo ? (
          // ~280px 4-up card — the small thumb is plenty; the 1080px regular is
          // 3-4x the bytes for no visible gain at this size.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.thumb}
            alt={photo.alt}
            width={400}
            height={275}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div aria-hidden className="h-full w-full" style={{ background: 'var(--color-brand-deep)' }} />
        )}

        {/* legibility scrim */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(7,62,62,0.74) 0%, rgba(7,62,62,0.18) 42%, rgba(7,62,62,0) 66%)',
          }}
        />

        {/* IATA code badge */}
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-brand">
          {d.code}
        </span>

        {/* city + flag overlaid */}
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-3.5">
          <span
            className={`fi fi-${d.countryCode} mb-1 h-[13px] w-[18px] flex-shrink-0 rounded-[2px]`}
            aria-hidden
          />
          <div className="min-w-0">
            <h3 className="truncate font-display text-[20px] font-semibold leading-[1.1] tracking-[-0.01em] text-white">
              {d.city}
            </h3>
            <p className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-white/85">
              {d.country}
            </p>
          </div>
        </div>
      </div>

      {/* ── body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[13.5px] leading-[1.5] text-text2">{d.vibe}</p>

        <div className="mt-4 flex items-center justify-between border-t border-hair pt-3.5">
          <span className="text-[13px] font-semibold text-text">
            from {compactMiles(d.typicalAwardMiles)}
            <span className="ml-1 text-[12px] font-medium text-text3">miles</span>
          </span>
          {cppVal !== undefined ? (
            <span
              className={`hop-num rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${TIER_CHIP[tier(cppVal)]}`}
            >
              {formatValue(cppVal)}
            </span>
          ) : null}
        </div>

        <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-text3">
          <Icon name="loyalty" size={13} className="flex-shrink-0 text-brand" />
          <span className="truncate">{d.bestProgram}</span>
        </div>
      </div>
    </a>
  )
}

export default function DestinationGrid({
  destinations,
  origin = 'SFO',
  photos,
  stagger = false,
}: {
  destinations: Destination[]
  origin?: string
  /** Map of imageQuery(d) → photo. When absent, cards render the solid fallback. */
  photos?: Record<string, DestImage | null>
  /** Opt into a staggered hop-rise entrance (marketing surfaces only). */
  stagger?: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {destinations.map((d, i) => (
        <DestinationCard
          key={d.code}
          d={d}
          origin={origin}
          photo={photos?.[imageQuery(d)]}
          index={i}
          stagger={stagger}
        />
      ))}
    </div>
  )
}
