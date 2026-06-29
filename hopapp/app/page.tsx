import { auth0 } from '@/lib/auth0'
import { mockBalances } from '@/lib/mock'
import { getBalances } from '@/lib/awardwallet'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import Icon from '@/components/Icon'
import type { SearchState } from '@/components/SearchBar'
import HeroSearch from '@/components/landing/HeroSearch'
import SampleVerdict from '@/components/landing/SampleVerdict'
import HowItWorks from '@/components/landing/HowItWorks'
import ConnectBand from '@/components/landing/ConnectBand'
import InspirationTeaser from '@/components/landing/InspirationTeaser'
import SignedInHome from '@/components/landing/SignedInHome'

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
// SIGNED OUT → the marketing front door. Editorial hero + centered search,
//   a sample verdict, a teaser of inspiration to sell the dream, how-it-works,
//   and a connect-your-points CTA.
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

  // Balances power both the program count and the personalized destinations.
  // Live AwardWallet when configured, mock fixtures otherwise — never crashes
  // the home if the upstream call fails.
  let programs = 0
  let totalPoints = 0
  if (user) {
    const res = await getBalances().catch(() => ({ ok: false as const }))
    const balances = res.ok ? res.data : mockBalances()
    programs = balances.length
    totalPoints = balances.reduce((sum, b) => sum + b.balance, 0)
  }

  const first = user?.name?.trim().split(' ')[0]

  // ── SIGNED IN — personalized dashboard ───────────────────────────────────
  if (user) {
    return (
      <AppShell user={user} pointsTotal={totalPoints} hideSearch>
        <div className="mx-auto max-w-[1180px]">
          <SignedInHome
            first={first}
            programs={programs}
            totalPoints={totalPoints}
            seed={SEED}
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
      <div className="mx-auto flex max-w-[1180px] flex-col gap-16 pt-6 sm:gap-20 sm:pt-12 lg:gap-24 lg:pt-16">
        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <section className="flex min-h-[58vh] flex-col items-center justify-center pt-4 text-center sm:min-h-[64vh] sm:pt-8">
          <span
            className="hop-rise inline-flex items-center gap-2 rounded-full border border-border bg-paper px-4 py-1.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-brand"
            style={{ ['--hop-delay' as string]: '40ms' }}
          >
            <Icon name="loyalty" size={14} />
            Cash vs points, settled
          </span>

          <h1
            className="hop-rise mt-6 max-w-[16ch] font-display text-[40px] font-semibold leading-[1.0] tracking-[-0.03em] text-text sm:max-w-[18ch] sm:text-[60px] lg:text-[78px]"
            style={{ ['--hop-delay' as string]: '90ms' }}
          >
            One search. The smarter way to book.
          </h1>

          <p
            className="hop-rise mt-6 max-w-[52ch] text-[16px] leading-[1.6] text-text2 sm:text-[18px]"
            style={{ ['--hop-delay' as string]: '140ms' }}
          >
            hop reads your real point balances, checks award space and cash for
            the same flight, and gives you the verdict — not a fare list. Miles
            or money, hop tells you which one actually wins.
          </p>

          {/* the search — front and center, the obvious primary action */}
          <div
            className="hop-rise mt-9 flex w-full justify-center sm:mt-11"
            style={{ ['--hop-delay' as string]: '190ms' }}
          >
            <div className="flex w-full max-w-[560px] justify-center md:w-auto md:max-w-none">
              <HeroSearch initial={SEED} />
            </div>
          </div>

          <p
            className="hop-rise mt-4 text-[13px] text-text3"
            style={{ ['--hop-delay' as string]: '230ms' }}
          >
            Try{' '}
            <span className="font-semibold text-text2">
              San Francisco → New York
            </span>{' '}
            — it&apos;s ready to go.
          </p>
        </section>

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
