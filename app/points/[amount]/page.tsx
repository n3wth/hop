import Link from 'next/link'
import { notFound } from 'next/navigation'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import { pageMeta, absoluteUrl } from '@/lib/seo'
import {
  POINTS_BANDS,
  parsePointsBand,
  pointsBandSlug,
  formatPointsLabel,
  formatPointsCompact,
  neighborBands,
} from '@/lib/points-bands'
import { affordableWith, computeCpp, type Destination } from '@/lib/destinations'
import { tier, formatValue } from '@/lib/cpp'
import type { CppTier } from '@/lib/types'
import { isoOffset } from '@/lib/dates'
import { VERIFY_CAVEAT } from '@/lib/sweet-spots'

// Prerender one page per curated band; nothing else is valid.
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams(): { amount: string }[] {
  return POINTS_BANDS.map((amount) => ({ amount: pointsBandSlug(amount) }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ amount: string }>
}) {
  const { amount: slug } = await params
  const amount = parsePointsBand(slug)
  if (amount === undefined) return {}
  const list = affordableWith(amount)
  return pageMeta({
    title: `Where ${formatPointsCompact(amount)} points can go`,
    description: `${list.length} destinations that typically clear at ${formatPointsLabel(amount)} points or fewer, ranked by cents per point — award miles, cash comparison, and the best program for each. Researched seed figures; verify live before booking.`,
    path: `/points/${slug}`,
  })
}

// cpp tier -> chip palette. Mirrors DealCard/sweet-spots chip conventions.
const TIER_CHIP: Record<CppTier, { bg: string; fg: string; bd: string }> = {
  green: { bg: 'var(--color-good-bg)', fg: 'var(--color-good)', bd: 'var(--color-brand-mint-deep)' },
  amber: { bg: 'var(--color-ok-bg)', fg: 'var(--color-ok)', bd: 'var(--color-gold-soft)' },
  muted: { bg: 'var(--color-sunk)', fg: 'var(--color-text3)', bd: 'var(--color-border)' },
}

// Static seed origin for the CTA link — this page has no request-scoped
// visitor context (it's force-static), so it seeds the same way /deals does
// before an explicit ?from= or saved home airport is known.
const DEFAULT_ORIGIN = 'SFO'

// 37500 -> "37.5K". Compact miles for the row figures (mirrors DealCard).
function compactMiles(n: number): string {
  const k = n / 1000
  return `${Number.isInteger(k) ? k : k.toFixed(1)}K`
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function sentenceCase(s: string): string {
  const t = s.trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t
}

// ItemList + FAQPage JSON-LD, computed from the curated dataset. No user
// input flows in (slug already resolved to a known band), so JSON.stringify
// alone keeps it XSS-safe — same posture as lib/seo.ts#buildJsonLd and
// app/sweet-spots/[program]/page.tsx.
function buildPointsJsonLd(amount: number, list: Destination[]) {
  const url = absoluteUrl(`/points/${pointsBandSlug(amount)}`)
  const itemList = {
    '@type': 'ItemList',
    '@id': `${url}#destinations`,
    name: `Where ${formatPointsLabel(amount)} points typically goes`,
    itemListElement: list.map((d, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluteUrl(`/destinations/${d.code.toLowerCase()}`),
      name: `${d.city}, ${d.country}`,
    })),
  }
  const lead = list[0]
  const leadCpp = lead ? computeCpp(lead) : undefined
  const faq = {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: [
      {
        '@type': 'Question',
        name: `Where can I go with ${formatPointsLabel(amount)} points?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            lead && leadCpp !== undefined
              ? `${list.length} destinations in hop's set typically clear at ${formatPointsLabel(amount)} points or fewer one-way, led by ${lead.city} at about ${formatValue(leadCpp)}. ${VERIFY_CAVEAT}`
              : `Hop tracks a curated set of destinations and their typical one-way award cost — check the list below for what clears at ${formatPointsLabel(amount)} points. ${VERIFY_CAVEAT}`,
        },
      },
    ],
  }
  return { '@context': 'https://schema.org', '@graph': [itemList, faq] }
}

export default async function PointsBandPage({
  params,
}: {
  params: Promise<{ amount: string }>
}) {
  const { amount: slug } = await params
  const amount = parsePointsBand(slug)
  if (amount === undefined) notFound()

  const list = affordableWith(amount)
  const { prev, next } = neighborBands(amount)
  const depart = isoOffset(21)
  const ret = isoOffset(28)
  const jsonLd = buildPointsJsonLd(amount, list)
  const returnTo = encodeURIComponent(`/points/${slug}`)

  return (
    <AppShell user={null} hideSearch>
      {/* computed structured data — ItemList + FAQPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-[var(--container-sm)]">
        {/* breadcrumb back to the index */}
        <nav aria-label="Breadcrumb" className="pt-8 text-[13px] text-text3">
          <Link href="/points" className="font-semibold text-brand hover:text-brand-deep">
            Points
          </Link>
          <span aria-hidden className="px-1.5">
            /
          </span>
          <span className="text-text2">{formatPointsCompact(amount)}</span>
        </nav>

        {/* header — evergreen framing: "N points, here's where that typically
            goes", never a claim that the visitor holds this balance. */}
        <header className="mt-6 max-w-[60ch]">
          <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brand">
            {list.length} {list.length === 1 ? 'destination' : 'destinations'}
          </span>
          <h1 className="mt-3 text-balance font-display text-[32px] font-semibold leading-[1.06] tracking-[-0.02em] text-text sm:text-[46px]">
            Where {formatPointsLabel(amount)} points typically goes
          </h1>
          <p className="mt-4 max-w-[54ch] text-pretty text-[16px] leading-relaxed text-text2 sm:text-[17px]">
            With {formatPointsLabel(amount)} points, here&apos;s where that typically goes — every
            destination hop tracks that clears at this balance or less one-way, ranked by cents
            per point.
          </p>
        </header>

        {/* soft sign-in CTA — never claims the visitor owns this balance;
            offers to reprice against their real one instead. Consistent with
            VerdictRail's owns/hasRealBalances framing. */}
        <div className="mx-auto mt-7 flex flex-col items-center justify-between gap-3 rounded-[16px] border border-border bg-surface px-5 py-4 text-center sm:flex-row sm:gap-4 sm:text-left">
          <span className="text-[14px] leading-[1.5] text-text2">
            <span className="font-semibold text-text">This is a reference balance, not yours.</span>{' '}
            Sign in and hop prices every destination against what you actually hold.
          </span>
          <Link
            href={`/auth/login?returnTo=${returnTo}`}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-[var(--radius)] bg-brand px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-deep"
          >
            Sign in to see it with your real balance
          </Link>
        </div>

        {/* the destination rows — flat editorial, best-cpp-first (already
            sorted by affordableWith) */}
        {list.length > 0 ? (
          <section className="mt-9 divide-y divide-hair border-y border-border">
            {list.map((d) => {
              const value = computeCpp(d)
              const t = tier(value)
              const chip = TIER_CHIP[t]
              const leftover = amount - d.typicalAwardMiles
              const searchHref =
                `/search?from=${DEFAULT_ORIGIN}&to=${d.code}` +
                `&depart=${depart}&ret=${ret}&adults=1`

              return (
                <article
                  key={d.code}
                  className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`fi fi-${d.countryCode} h-[14px] w-[19px] flex-shrink-0 rounded-[2px]`}
                        aria-hidden
                      />
                      <h2 className="font-display text-[20px] font-semibold leading-tight tracking-[-0.01em] text-text">
                        {d.city}
                      </h2>
                      <span className="text-[13px] text-text3">{d.country}</span>
                      {value !== undefined && (
                        <span
                          className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]"
                          style={{ background: chip.bg, color: chip.fg, borderColor: chip.bd }}
                        >
                          {formatValue(value)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2.5 max-w-[60ch] text-[14.5px] leading-relaxed text-text2">
                      {sentenceCase(d.vibe)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-text3">
                      <span>
                        <b className="font-semibold text-text2">{compactMiles(d.typicalAwardMiles)}</b>{' '}
                        miles one-way
                      </span>
                      <span>
                        vs <b className="font-semibold text-text2">{money(d.typicalCashUSD)}</b> cash
                      </span>
                      <span>
                        leaves <b className="font-semibold text-text2">{leftover.toLocaleString('en-US')}</b>{' '}
                        points
                      </span>
                      <span>
                        via <b className="font-semibold text-text2">{d.bestProgram}</b>
                      </span>
                    </div>
                  </div>

                  {/* actions — into the live tool, and the destination guide */}
                  <div className="flex flex-shrink-0 items-center gap-5 sm:flex-col sm:items-end sm:gap-2">
                    <Link
                      href={searchHref}
                      className="text-[14px] font-semibold text-brand hover:text-brand-deep"
                    >
                      See the math →
                    </Link>
                    <Link
                      href={`/destinations/${d.code.toLowerCase()}`}
                      className="text-[13px] text-text3 hover:text-text2"
                    >
                      Full guide
                    </Link>
                  </div>
                </article>
              )
            })}
          </section>
        ) : (
          // Defensive: the dataset + curated bands are static so this
          // shouldn't happen, but never render a bare, dead list if it does.
          <div className="mt-9 rounded-[var(--radius-lg)] border border-border bg-surface px-6 py-12 text-center">
            <p className="text-[15px] text-text2">
              Nothing in hop&apos;s set clears at {formatPointsLabel(amount)} points one-way yet.
              Ask hop where a smaller trip might fit.
            </p>
          </div>
        )}

        {/* accuracy caveat — same seed-reference posture as /sweet-spots */}
        <p className="mt-7 rounded-[var(--radius)] border border-border bg-surface px-4 py-3 text-[13px] leading-relaxed text-text3">
          {VERIFY_CAVEAT}
        </p>

        {/* neighbor bands — "have fewer/more points?" mesh */}
        {(prev !== undefined || next !== undefined) && (
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
            {prev !== undefined && (
              <Link
                href={`/points/${pointsBandSlug(prev)}`}
                className="font-semibold text-brand hover:text-brand-deep"
              >
                ← What {formatPointsCompact(prev)} points gets you
              </Link>
            )}
            {next !== undefined && (
              <Link
                href={`/points/${pointsBandSlug(next)}`}
                className="font-semibold text-brand hover:text-brand-deep"
              >
                What {formatPointsCompact(next)} points gets you →
              </Link>
            )}
          </div>
        )}

        {/* internal-link mesh → live tool + sibling content */}
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
          <span className="text-text3">Next:</span>
          <Link href="/search" className="font-semibold text-brand hover:text-brand-deep">
            Search these routes for your dates
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
