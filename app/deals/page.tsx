import { cookies } from 'next/headers'
import Link from 'next/link'
import { topValue, imageQuery } from '@/lib/destinations'
import { destinationImages } from '@/lib/images'
import { getUserBalances } from '@/lib/accounts'
import { getMemoryContext, withoutAvoided, EMPTY_MEMORY_CONTEXT } from '@/lib/memory-context'
import { getPrefs } from '@/lib/prefs'
import { auth0 } from '@/lib/auth0'
import AppShell from '@/components/AppShell'
import DealCard from '@/components/DealCard'
import DegradedNote from '@/components/DegradedNote'
import SiteFooter from '@/components/SiteFooter'
import EditorialHeader from '@/components/EditorialHeader'
import Icon from '@/components/Icon'
import { ORIGIN_STORAGE_KEY } from '@/lib/origin-context'
import { pageMeta } from '@/lib/seo'
import { localISO } from '@/lib/dates'

// title is the bare child title — the root layout template appends '· hop'.
export const metadata = pageMeta({
  title: 'Sweet spots',
  description: 'High-value award redemptions worth your miles right now, ranked by cents per point.',
  path: '/deals',
})

// Fallback origin when no ?from= and no saved home airport.
const DEFAULT_ORIGIN = 'SFO'

// IATA codes are 3 letters. Normalize ?from= and reject anything else so the
// seeded search links stay valid.
function normalizeOrigin(raw: string | string[] | undefined): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (!v) return undefined
  const code = v.trim().toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : undefined
}

// Sensible defaults for the CTA seed: depart ~3 weeks out, return a week later.
// Computed at request time so the links always point at near-future dates.
function defaultDates(): { depart: string; ret: string } {
  const iso = localISO
  const now = new Date()
  const depart = new Date(now)
  depart.setDate(depart.getDate() + 21)
  const ret = new Date(depart)
  ret.setDate(ret.getDate() + 7)
  return { depart: iso(depart), ret: iso(ret) }
}

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { depart, ret } = defaultDates()
  const params = await searchParams
  const fromParam = normalizeOrigin(params.from)

  // Persistent "where from" cookie — seeds the deal CTAs' origin when there's no
  // ?from= and no saved home airport, so the feed departs from where they fly.
  const cookieStore = await cookies()
  const cookieOrigin = normalizeOrigin(cookieStore.get(ORIGIN_STORAGE_KEY)?.value)

  // M5 — compounding: resolve the session first so the signed-in member's STATED
  // "avoid" places are dropped from the feed BEFORE we fetch photos for the final
  // set. Value order (cents-per-point) is preserved, so the "ranked by cents per
  // point" copy stays true. Degrades to today's exact feed when signed out /
  // unset. Photos are cached per query (day-long revalidate); null entries fall
  // back to a solid brand-tint tile in the card.
  const session = await auth0.getSession()
  const memory = session?.user?.sub
    ? await getMemoryContext(session.user.sub)
    : EMPTY_MEMORY_CONTEXT
  const deals = withoutAvoided(topValue(24), memory.avoided)
  const photos = await destinationImages(deals.map((d) => imageQuery(d)))
  const su = session?.user
  const user = su
    ? {
        initial: (su.name ?? su.email ?? 'U').trim().charAt(0).toUpperCase(),
        name: su.name ?? su.email ?? undefined,
        email: su.email ?? undefined,
        picture: su.picture ?? undefined,
      }
    : null

  // Header points chip + origin seed. Balances and prefs each degrade on their
  // own — a balances failure is surfaced (the figure goes stale), a prefs
  // failure just falls back to the default origin. Neither throws the page.
  let pointsTotal: number | undefined
  let homeAirport: string | undefined
  const degraded: string[] = []
  if (user && su?.sub) {
    try {
      // Unified per-user balances (manual + AwardWallet) for the header chip.
      const real = await getUserBalances(su.sub)
      if (real.length > 0) pointsTotal = real.reduce((s, b) => s + b.balance, 0)
    } catch {
      degraded.push('balances')
    }
    try {
      homeAirport = (await getPrefs(su.sub)).homeAirport
    } catch {
      // No saved origin → default. Not worth a degraded note.
    }
  }

  // Origin precedence: explicit ?from= → saved home airport → "where from"
  // cookie → SFO.
  const origin = fromParam ?? normalizeOrigin(homeAirport) ?? cookieOrigin ?? DEFAULT_ORIGIN
  const hasDeals = deals.length > 0

  return (
    <AppShell user={user} pointsTotal={pointsTotal} hideSearch>
      <div className="mx-auto max-w-[var(--container-app)] xl:max-w-[var(--container-wide)] 2xl:max-w-[var(--container-xwide)]">
        {/* editorial header — centered over the full-width feed */}
        <EditorialHeader
          eyebrow="Sweet spots"
          title="Where your miles go furthest"
          intro="The redemptions where points beat cash by the widest margin, ranked by cents per point. Every one is a route you can book."
        >
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[13px] text-text3">
            <span>
              <b className="font-semibold text-text2">{deals.length}</b> routes
            </span>
            <span className="hidden sm:inline">·</span>
            <span>
              from <b className="font-semibold text-text2">{origin}</b>
            </span>
            <span className="hidden sm:inline">·</span>
            <span>best value first</span>
          </div>

          <DegradedNote degraded={degraded} />
        </EditorialHeader>

        {/* agent on-ramp — these are great-value routes in the abstract; hop's
            concierge can say which ones YOUR points actually reach. A door into
            /ask so the static feed isn't a dead end. */}
        <div className="mx-auto mt-7 flex max-w-[640px] flex-col items-center justify-between gap-3 rounded-[16px] border border-border bg-surface px-5 py-4 text-center sm:flex-row sm:gap-4 sm:text-left">
          <div className="flex items-center gap-2.5">
            <Icon name="lightbulb" size={18} className="flex-shrink-0 text-brand" />
            <span className="text-[14px] leading-[1.5] text-text2">
              <span className="font-semibold text-text">Not sure which fit?</span> Ask hop
              which of these your points can reach.
            </span>
          </div>
          <Link
            href="/ask?q=Which%20of%20these%20sweet%20spots%20fit%20my%20points%3F"
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-[var(--radius)] bg-brand px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-deep"
          >
            <Icon name="flight" size={16} />
            Ask hop
          </Link>
        </div>

        {/* the feed */}
        {hasDeals ? (
          <section className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {deals.map((dest, i) => (
              <DealCard
                key={dest.code}
                dest={dest}
                rank={i}
                fromCode={origin}
                depart={depart}
                ret={ret}
                photo={photos[imageQuery(dest)]}
              />
            ))}
          </section>
        ) : (
          // Defensive: the dataset is static so this shouldn't happen, but never
          // render a bare, dead grid if it ever does.
          <div className="mt-9 rounded-[var(--radius-lg)] border border-border bg-surface px-6 py-12 text-center">
            <p className="text-[15px] text-text2">
              No sweet spots to show right now. Ask hop where your points can take you.
            </p>
          </div>
        )}

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
