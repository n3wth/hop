import { auth0 } from '@/lib/auth0'
import { getUserBalances } from '@/lib/accounts'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import LegalShell from '@/components/LegalShell'
import { getTrustStats } from '@/lib/trust-stats'
import { pageMeta } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata = pageMeta({
  title: 'Trust & reliability',
  description: 'How many loyalty programs hop has live-verified pricing for, right now.',
  path: '/stats',
})

function fmtDegradation(n: number | null): string {
  return n === null ? 'unknown' : String(n)
}

export default async function StatsPage() {
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

  let pointsTotal: number | undefined
  if (user && su?.sub) {
    const real = await getUserBalances(su.sub)
    if (real.length > 0) pointsTotal = real.reduce((s, b) => s + b.balance, 0)
  }

  const stats = await getTrustStats()
  // Pacific time with an explicit zone label — the server renders in UTC, and a
  // bare server-local time read as wrong to anyone comparing it to their clock.
  const asOfLabel = new Date(stats.asOf).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'short',
  })

  return (
    <AppShell user={user} pointsTotal={pointsTotal} hideSearch>
      <LegalShell
        eyebrow="Trust"
        title="Trust & reliability"
        intro="hop's engine never fabricates a number and never crashes on a dead upstream — it degrades a section instead. These are the real, computed figures behind that claim."
      >
        <dl className="space-y-8 border-t border-border-soft pt-8">
          <div>
            <dt className="text-[13px] text-text3">Live-verified pricing</dt>
            <dd className="mt-1 font-mono text-[24px] font-semibold tracking-[-0.02em] text-text">
              {stats.verifiedPrograms} of {stats.totalPrograms}
            </dd>
            <p className="mt-1 max-w-[52ch] text-[14px] leading-[1.5]">
              loyalty programs are currently priced from hop&rsquo;s own observed cash-vs-award
              data, not just the static baseline table.
            </p>
          </div>

          <div>
            <dt className="text-[13px] text-text3">Degraded searches, last 24h</dt>
            <dd className="mt-1 font-mono text-[24px] font-semibold tracking-[-0.02em] text-text">
              cash {fmtDegradation(stats.degradation24h.cash)} · awards{' '}
              {fmtDegradation(stats.degradation24h.awards)}
            </dd>
            <p className="mt-1 max-w-[52ch] text-[14px] leading-[1.5]">
              counted times a search fell back gracefully because a cash or award source was
              unavailable. &ldquo;unknown&rdquo; means this isn&rsquo;t being tracked right now, not
              that nothing degraded.
            </p>
          </div>
        </dl>

        <p className="mt-10 text-[13px] text-text3">As of {asOfLabel}.</p>
      </LegalShell>
      {/* No width wrapper — SiteFooter centers itself on --container-shell, the
          same width as the header, on every page. */}
      <SiteFooter />
    </AppShell>
  )
}
