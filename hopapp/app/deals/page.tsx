import { topValue, imageQuery } from '@/lib/destinations'
import { destinationImages } from '@/lib/images'
import { getUserBalances } from '@/lib/accounts'
import { auth0 } from '@/lib/auth0'
import AppShell from '@/components/AppShell'
import DealCard from '@/components/DealCard'
import SiteFooter from '@/components/SiteFooter'

export const metadata = {
  title: 'Sweet spots · hop',
  description: 'High-value award redemptions worth your miles right now.',
}

// Sensible defaults for the CTA seed: depart ~3 weeks out, return a week later.
// Computed at request time so the links always point at near-future dates.
function defaultDates(): { depart: string; ret: string } {
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const now = new Date()
  const depart = new Date(now)
  depart.setDate(depart.getDate() + 21)
  const ret = new Date(depart)
  ret.setDate(ret.getDate() + 7)
  return { depart: iso(depart), ret: iso(ret) }
}

const ORIGIN = 'SFO'

export default async function DealsPage() {
  const deals = topValue(24)
  const { depart, ret } = defaultDates()

  // Batch-fetch destination photography (cached per query, day-long revalidate).
  // Null entries fall back to a solid brand-tint tile in the card.
  const photos = await destinationImages(deals.map((d) => imageQuery(d)))

  // Auth0 session → consistent header avatar (null when signed out).
  const session = await auth0.getSession()
  const su = session?.user
  const user = su
    ? {
        initial: (su.name ?? su.email ?? 'U').trim().charAt(0).toUpperCase(),
        name: su.name ?? su.email ?? undefined,
        email: su.email ?? undefined,
        picture: su.picture ?? undefined,
      }
    : null

  // Header points chip — only when signed in and balances resolve.
  let pointsTotal: number | undefined
  if (user) {
    // Unified per-user balances (manual + AwardWallet) for the header chip.
    const real = su?.sub ? await getUserBalances(su.sub) : []
    if (real.length > 0) pointsTotal = real.reduce((s, b) => s + b.balance, 0)
  }

  return (
    <AppShell user={user} pointsTotal={pointsTotal} hideSearch>
      <div className="mx-auto max-w-[1180px]">
        {/* editorial header — centered over the full-width feed */}
        <header className="mx-auto max-w-[60ch] pt-10 text-center sm:pt-14">
          <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brand">
            Sweet spots
          </span>
          <h1 className="mx-auto mt-3 max-w-[18ch] text-balance font-display text-[38px] font-semibold leading-[1.05] tracking-[-0.02em] text-text sm:text-[52px]">
            Where your miles go furthest
          </h1>
          <p className="mx-auto mt-4 max-w-[54ch] text-pretty text-[16px] leading-relaxed text-text2 sm:text-[17px]">
            The redemptions where points beat cash by the widest margin, ranked
            by cents per point. Every one is a route you can book.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[13px] text-text3">
            <span>
              <b className="font-semibold text-text2">{deals.length}</b> routes
            </span>
            <span className="hidden sm:inline">·</span>
            <span>
              from <b className="font-semibold text-text2">{ORIGIN}</b>
            </span>
            <span className="hidden sm:inline">·</span>
            <span>best value first</span>
          </div>
        </header>

        {/* the feed */}
        <section className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {deals.map((dest, i) => (
            <DealCard
              key={dest.code}
              dest={dest}
              rank={i}
              fromCode={ORIGIN}
              depart={depart}
              ret={ret}
              photo={photos[imageQuery(dest)]}
            />
          ))}
        </section>

        {/* Unsplash attribution (API terms) */}
        <p className="mt-8 text-[12px] text-text3">
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
