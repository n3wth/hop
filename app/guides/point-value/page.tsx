import Link from 'next/link'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import EditorialHeader from '@/components/EditorialHeader'
import BrandIcon from '@/components/BrandIcon'
import Card from '@/components/ui/Card'
import { pageMeta, absoluteUrl } from '@/lib/seo'
import { cpp, tier, formatValue, GREEN_TIER_CPP, AMBER_TIER_CPP, POINTS_THRESHOLD_CPP } from '@/lib/cpp'
import { listValuations, WALLET_VALUE_CAVEAT } from '@/lib/valuations'
import { programById } from '@/lib/programs'
import type { CppTier } from '@/lib/types'

// Evergreen methodology explainer — the R2 content-plan P1 "points-valuation
// explainer" ("what's a point worth?" + hop's cpp methodology). No per-request
// data (every number is either a pure lib/cpp.ts constant/computation or the
// static lib/valuations.ts baseline table), so it prerenders like the other
// /guides pages. Weekly SEO cron revalidates it alongside the rest of /guides.
export const dynamic = 'force-static'

export const metadata = pageMeta({
  title: "What's a point worth? hop's cpp methodology",
  description:
    "How hop computes cents per point (cpp) — the formula, the 3.0/1.5¢ tier benchmark, and hop's baseline valuation for every major program. Computed, not guessed.",
  path: '/guides/point-value',
})

import { TierChip } from '@/components/ui/TierChip'

// The canonical worked example (docs/design/copy-spec.md, lib/mock.ts): SFO->LAX
// round trip, cash $254, Alaska saver 9,000 miles + $22.40 taxes -> 2.6cpp. Run
// through the real engine function — the number on the page is computed here,
// never hand-typed.
const EXAMPLE_CASH = 254
const EXAMPLE_TAXES = 22.4
const EXAMPLE_MILES = 9000
const EXAMPLE_TAXES_LABEL = EXAMPLE_TAXES.toFixed(2)

// Baseline table, ranked best value first — same ordering convention as the
// /guides program-guide partner rows.
function rankedBaseline(): { id: string; name: string; code: string; value: number; t: CppTier }[] {
  const table = listValuations()
  return Object.entries(table)
    .map(([id, value]) => {
      const def = programById(id)
      return { id, name: def?.name ?? id, code: def?.code ?? id.slice(0, 2).toUpperCase(), value, t: tier(value) }
    })
    .sort((a, b) => b.value - a.value)
}

// FAQPage JSON-LD, built entirely from lib/cpp.ts + lib/valuations.ts values.
// No user input flows in, so JSON.stringify alone keeps it XSS-safe (same
// posture as lib/seo.ts#buildJsonLd and the other /guides pages).
function buildPointValueJsonLd(exampleCpp: number | undefined, top: { name: string; value: number }) {
  const url = absoluteUrl('/guides/point-value')
  const faq = {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is cents per point (cpp)?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Cents per point is what one point or mile is actually worth in a redemption: (cash price − taxes) × 100 ÷ points required. hop computes it for every award it prices — it's never a flat, published rate.`,
        },
      },
      {
        '@type': 'Question',
        name: "What's a good cents-per-point value?",
        acceptedAnswer: {
          '@type': 'Answer',
          text: `hop tiers every redemption: ${GREEN_TIER_CPP.toFixed(1)}¢/pt or more is strong value, ${AMBER_TIER_CPP.toFixed(1)}¢/pt to ${GREEN_TIER_CPP.toFixed(1)}¢/pt is fair, and below ${AMBER_TIER_CPP.toFixed(1)}¢/pt you're usually better off paying cash. hop's own use-points line sits at ${POINTS_THRESHOLD_CPP.toFixed(1)}¢/pt.`,
        },
      },
      {
        '@type': 'Question',
        name: 'What is a point worth, on average?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `It depends on the program — hop keeps a baseline valuation for every major currency; the highest today is ${top.name} at about ${top.value.toFixed(2)}¢/point. ${WALLET_VALUE_CAVEAT}`,
        },
      },
      ...(exampleCpp !== undefined
        ? [
            {
              '@type': 'Question',
              name: 'Can you show a worked example?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: `A $${EXAMPLE_CASH} round trip booked instead for ${EXAMPLE_MILES.toLocaleString('en-US')} miles plus $${EXAMPLE_TAXES_LABEL} taxes works out to ${formatValue(exampleCpp)} — (${EXAMPLE_CASH} − ${EXAMPLE_TAXES_LABEL}) × 100 ÷ ${EXAMPLE_MILES}.`,
              },
            },
          ]
        : []),
    ],
  }
  return { '@context': 'https://schema.org', '@graph': [faq] }
}

export default function PointValuePage() {
  const exampleCpp = cpp(EXAMPLE_CASH, EXAMPLE_TAXES, EXAMPLE_MILES)
  const baseline = rankedBaseline()
  const top = baseline[0]
  const jsonLd = buildPointValueJsonLd(exampleCpp, top)

  return (
    <AppShell user={null} hideSearch>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-[var(--container-shell)]">
        <nav aria-label="Breadcrumb" className="mx-auto max-w-[var(--container-sm)] pt-8 text-[13px] text-text3">
          <Link href="/guides" className="font-semibold text-brand hover:text-brand-deep">
            Program guides
          </Link>
          <span aria-hidden className="px-1.5">
            /
          </span>
          <span className="text-text2">What&rsquo;s a point worth</span>
        </nav>

        <EditorialHeader
          eyebrow="Point valuation methodology"
          title="What's your point actually worth?"
          titleMaxW="max-w-[24ch]"
          intro="Most sites publish one static number per program and call it done. hop computes cents per point (cpp) for every redemption it prices — the same formula, every time, never a guess."
          introMaxW="max-w-[58ch]"
        />

        {/* the formula, run through the real function so the worked example is
            computed on the page, not hand-typed */}
        <section className="mx-auto mt-10 max-w-[var(--container-sm)]">
          <h2 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.01em] text-text">
            The formula
          </h2>
          <p className="mt-3 max-w-[62ch] text-[15.5px] leading-relaxed text-text2">
            <code className="rounded-[6px] bg-surface px-1.5 py-0.5 text-[14px] text-text">
              ¢/pt = (cash − taxes) × 100 ÷ points
            </code>
            . Back out the taxes and fees you&rsquo;d pay either way, then divide the cash price by
            the points required. Higher is better.
          </p>

          {exampleCpp !== undefined && (
            <Card surface="paper" radius="lg" className="mt-5 p-5 sm:p-6">
              <div className="text-[12px] font-semibold uppercase tracking-[var(--track-label)] text-text3">
                Worked example
              </div>
              <p className="mt-2 max-w-[58ch] text-[15px] leading-relaxed text-text2">
                A ${EXAMPLE_CASH} round trip, booked instead for{' '}
                <b className="font-semibold text-text2">{EXAMPLE_MILES.toLocaleString('en-US')} miles</b> +{' '}
                <b className="font-semibold text-text2">${EXAMPLE_TAXES_LABEL} taxes</b>:
              </p>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="font-display text-[34px] font-semibold leading-none tabular-nums text-text">
                  {formatValue(exampleCpp)}
                </span>
                <TierChip cpp={exampleCpp} />
              </div>
              <p className="mt-2 text-[13px] text-text3">
                (${EXAMPLE_CASH} − ${EXAMPLE_TAXES_LABEL}) × 100 ÷ {EXAMPLE_MILES.toLocaleString('en-US')} ={' '}
                {formatValue(exampleCpp)}
              </p>
            </Card>
          )}
        </section>

        {/* the tier bar — GREEN_TIER_CPP / AMBER_TIER_CPP / POINTS_THRESHOLD_CPP,
            pulled straight from lib/cpp.ts, never hand-typed */}
        <section className="mx-auto mt-10 max-w-[var(--container-sm)]">
          <h2 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.01em] text-text">
            hop&rsquo;s tier bar
          </h2>
          <p className="mt-3 max-w-[62ch] text-[15.5px] leading-relaxed text-text2">
            Every redemption hop prices gets sorted into one of three tiers, and the same lines
            drive the &ldquo;use points vs. pay cash&rdquo; verdict.
          </p>
          <div className="mt-5 divide-y divide-hair border-y border-border">
            <div className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <TierChip cpp={GREEN_TIER_CPP} />
                <span className="ml-3 text-[14.5px] text-text2">Strong value — book with points.</span>
              </div>
              <span className="flex-shrink-0 font-display text-[16px] font-semibold tabular-nums text-text">
                ≥ {GREEN_TIER_CPP.toFixed(1)}¢/pt
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <TierChip cpp={AMBER_TIER_CPP} />
                <span className="ml-3 text-[14.5px] text-text2">Fair value — fine, not great.</span>
              </div>
              <span className="flex-shrink-0 font-display text-[16px] font-semibold tabular-nums text-text">
                ≥ {AMBER_TIER_CPP.toFixed(1)}¢/pt
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <TierChip cpp={0} />
                <span className="ml-3 text-[14.5px] text-text2">Weak value — pay cash instead.</span>
              </div>
              <span className="flex-shrink-0 font-display text-[16px] font-semibold tabular-nums text-text">
                &lt; {AMBER_TIER_CPP.toFixed(1)}¢/pt
              </span>
            </div>
          </div>
          <p className="mt-4 max-w-[62ch] text-[14px] leading-relaxed text-text3">
            hop&rsquo;s own &ldquo;use your points&rdquo; call kicks in once the best award clears{' '}
            <b className="font-semibold text-text2">{POINTS_THRESHOLD_CPP.toFixed(1)}¢/pt</b> — below that
            line, cash is usually the better buy.
          </p>
        </section>

        {/* baseline valuation table — lib/valuations.ts BASELINE_CPP, ranked */}
        <section className="mx-auto mt-10 max-w-[var(--container-sm)]">
          <h2 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.01em] text-text">
            hop&rsquo;s baseline valuation, program by program
          </h2>
          <p className="mt-3 max-w-[62ch] text-[15.5px] leading-relaxed text-text2">
            This is what hop assumes a point is worth if you don&rsquo;t have a specific redemption
            priced yet — a typical, achievable value via a good transfer or booking, not a floor or a
            ceiling. It grounds the concierge and every wallet total; a live search always overrides
            it with the real number for that trip.
          </p>
          <div className="mt-5 divide-y divide-hair border-y border-border">
            {baseline.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <BrandIcon code={row.code} name={row.name} size={28} />
                  <span className="truncate text-[14.5px] font-medium text-text">{row.name}</span>
                </div>
                <TierChip cpp={row.value} />
              </div>
            ))}
          </div>
          <Card surface="surface" className="mt-4 px-4 py-3 text-[14px] leading-relaxed text-text3">
            {WALLET_VALUE_CAVEAT}
          </Card>
        </section>

        {/* how this differs from a static blog chart */}
        <section className="mx-auto mt-10 max-w-[var(--container-sm)]">
          <h2 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.01em] text-text">
            Why this isn&rsquo;t just another valuation chart
          </h2>
          <p className="mt-3 max-w-[62ch] text-[15.5px] leading-relaxed text-text2">
            The table above is a starting point, not the answer. Most valuation charts stop there —
            one number per program, updated by hand every few months. hop uses that table as a
            baseline, then computes the real cpp for the specific cash fare and published saver
            chart in front of you. Chart miles are floors — space is not confirmed. Every search
            hop runs also feeds an anonymized cpp observation back into a
            per-program running average; once a program has enough recent, trustworthy samples, hop
            can lean on that observed value instead of the static baseline. The number you see on a
            search result is always the computed one — this page is the methodology behind it, not a
            substitute for it.
          </p>
        </section>

        {/* internal-link mesh -> live tool + sibling content */}
        <div className="mx-auto mt-10 flex max-w-[var(--container-sm)] flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
          <span className="text-text3">Next:</span>
          <Link href="/guides/points-101" className="font-semibold text-brand hover:text-brand-deep">
            New to points? Start here
          </Link>
          <Link href="/search" className="font-semibold text-brand hover:text-brand-deep">
            Try it live — price a real trip
          </Link>
          <Link href="/guides" className="font-semibold text-brand hover:text-brand-deep">
            Best use of your points, by currency
          </Link>
          <Link href="/sweet-spots" className="font-semibold text-brand hover:text-brand-deep">
            Sweet spots by program
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-[var(--container-shell)]">
        <SiteFooter />
      </div>
    </AppShell>
  )
}
