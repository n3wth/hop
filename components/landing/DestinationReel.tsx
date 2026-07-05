import Link from 'next/link'
import type { Destination } from '@/lib/destinations'
import { destinations, topValue, imageQuery } from '@/lib/destinations'
import { destinationImages, type DestImage } from '@/lib/images'

// The arrival moment — a full-bleed row of real destination photography. Before
// a visitor reads a word of copy they feel the dream: "where could I go?". A
// calm, static row the visitor scrolls/swipes themselves — no auto-motion, no
// edge fade. Server component; photos are fetched once (cached), capped at 10
// Unsplash queries (the best-value places) to keep the image fetch cheap.

function Tile({
  d,
  photo,
}: {
  d: Destination
  photo?: DestImage | null
}) {
  const href = `/search?from=SFO&to=${encodeURIComponent(d.code)}&adults=1`
  return (
    <Link
      href={href}
      className="group relative block h-[180px] w-[260px] flex-shrink-0 snap-start overflow-hidden rounded-[16px] border border-border sm:h-[210px] sm:w-[300px]"
      style={{
        backgroundColor: photo?.color ?? 'var(--color-brand-deep)',
        backgroundImage: photo?.blur ? `url("${photo.blur}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {photo ? (
        // Small ~300px tile — use the small thumb, not the full 1080px regular.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.thumb}
          alt={photo.alt}
          width={300}
          height={210}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="h-full w-full"
          style={{ background: 'var(--color-brand-deep)' }}
        />
      )}

      {/* legibility scrim — photographic, not decorative chrome */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(7,62,62,0.78) 0%, rgba(7,62,62,0.16) 46%, rgba(7,62,62,0) 70%)',
        }}
      />

      <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-3.5">
        <span
          className={`fi fi-${d.countryCode} mb-1 h-[13px] w-[18px] flex-shrink-0 rounded-[2px]`}
          aria-hidden
        />
        <div className="min-w-0">
          <div className="truncate font-display text-[19px] font-semibold leading-[1.1] tracking-[-0.01em] text-white">
            {d.city}
          </div>
          <div className="truncate text-[11px] font-medium uppercase tracking-[var(--track-label)] text-white/85">
            {d.country}
          </div>
        </div>
      </div>
    </Link>
  )
}

export default async function DestinationReel() {
  // Best-value places, capped at 10 image fetches.
  const picks = topValue(10)
  const photos = await destinationImages(picks.map((d) => imageQuery(d)))

  return (
    <section aria-label="Where your points could take you">
      <p className="mb-4 text-center text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand">
        {destinations.length} cities within reach on points
      </p>
      {/* A static row the visitor scrolls themselves, aligned to the page grid
          (no full-bleed breakout): first tile lines up with the content column;
          tiles scroll horizontally within it. Snap + hidden scrollbar. */}
      <div className="flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden">
        {picks.map((d) => (
          <Tile key={d.code} d={d} photo={photos[imageQuery(d)]} />
        ))}
      </div>
    </section>
  )
}
