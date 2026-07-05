import Link from 'next/link'
import DestinationGrid from '@/components/landing/DestinationGrid'
import { topValue, imageQuery } from '@/lib/destinations'
import { destinationImages } from '@/lib/images'

// Sells the dream before the visitor has connected anything: high-value award
// redemptions hop can find right now. It's a teaser — points-rich travel is the
// payoff, and these are trips where points stretch furthest. Flat cards on cream,
// on-brand. Clicking any one drops you straight into a real search for that city.
//
// The DestinationReel above already shows the top-value head, so the teaser pulls
// a NON-overlapping slice (the next tier down) — different cities, so the two
// surfaces don't mirror each other.
export default async function InspirationTeaser() {
  // Skip the reel's leading tiles; show the next four best-value places.
  const picks = topValue(8).slice(4, 8)
  const photos = await destinationImages(picks.map((d) => imageQuery(d)))

  return (
    <section>
      <div className="mx-auto flex max-w-[58ch] flex-col items-center gap-2 text-center">
        <span className="text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand">
          Imagine where your points could go
        </span>
        <h2 className="mx-auto max-w-[22ch] text-balance font-display text-[32px] font-bold leading-[1.05] tracking-[-0.025em] text-text sm:text-[44px] lg:text-[52px]">
          The trips where miles stretch furthest.
        </h2>
        <p className="mt-1 text-[15px] leading-[1.55] text-text2">
          Top value per point — the program that books each one, and the dream
          on the other side.
        </p>
      </div>

      <div className="mt-8">
        <DestinationGrid destinations={picks} photos={photos} stagger />
      </div>

      {/* The teaser shows four; the full ranked feed lives on /deals. Give it a
          first-class door instead of leaving /deals reachable only from nav. */}
      <div className="mt-8 flex justify-center">
        <Link
          href="/deals"
          className="text-[15px] font-semibold text-brand underline-offset-2 transition-colors hover:text-brand-deep hover:underline"
        >
          See all sweet spots
        </Link>
      </div>
    </section>
  )
}
