import { Suspense } from 'react'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { toNavUser } from '@/lib/nav-user'
import { auth0 } from '@/lib/auth0'
import { mockBalances } from '@/lib/mock'
import { getPrefs, type UserPrefs } from '@/lib/prefs'
import { getUserBalances } from '@/lib/accounts'
import { getMemoryContext, EMPTY_MEMORY_CONTEXT } from '@/lib/memory-context'
import { walletValue } from '@/lib/valuations'
import { ORIGIN_STORAGE_KEY } from '@/lib/origin-constants'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import type { SearchState } from '@/components/SearchBar'
import HeroSearch from '@/components/landing/HeroSearch'
import AgentComposer from '@/components/landing/AgentComposer'
import SampleVerdict from '@/components/landing/SampleVerdict'
import HowItWorks from '@/components/landing/HowItWorks'
import ConnectBand from '@/components/landing/ConnectBand'
import InspirationTeaser from '@/components/landing/InspirationTeaser'
import DestinationReel from '@/components/landing/DestinationReel'
import HeroShowcase from '@/components/landing/HeroShowcase'
import SignedInHome from '@/components/landing/SignedInHome'
import { conciergeBackdrop, conciergeGallery } from '@/lib/concierge-backdrop'
import { isoOffset } from '@/lib/dates'
import type { Balance } from '@/lib/types'

// A sensible default search to seed the hero form. Picking it pre-fills the
// fields so the very first action — a real search — is one tap away. Dates are
// relative (depart ≈ today+10, return ≈ +3 after), computed per request so a
// long-running server never serves a stale past date.
function makeSeed(): SearchState {
  return {
    from: 'SFO',
    to: 'JFK',
    depart: isoOffset(10),
    ret: isoOffset(13),
    adults: 1,
    children: 0,
    infants: 0,
    cabin: 'economy',
    oneWay: false,
    nonstop: false,
  }
}

// hop's home — auth-aware, two genuinely different experiences:
//
// SIGNED OUT → the marketing front door. The VERDICT DEMO leads the hero
//   (roadmap R1.2): a seeded search form one tap from a real no-auth verdict,
//   with the canonical sample verdict as the proof directly beneath. The agent
//   composer is the second door below the destination reel; inspiration
//   teaser, how-it-works, and a connect-your-points CTA follow.
//
// SIGNED IN → a personalized dashboard (NOT the marketing page). Greets by name,
//   surfaces where their actual points can take them, then search, concierge,
//   and program management.
export default async function Home() {
  const session = await auth0.getSession()
  const su = session?.user
  const user = toNavUser(su)

  // These data sources are independent — fetch them concurrently so the home
  // renders in one round-trip instead of sequentially.
  //   - balances: unified per-user (manual + AwardWallet, merged)
  //   - heroBackdrop: canonical Unsplash photo for the signed-OUT composer teaser
  //   - prefs: home airport that seeds the default From
  //   - memory: unified personalization (M5) — drops avoided places from the feed
  // Each degrades gracefully on its own; none can crash the page.
  const [real, heroBackdropRaw, prefs, memory, heroGallery] = await Promise.all([
    su?.sub ? getUserBalances(su.sub) : Promise.resolve([]),
    // Signed-in no longer renders the composer teaser — skip the image fetch.
    su?.sub ? Promise.resolve(null) : conciergeBackdrop(),
    su?.sub ? getPrefs(su.sub) : Promise.resolve({} as UserPrefs),
    // M5 — unified memory (orders the destinations module to stated affinities).
    // Degrades to the empty context when signed out; never throws.
    su?.sub ? getMemoryContext(su.sub) : Promise.resolve(EMPTY_MEMORY_CONTEXT),
    // Signed-out only: the second-door composer's live backdrop rotation.
    // (Signed-in builds a personalized gallery from its own picks instead.)
    su?.sub ? Promise.resolve([]) : conciergeGallery(4),
  ])

  // Balances power both the program count and the personalized destinations.
  // Mock fixtures ONLY in local dev (MOCK=1) — a real signed-in user with no
  // programs sees a genuine empty/onboarding state, never fabricated balances.
  let programs = 0
  let totalPoints = 0
  let pointsWorth = 0
  let balances: Balance[] = []
  if (user) {
    const useMock = real.length === 0 && /^(1|true|yes)$/i.test(process.env.MOCK ?? '')
    balances = real.length > 0 ? real : useMock ? mockBalances() : []
    programs = balances.length
    totalPoints = balances.reduce((sum, b) => sum + b.balance, 0)
    pointsWorth = walletValue(balances)
  }

  const first = user?.name?.trim().split(' ')[0]

  // Never crashes the home if the image call fails.
  const heroBackdrop = heroBackdropRaw ?? undefined

  // Home airport (Supabase pref) seeds the default From + gates the set-home
  // prompt. The persistent "where from" cookie backs the From when there's no
  // saved pref — but does NOT count as a saved home airport (the prompt to save
  // one still shows), so the seed and hasHomeAirport stay independent.
  const cookieStore = await cookies()
  const cookieOriginRaw = cookieStore.get(ORIGIN_STORAGE_KEY)?.value?.trim().toUpperCase()
  const cookieOrigin =
    cookieOriginRaw && /^[A-Z]{3}$/.test(cookieOriginRaw) ? cookieOriginRaw : undefined
  const seed = makeSeed()
  const seedFrom = prefs.homeAirport ?? cookieOrigin
  const homeSeed: SearchState = seedFrom ? { ...seed, from: seedFrom } : seed

  // ── SIGNED IN — personalized dashboard ───────────────────────────────────
  if (user) {
    return (
      <AppShell
        user={user}
        pointsTotal={totalPoints > 0 ? totalPoints : undefined}
        homeAirport={prefs.homeAirport}
        hideSearch
      >
        <div className="mx-auto max-w-[var(--container-shell)]">
          <SignedInHome
            first={first}
            programs={programs}
            totalPoints={totalPoints}
            pointsWorth={pointsWorth}
            seed={homeSeed}
            hasHomeAirport={!!prefs.homeAirport}
            memory={memory}
            balances={balances}
          />
        </div>
        <div className="mx-auto max-w-[var(--container-shell)]">
          <SiteFooter />
        </div>
      </AppShell>
    )
  }

  // ── SIGNED OUT — marketing front door ────────────────────────────────────
  return (
    <AppShell user={null} hideSearch>
      <div className="mx-auto flex max-w-[var(--container-shell)] flex-col gap-16 pt-4 sm:gap-20 sm:pt-6 lg:gap-24 lg:pt-8">
        {/* ── HERO — the verdict demo is the front door (R1.2) ────────────── */}
        {/* Lead with the working product: a seeded search one tap from a real
            no-auth verdict, with the canonical worked example as the proof
            directly beneath. The agent moves to the second door below. */}
        {/* isolate: the ambience wash sits at -z inside THIS stacking context,
            above the page canvas but under every piece of hero content. */}
        <section className="relative isolate pt-4 sm:pt-8 lg:pt-12">
          {/* Split hero — confident type left, ONE composed showcase right:
              a large destination photo with the engine's verdict card layered
              on it. Imagery is structural (a grid column), never absolutely-
              positioned ornament — see docs/design/experience-heuristics.md. */}
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-16 xl:gap-20">
            <div>
              <h1
                className="hop-rise max-w-[12ch] text-balance font-display text-[40px] font-semibold leading-[1.02] tracking-[-0.03em] text-text sm:text-[54px] lg:text-[64px]"
                style={{ ['--hop-delay' as string]: '90ms' }}
              >
                Points or cash? Get the verdict.
              </h1>
              <p
                className="hop-rise mt-4 text-pretty text-[15px] leading-[1.6] text-text2 sm:text-[17px]"
                style={{ ['--hop-delay' as string]: '140ms' }}
              >
                Live fares vs award space, priced in ¢/pt.
              </p>
              {/* the agent stays reachable — a secondary fast-path */}
              <p
                className="hop-rise mt-6 text-[13.5px] text-text2"
                style={{ ['--hop-delay' as string]: '200ms' }}
              >
                Not sure where to go?{' '}
                <Link href="/ask" className="font-semibold text-brand underline-offset-2 transition-colors hover:text-brand-deep hover:underline">
                  Ask hop
                </Link>
              </p>

              {/* phones: search leads, right after the promise — the showcase
                  image follows. md+ uses the full-width pill below the band. */}
              <div className="hop-rise mt-7 md:hidden" style={{ ['--hop-delay' as string]: '240ms' }}>
                <HeroSearch initial={homeSeed} align="start" />
              </div>
            </div>

            <HeroShowcase origin={homeSeed.from} />
          </div>

          {/* the primary action — a real search, full width under the band */}
          <div className="hop-rise mt-10 hidden sm:mt-12 md:block" style={{ ['--hop-delay' as string]: '190ms' }}>
            <HeroSearch initial={homeSeed} />
          </div>

          {/* the proof — the canonical worked example, right under the form */}
          <div className="mt-12 sm:mt-16 lg:mt-20">
            {/* Suspense: a slow (not down) Unsplash call must degrade the photo
                ornament, never stall the whole page — this section fetches its
                own photo independently of everything above it. */}
            <Suspense
              fallback={
                <div
                  aria-hidden
                  className="h-[420px] rounded-[20px] sm:h-[360px] lg:rounded-[28px]"
                  style={{ background: 'var(--color-brand)' }}
                />
              }
            >
              <SampleVerdict />
            </Suspense>
          </div>
        </section>

        {/* ── THE DREAM, IMMEDIATELY — a reel of real destinations ───────── */}
        <Suspense
          fallback={
            <div aria-hidden className="flex gap-3 overflow-hidden pb-2 sm:gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[180px] w-[260px] flex-shrink-0 rounded-[16px] border border-border sm:h-[210px] sm:w-[300px]"
                  style={{ background: 'var(--color-brand-deep)' }}
                />
              ))}
            </div>
          }
        >
          <DestinationReel origin={homeSeed.from} />
        </Suspense>

        {/* ── THE SECOND DOOR — the conversational agent ─────────────────── */}
        <AgentComposer variant="out" backdrop={heroBackdrop} gallery={heroGallery} headingTag="h2" />

        {/* ── SELL THE DREAM ─────────────────────────────────────────────── */}
        <Suspense
          fallback={
            <div aria-hidden className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[16/11] rounded-[var(--radius-lg)] border border-border"
                  style={{ background: 'var(--color-brand-deep)' }}
                />
              ))}
            </div>
          }
        >
          <InspirationTeaser />
        </Suspense>

        {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
        <HowItWorks />
      </div>

      {/* CTA + footer read as one card: teal top half, paper-white bottom half. */}
      <div className="mx-auto mt-16 max-w-[var(--container-shell)] overflow-hidden rounded-[20px] border border-border sm:mt-20 lg:mt-24 lg:rounded-[28px]">
        <ConnectBand user={null} programs={0} />
        <SiteFooter flush />
      </div>
    </AppShell>
  )
}
