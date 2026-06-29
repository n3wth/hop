import { auth0 } from '@/lib/auth0'
import { mockBalances } from '@/lib/mock'
import { getUserBalances } from '@/lib/accounts'
import { getPrefs } from '@/lib/prefs'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import Concierge, { type ConciergePhoto } from '@/components/Concierge'
import { destinations, topValue, imageQuery } from '@/lib/destinations'
import { destinationImages } from '@/lib/images'

// /ask — hop's AI concierge. An immersive, app-like front door for "where should
// I go with my points?". The Concierge panel owns the hero state (a warm focal
// prompt, prominent input, evocative chips, and a backdrop of destination
// photography). Auth-aware: when signed in we ground the answer in the user's
// real total points (live AwardWallet, mock fixtures otherwise). The page never
// crashes if balances can't load — the concierge simply answers untethered.
export default async function AskPage() {
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

  // Context for the concierge — the user's real points (total + per-program) and
  // their home airport (where realistic trips depart from). Live when configured,
  // mock otherwise; only computed when signed in. Never crashes the page.
  let totalPoints: number | undefined
  let programs: { program: string; balance: number }[] | undefined
  let homeAirport: string | undefined
  if (user) {
    // Unified per-user balances (manual + AwardWallet, merged). Empty → mock.
    const real = su?.sub ? await getUserBalances(su.sub) : []
    const balances = real.length > 0 ? real : mockBalances()
    totalPoints = balances.reduce((sum, b) => sum + b.balance, 0)
    programs = balances.map((b) => ({ program: b.program, balance: b.balance }))
    const prefs = su?.sub ? await getPrefs(su.sub) : {}
    homeAirport = prefs.homeAirport
  }

  // Destination photography for the mood gallery + suggestion cards. Fetched
  // server-side (keeps the Unsplash key off the client), cached per query.
  // Keyed by IATA code so the client can look up by suggestion / gallery code.
  const imgs = await destinationImages(destinations.map((d) => imageQuery(d)))
  const photos: Record<string, ConciergePhoto> = {}
  for (const d of destinations) {
    const img = imgs[imageQuery(d)]
    if (img) {
      photos[d.code] = {
        thumb: img.thumb,
        alt: img.alt,
        city: d.city,
        country: d.country,
        countryCode: d.countryCode,
      }
    }
  }
  const galleryCodes = topValue(6).map((d) => d.code)

  return (
    <AppShell user={user} pointsTotal={totalPoints} hideSearch>
      <div className="mx-auto flex max-w-[980px] flex-col gap-8 pt-4 sm:pt-8">
        <div className="hop-rise" style={{ ['--hop-delay' as string]: '40ms' }}>
          <Concierge
            totalPoints={totalPoints}
            programs={programs}
            homeAirport={homeAirport}
            photos={photos}
            galleryCodes={galleryCodes}
          />
        </div>

        <SiteFooter />
      </div>
    </AppShell>
  )
}
