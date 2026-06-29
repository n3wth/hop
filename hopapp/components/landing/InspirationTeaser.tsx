import DestinationGrid from '@/components/landing/DestinationGrid'
import { topValue, imageQuery } from '@/lib/destinations'
import { destinationImages } from '@/lib/images'

// Sells the dream before the visitor has connected anything: the best-value
// award redemptions hop can find right now. It's a teaser — points-rich travel
// is the payoff, and these are the trips where miles stretch furthest. Flat
// cards on cream, on-brand. Clicking any one drops you straight into a real
// search for that city.
export default async function InspirationTeaser() {
  const picks = topValue(4)
  const photos = await destinationImages(picks.map((d) => imageQuery(d)))

  return (
    <section>
      <div className="mx-auto flex max-w-[58ch] flex-col items-center gap-2 text-center">
        <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brand">
          Imagine where your points could go
        </span>
        <h2 className="text-balance font-display text-[32px] font-bold leading-[1.05] tracking-[-0.025em] text-text sm:text-[44px] lg:text-[52px]">
          The trips where miles stretch furthest.
        </h2>
        <p className="mt-1 text-[15px] leading-[1.55] text-text2">
          A taste of the redemptions hop loves — top value per point, the
          program that books each one, and the dream on the other side.
        </p>
      </div>

      <div className="mt-8">
        <DestinationGrid destinations={picks} photos={photos} stagger />
      </div>
    </section>
  )
}
