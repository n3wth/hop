import { auth0 } from '@/lib/auth0'
import { mockBalances } from '@/lib/mock'
import { getPrefs, type UserPrefs } from '@/lib/prefs'
import { getUserBalances } from '@/lib/accounts'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import type { SearchState } from '@/components/SearchBar'
import AgentComposer from '@/components/landing/AgentComposer'
import SampleVerdict from '@/components/landing/SampleVerdict'
import HowItWorks from '@/components/landing/HowItWorks'
import ConnectBand from '@/components/landing/ConnectBand'
import InspirationTeaser from '@/components/landing/InspirationTeaser'
import DestinationReel from '@/components/landing/DestinationReel'
import SignedInHome from '@/components/landing/SignedInHome'
import { conciergeBackdrop } from '@/lib/concierge-backdrop'

// A sensible default search to seed the hero form. Picking it pre-fills the
// fields so the very first action — a real search — is one tap away.
const SEED: SearchState = {
  from: 'SFO',
  to: 'JFK',
  depart: '2026-07-09',
  ret: '2026-07-12',
  adults: 1,
  oneWay: false,
}

// hop's home — auth-aware, two genuinely different experiences:
//
// SIGNED OUT → the marketing front door. The AGENT leads the hero (a
//   conversational composer that, on submit, opens the agent / sign-in), with
//   the points-vs-cash verdict kept just below as the proof. Destination reel,
//   inspiration teaser, how-it-works, and a connect-your-points CTA follow.
//   Search stays reachable as a secondary fast-path.
//
// SIGNED IN → a personalized dashboard (NOT the marketing page). Greets by name,
//   surfaces where their actual points can take them, then search, concierge,
//   and program management.
export default async function Home() {
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

  // The three remaining data sources are independent — fetch them concurrently
  // so the home renders in one round-trip instead of three sequential ones.
  //   - balances: unified per-user (manual + AwardWallet, merged)
  //   - heroBackdrop: canonical Unsplash photo for the agent hero teaser
  //   - prefs: home airport that seeds the default From
  // Each degrades gracefully on its own; none can crash the page.
  const [real, heroBackdropRaw, prefs] = await Promise.all([
    su?.sub ? getUserBalances(su.sub) : Promise.resolve([]),
    conciergeBackdrop(),
    su?.sub ? getPrefs(su.sub) : Promise.resolve({} as UserPrefs),
  ])

  // Balances power both the program count and the personalized destinations.
  // Mock fixtures ONLY in local dev (MOCK=1) — a real signed-in user with no
  // programs sees a genuine empty/onboarding state, never fabricated balances.
  let programs = 0
  let totalPoints = 0
  if (user) {
    const useMock = real.length === 0 && /^(1|true|yes)$/i.test(process.env.MOCK ?? '')
    const balances = real.length > 0 ? real : useMock ? mockBalances() : []
    programs = balances.length
    totalPoints = balances.reduce((sum, b) => sum + b.balance, 0)
  }

  const first = user?.name?.trim().split(' ')[0]

  // Never crashes the home if the image call fails.
  const heroBackdrop = heroBackdropRaw ?? undefined

  // Home airport (Supabase pref) seeds the default From + gates the set-home prompt.
  const homeSeed: SearchState = prefs.homeAirport
    ? { ...SEED, from: prefs.homeAirport }
    : SEED

  // ── SIGNED IN — personalized dashboard ───────────────────────────────────
  if (user) {
    return (
      <AppShell user={user} pointsTotal={totalPoints} hideSearch>
        <div className="mx-auto max-w-[1180px]">
          <SignedInHome
            first={first}
            programs={programs}
            totalPoints={totalPoints}
            seed={homeSeed}
            hasHomeAirport={!!prefs.homeAirport}
            heroBackdrop={heroBackdrop}
          />
        </div>
        <div className="mx-auto max-w-[1180px]">
          <SiteFooter />
        </div>
      </AppShell>
    )
  }

  // ── SIGNED OUT — marketing front door ────────────────────────────────────
  return (
    <AppShell user={null} hideSearch>
      <div className="mx-auto flex max-w-[1180px] flex-col gap-16 pt-4 sm:gap-20 sm:pt-6 lg:gap-24 lg:pt-8">
        {/* ── HERO — the agent is the front door ──────────────────────────── */}
        {/* Lead with the conversational promise: a composer that opens the agent
            (routing through sign-in when they act). The verdict below is the proof. */}
        <section className="pt-2 sm:pt-4">
          <AgentComposer variant="out" backdrop={heroBackdrop} />

          {/* search stays reachable — demoted to a secondary fast-path */}
          <p className="hop-rise mt-5 text-center text-[13.5px] text-text2" style={{ ['--hop-delay' as string]: '300ms' }}>
            Know exactly where you&apos;re going?{' '}
            <a href="/search" className="font-semibold text-brand underline-offset-2 transition-colors hover:text-brand-deep hover:underline">
              Search a specific route
            </a>
          </p>
        </section>

        {/* ── THE DREAM, IMMEDIATELY — a reel of real destinations ───────── */}
        <DestinationReel />

        {/* ── A TASTE OF THE OUTPUT ──────────────────────────────────────── */}
        <SampleVerdict />

        {/* ── SELL THE DREAM ─────────────────────────────────────────────── */}
        <InspirationTeaser />

        {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
        <HowItWorks />

        {/* ── CONNECT CTA ────────────────────────────────────────────────── */}
        <ConnectBand user={null} programs={0} />
      </div>

      <div className="mx-auto max-w-[1180px]">
        <SiteFooter />
      </div>
    </AppShell>
  )
}
