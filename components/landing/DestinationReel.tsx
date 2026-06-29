import type { Destination } from '@/lib/destinations'
import { destinations, topValue, imageQuery } from '@/lib/destinations'
import { destinationImages, type DestImage } from '@/lib/images'

// The arrival moment — a full-bleed, auto-scrolling reel of real destination
// photography. Before a visitor reads a word of copy they feel the dream:
// "where could I go?". Server component — photos are fetched once (cached) and
// the marquee itself is pure CSS (see .hop-marquee in globals.css), so there's
// no client JS and reduced-motion users get a calm, static row.
//
// The track holds two identical copies of the tile row; the CSS translates it
// -50% for a seamless loop. We cap at 10 Unsplash queries (the best-value
// places) to keep the image fetch cheap.

function Tile({
  d,
  photo,
  decorative = false,
}: {
  d: Destination
  photo?: DestImage | null
  /** The duplicated marquee copy: hidden from a11y + keyboard so the same city
      isn't announced or tab-focusable twice. */
  decorative?: boolean
}) {
  const href = `/search?from=SFO&to=${encodeURIComponent(d.code)}&adults=1`
  return (
    <a
      href={href}
      aria-hidden={decorative || undefined}
      tabIndex={decorative ? -1 : undefined}
      className="group relative block h-[180px] w-[260px] flex-shrink-0 overflow-hidden rounded-[16px] border border-border sm:h-[210px] sm:w-[300px]"
      style={{ background: 'var(--color-brand-deep)' }}
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
          <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-white/85">
            {d.country}
          </div>
        </div>
      </div>
    </a>
  )
}

export default async function DestinationReel() {
  // Best-value places, capped at 10 image fetches.
  const picks = topValue(10)
  const photos = await destinationImages(picks.map((d) => imageQuery(d)))

  // Two copies → seamless -50% loop. The duplicate row is aria-hidden and its
  // anchors are tabIndex=-1 (decorative) so screen readers and the keyboard tab
  // order don't see each city twice.
  const tiles = (dupe: boolean) =>
    picks.map((d) => (
      <Tile
        key={`${dupe ? 'b' : 'a'}-${d.code}`}
        d={d}
        photo={photos[imageQuery(d)]}
        decorative={dupe}
      />
    ))

  return (
    <section
      aria-label="Where your points could take you"
      className="hop-rise -mx-4 sm:-mx-8 lg:-mx-16"
      style={{ ['--hop-delay' as string]: '300ms' }}
    >
      <p className="mb-4 px-4 text-center text-[12px] font-semibold uppercase tracking-[0.18em] text-brand sm:px-8 lg:px-16">
        {destinations.length} cities within reach on points
      </p>
      {/* Pause the loop on hover/focus so a visitor can read a tile (and on touch,
          where hover sticks). Reduced-motion users get a static row from the CSS. */}
      <div className="hop-marquee-mask overflow-hidden py-1">
        <div className="hop-marquee-track gap-3 [animation-play-state:running] hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] sm:gap-4">
          <div className="flex gap-3 pr-3 sm:gap-4 sm:pr-4">{tiles(false)}</div>
          <div className="flex gap-3 pr-3 sm:gap-4 sm:pr-4" aria-hidden>
            {tiles(true)}
          </div>
        </div>
      </div>
    </section>
  )
}
