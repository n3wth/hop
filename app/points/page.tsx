import Link from 'next/link'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import EditorialHeader from '@/components/EditorialHeader'
import { pageMeta } from '@/lib/seo'
import { POINTS_BANDS, pointsBandSlug, formatPointsCompact, formatPointsLabel } from '@/lib/points-bands'
import { affordableWith } from '@/lib/destinations'
import { VERIFY_CAVEAT } from '@/lib/sweet-spots'

// Static SEO guide — no per-request data, so it prerenders. Weekly cron
// (app/api/cron/revalidate-seo) calls revalidatePath when content changes.
export const dynamic = 'force-static'

export const metadata = pageMeta({
  title: 'Where can I go with my points?',
  description:
    'Pick a point balance and see every destination that typically clears at it — award miles, cash comparison, and cents per point, best value first.',
  path: '/points',
})

export default function PointsIndexPage() {
  return (
    <AppShell user={null} hideSearch>
      <div className="mx-auto max-w-[var(--container-md)]">
        {/* editorial header */}
        <EditorialHeader
          eyebrow="Points calculator"
          title="Where can I go with my points?"
          titleMaxW="max-w-[24ch]"
          intro="Pick a balance and see every destination hop tracks that typically clears at it — ranked by cents per point. These are reference figures for that balance, not a read of your own account."
          introMaxW="max-w-[54ch]"
        >
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[13px] text-text3">
            <span>
              <b className="font-semibold text-text2">{POINTS_BANDS.length}</b> balances
            </span>
            <span className="hidden sm:inline">·</span>
            <span>best value first</span>
          </div>
        </EditorialHeader>

        {/* the band list — each links to its per-balance guide */}
        <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {POINTS_BANDS.map((amount) => {
            const list = affordableWith(amount)
            const lead = list[0]
            return (
              <Link
                key={amount}
                href={`/points/${pointsBandSlug(amount)}`}
                className="group flex flex-col rounded-[var(--radius-lg)] border border-border bg-paper p-6 transition-colors hover:border-brand"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.01em] text-text">
                    {formatPointsLabel(amount)} points
                  </h2>
                  <span className="flex-shrink-0 text-[13px] font-semibold text-text3">
                    {list.length} {list.length === 1 ? 'destination' : 'destinations'}
                  </span>
                </div>
                {/* the strongest lead destination at this balance, as a teaser */}
                <p className="mt-3 text-[14px] leading-snug text-text2">
                  {lead ? (
                    <>
                      <span className="font-semibold text-text">
                        {lead.city}, {lead.country}
                      </span>{' '}
                      leads — {lead.bestProgram}, about {formatPointsCompact(lead.typicalAwardMiles)} miles
                      one-way.
                    </>
                  ) : (
                    'No destination in hop’s set clears at this balance yet.'
                  )}
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                  <span className="text-[14px] font-semibold text-text transition-colors group-hover:text-brand">
                    See what {formatPointsCompact(amount)} gets you
                  </span>
                  <span
                    aria-hidden
                    className="flex-shrink-0 text-[15px] font-semibold text-text3 transition-colors group-hover:text-brand"
                  >
                    →
                  </span>
                </div>
              </Link>
            )
          })}
        </section>

        {/* accuracy caveat — the table is seed reference data, not live quotes */}
        <p className="mt-8 rounded-[var(--radius)] border border-border bg-surface px-4 py-3 text-[13px] leading-relaxed text-text3">
          {VERIFY_CAVEAT}
        </p>

        {/* internal-link mesh: out to inspiration + the live tool */}
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
          <span className="text-text3">Keep exploring:</span>
          <Link href="/destinations" className="font-semibold text-brand hover:text-brand-deep">
            Destination guides
          </Link>
          <Link href="/sweet-spots" className="font-semibold text-brand hover:text-brand-deep">
            Sweet spots by program
          </Link>
          <Link href="/deals" className="font-semibold text-brand hover:text-brand-deep">
            Today&rsquo;s deals
          </Link>
        </div>

        <SiteFooter />
      </div>
    </AppShell>
  )
}
