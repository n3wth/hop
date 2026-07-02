import Link from 'next/link'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import EditorialHeader from '@/components/EditorialHeader'
import { pageMeta } from '@/lib/seo'
import { sweetSpotsByProgram, sweetSpots, VERIFY_CAVEAT } from '@/lib/sweet-spots'

// Static SEO guide — no per-request data, so it prerenders. Weekly cron
// (app/api/cron/revalidate-seo) calls revalidatePath when content changes.
export const dynamic = 'force-static'

export const metadata = pageMeta({
  title: 'Award sweet spots by program',
  description:
    'The standout award redemptions worth your miles, grouped by the program that books them. Every figure is a researched seed reference — verify live before booking.',
  path: '/sweet-spots',
})

export default function SweetSpotsIndexPage() {
  const programs = sweetSpotsByProgram()

  return (
    <AppShell user={null} hideSearch>
      <div className="mx-auto max-w-[var(--container-md)]">
        {/* editorial header */}
        <EditorialHeader
          eyebrow="Sweet spots"
          title="The best uses of your miles, by program"
          titleMaxW="max-w-[20ch]"
          intro="Each program books a handful of routes where points crush cash. Pick the currency you hold and see its standout redemptions, ranked."
          introMaxW="max-w-[52ch]"
        >
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[13px] text-text3">
            <span>
              <b className="font-semibold text-text2">{programs.length}</b> programs
            </span>
            <span className="hidden sm:inline">·</span>
            <span>
              <b className="font-semibold text-text2">{sweetSpots.length}</b> redemptions
            </span>
            <span className="hidden sm:inline">·</span>
            <span>premium cabins first</span>
          </div>
        </EditorialHeader>

        {/* the program list — each links to its per-program guide */}
        <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {programs.map((p) => {
            const lead = p.spots[0]
            return (
              <Link
                key={p.slug}
                href={`/sweet-spots/${p.slug}`}
                className="group flex flex-col rounded-[var(--radius-lg)] border border-border bg-paper p-6 transition-[transform,border-color] duration-200 ease-[var(--ease-premium)] hover:-translate-y-[2px] hover:border-brand motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.01em] text-text">
                    {p.name}
                  </h2>
                  <span className="flex-shrink-0 text-[13px] font-semibold text-text3">
                    {p.spots.length} {p.spots.length === 1 ? 'route' : 'routes'}
                  </span>
                </div>
                {/* the program's strongest lead redemption, as a teaser */}
                <p className="mt-3 text-[14px] leading-snug text-text2">
                  <span className="font-semibold text-text">{lead.route}</span>
                  {' — '}
                  {lead.cabin}
                  {lead.metal ? ` on ${lead.metal}` : ''}, {lead.milesLabel} miles.
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                  <span className="text-[14px] font-semibold text-text transition-colors group-hover:text-brand">
                    See {p.name} sweet spots
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
        <p className="mt-8 rounded-[var(--radius)] border border-border bg-surface px-4 py-3 text-[14px] leading-relaxed text-text3">
          {VERIFY_CAVEAT}
        </p>

        {/* internal-link mesh: out to inspiration + the live tool */}
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
          <span className="text-text3">Keep exploring:</span>
          <Link href="/destinations" className="font-semibold text-brand hover:text-brand-deep">
            Destination guides
          </Link>
          <Link href="/deals" className="font-semibold text-brand hover:text-brand-deep">
            Today’s deals
          </Link>
          <Link href="/search" className="font-semibold text-brand hover:text-brand-deep">
            Run a search
          </Link>
        </div>

        <SiteFooter />
      </div>
    </AppShell>
  )
}
