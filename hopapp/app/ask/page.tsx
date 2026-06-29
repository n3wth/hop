import { auth0 } from '@/lib/auth0'
import { mockBalances } from '@/lib/mock'
import { getBalances } from '@/lib/awardwallet'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import Icon from '@/components/Icon'
import Concierge from '@/components/Concierge'

// /ask — hop's AI concierge. A warm, full-page front door for "where should I
// go with my points?". Auth-aware: when signed in we ground the answer in the
// user's real total points (live AwardWallet, mock fixtures otherwise). The page
// never crashes if balances can't load — the concierge simply answers untethered.
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

  // Total usable points across programs — context for the concierge. Live when
  // configured, mock otherwise; only computed when signed in.
  let totalPoints: number | undefined
  if (user) {
    const res = await getBalances().catch(() => ({ ok: false as const }))
    const balances = res.ok ? res.data : mockBalances()
    totalPoints = balances.reduce((sum, b) => sum + b.balance, 0)
  }

  return (
    <AppShell user={user} pointsTotal={totalPoints} hideSearch>
      <div className="mx-auto flex max-w-[760px] flex-col gap-10 pt-6 sm:pt-12">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex flex-col items-center pt-4 text-center sm:pt-8">
          <span
            className="hop-rise inline-flex items-center gap-2 rounded-full border border-border bg-paper px-4 py-1.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-brand"
            style={{ ['--hop-delay' as string]: '40ms' }}
          >
            <Icon name="lightbulb" size={14} />
            Your points concierge
          </span>

          <h1
            className="hop-rise mt-6 max-w-[18ch] font-display text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-text sm:text-[48px]"
            style={{ ['--hop-delay' as string]: '90ms' }}
          >
            Tell hop what you&apos;re dreaming of.
          </h1>

          <p
            className="hop-rise mt-5 max-w-[48ch] text-[16px] leading-[1.6] text-text2 sm:text-[17px]"
            style={{ ['--hop-delay' as string]: '140ms' }}
          >
            A vibe, a budget, a city you can&apos;t stop thinking about. hop reads
            the points world and tells you where it&apos;s worth going — and
            whether to spend miles or money to get there.
          </p>
        </header>

        {/* ── The concierge ──────────────────────────────────────────────── */}
        <div
          className="hop-rise"
          style={{ ['--hop-delay' as string]: '200ms' }}
        >
          <Concierge totalPoints={totalPoints} />
        </div>

        <SiteFooter />
      </div>
    </AppShell>
  )
}
