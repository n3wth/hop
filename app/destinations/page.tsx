import Link from 'next/link'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import { pageMeta } from '@/lib/seo'
import { destinations, topValue, imageQuery } from '@/lib/destinations'
import { destinationImages } from '@/lib/images'
import DestinationGuideCard from './DestinationGuideCard'

export const metadata = pageMeta({
  title: 'Destination guides',
  description:
    'Where to go with your points — the vibe, when to go, and the sweet spot that gets you there. Browse destinations ranked by how far your miles stretch.',
  path: '/destinations',
})

export default async function DestinationsIndexPage() {
  // Best value first — same comparator the deals feed uses, so the inspiration
  // grid and the deals feed agree on what's strongest.
  const ranked = topValue(destinations.length)

  // Photos resolve concurrently (cached per query, day-long revalidate); null
  // entries fall back to a solid brand-tint tile in the card.
  const photos = await destinationImages(ranked.map((d) => imageQuery(d)))

  return (
    <AppShell user={null} hideSearch>
      <div className="mx-auto max-w-[1180px] xl:max-w-[1340px]">
        {/* editorial header */}
        <header className="mx-auto max-w-[60ch] pt-10 text-center sm:pt-14">
          <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brand">
            Destination guides
          </span>
          <h1 className="mx-auto mt-3 max-w-[18ch] text-balance font-display text-[34px] font-semibold leading-[1.05] tracking-[-0.02em] text-text sm:text-[52px]">
            Where your points can take you
          </h1>
          <p className="mx-auto mt-4 max-w-[50ch] text-pretty px-2 text-[16px] leading-relaxed text-text2 sm:px-0 sm:text-[17px]">
            The vibe, the best time to go, and the points play that gets you
            there — for every place worth the miles. Ranked by value.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[13px] text-text3">
            <span>
              <b className="font-semibold text-text2">{ranked.length}</b> destinations
            </span>
            <span className="hidden sm:inline">·</span>
            <span>best value first</span>
          </div>
        </header>

        {/* the grid */}
        <section className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {ranked.map((dest) => (
            <DestinationGuideCard key={dest.code} dest={dest} photo={photos[imageQuery(dest)]} />
          ))}
        </section>

        {/* internal-link mesh */}
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
          <span className="text-text3">Keep exploring:</span>
          <Link href="/sweet-spots" className="font-semibold text-brand hover:text-brand-deep">
            Sweet spots by program
          </Link>
          <Link href="/deals" className="font-semibold text-brand hover:text-brand-deep">
            Today’s deals
          </Link>
          <Link href="/search" className="font-semibold text-brand hover:text-brand-deep">
            Run a search
          </Link>
        </div>

        {/* Unsplash attribution (API terms) */}
        <p className="mt-6 text-[12px] text-text3">
          Destination photography via{' '}
          <a
            href="https://unsplash.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-border underline-offset-2 hover:text-text2"
          >
            Unsplash
          </a>
          .
        </p>

        <SiteFooter />
      </div>
    </AppShell>
  )
}
