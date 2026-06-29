import { topValue } from '@/lib/destinations'
import { getBalances } from '@/lib/awardwallet'
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
    const bal = await getBalances()
    if (bal.ok) pointsTotal = bal.data.reduce((s, b) => s + b.balance, 0)
  }

  return (
    <AppShell user={user} pointsTotal={pointsTotal} hideSearch>
      <div className="mx-auto max-w-[1180px]">
        {/* editorial header */}
        <header className="pt-10 sm:pt-14">
          <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-brand">
            Incredible right now
          </span>
          <h1 className="mt-3 max-w-[18ch] font-display text-[38px] font-bold leading-[1.05] text-text sm:text-[52px]">
            Sweet spots worth your miles right now
          </h1>
          <p className="mt-4 max-w-[58ch] text-[16px] leading-relaxed text-text2 sm:text-[17px]">
            The award redemptions where your points punch hardest — ranked by
            cents-per-point, the truest measure of a great deal. Every card is a
            real route you can chase today.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-text3">
            <span>
              <b className="font-semibold text-text2">{deals.length}</b> sweet spots
            </span>
            <span className="hidden sm:inline">·</span>
            <span>
              Hooked from <b className="font-semibold text-text2">{ORIGIN}</b>
            </span>
            <span className="hidden sm:inline">·</span>
            <span>Sorted by value, best first</span>
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
            />
          ))}
        </section>

        <SiteFooter />
      </div>
    </AppShell>
  )
}
