import Link from 'next/link'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import EditorialHeader from '@/components/EditorialHeader'
import BrandIcon from '@/components/BrandIcon'
import { pageMeta } from '@/lib/seo'
import { VERIFY_CAVEAT } from '@/lib/sweet-spots'
import { programGuides } from '@/lib/program-guides'

// Static SEO guide tree — no per-request data, so it prerenders. Weekly cron
// (app/api/cron/revalidate-seo) calls revalidatePath when the underlying
// transfer/valuation tables change.
export const dynamic = 'force-static'

export const metadata = pageMeta({
  title: 'How to use your points — the 5 major transferable currencies',
  description:
    'Best use of Amex, Chase, Citi, Capital One, and Bilt points — every transfer partner, its ratio, and the sweet-spot redemptions each one unlocks, ranked by value.',
  path: '/guides',
})

export default function ProgramGuidesIndexPage() {
  const guides = programGuides()

  return (
    <AppShell user={null} hideSearch>
      <div className="mx-auto max-w-[var(--container-shell)]">
        <EditorialHeader
          eyebrow="Program guides"
          title="Best use of your points, currency by currency"
          titleMaxW="max-w-[26ch]"
          intro="Each transferable currency reaches a different set of airlines and hotels. Pick the one you hold and see every partner, its ratio, and the sweet spots it unlocks — ranked by value."
          introMaxW="max-w-[56ch]"
        >
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[13px] text-text3">
            <span>
              <b className="font-semibold text-text2">{guides.length}</b> currencies
            </span>
            <span className="hidden sm:inline">·</span>
            <span>best transfer first</span>
          </div>
        </EditorialHeader>

        <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {guides.map((g) => {
            const top = g.partners[0]
            return (
              <Link
                key={g.slug}
                href={`/guides/${g.slug}`}
                className="group flex flex-col rounded-[var(--radius-lg)] border border-border bg-paper p-6 transition-colors duration-200 ease-[var(--ease-premium)] hover:border-brand"
              >
                <div className="flex items-center gap-3">
                  <BrandIcon code={g.code} name={g.name} size={48} />
                  <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                    <h2 className="font-display text-[20px] font-semibold leading-tight tracking-[-0.01em] text-text">
                      {g.name}
                    </h2>
                    <span className="flex-shrink-0 text-[13px] font-semibold text-text3">
                      {g.partners.length} partners
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-[14px] leading-snug text-text2">
                  Best transfer: <span className="font-semibold text-text">{top.name}</span> at{' '}
                  {top.ratio} — {top.baselineCpp.toFixed(2)}¢ baseline.
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                  <span className="text-[14px] font-semibold text-text transition-colors group-hover:text-brand">
                    See {g.name} transfer partners
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

        <p className="mt-8 rounded-[var(--radius)] border border-border bg-surface px-4 py-3 text-[14px] leading-relaxed text-text3">
          {VERIFY_CAVEAT} Baseline cpp figures are typical published valuations (lib/valuations.ts),
          not a live quote.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
          <span className="text-text3">Keep exploring:</span>
          <Link href="/sweet-spots" className="font-semibold text-brand hover:text-brand-deep">
            Sweet spots by program
          </Link>
          <Link href="/points" className="font-semibold text-brand hover:text-brand-deep">
            Where can I go with my points?
          </Link>
          <Link href="/search" className="font-semibold text-brand hover:text-brand-deep">
            Run a search
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-[var(--container-shell)]">
        <SiteFooter />
      </div>
    </AppShell>
  )
}
