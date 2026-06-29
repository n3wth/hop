import DestinationGrid from '@/components/landing/DestinationGrid'
import { topValue } from '@/lib/destinations'

// Sells the dream before the visitor has connected anything: the best-value
// award redemptions hop can find right now. It's a teaser — points-rich travel
// is the payoff, and these are the trips where miles stretch furthest. Flat
// cards on cream, on-brand. Clicking any one drops you straight into a real
// search for that city.
export default function InspirationTeaser() {
  const picks = topValue(4)

  return (
    <section>
      <div className="flex flex-col gap-2 sm:max-w-[54ch]">
        <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brand">
          Imagine where your points could go
        </span>
        <h2 className="font-display text-[26px] font-semibold leading-[1.08] tracking-[-0.02em] text-text sm:text-[34px]">
          The trips where miles stretch furthest.
        </h2>
        <p className="mt-1 text-[15px] leading-[1.55] text-text2">
          A taste of the redemptions hop loves — top value per point, the
          program that books each one, and the dream on the other side.
        </p>
      </div>

      <div className="mt-8">
        <DestinationGrid destinations={picks} />
      </div>
    </section>
  )
}
