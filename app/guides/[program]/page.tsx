import Link from 'next/link'
import { notFound } from 'next/navigation'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import BrandIcon from '@/components/BrandIcon'
import { pageMeta, absoluteUrl } from '@/lib/seo'
import { VERIFY_CAVEAT } from '@/lib/sweet-spots'
import { WALLET_VALUE_CAVEAT } from '@/lib/valuations'
import { allProgramGuideSlugs, programGuideBySlug, type ProgramGuide, type PartnerRow } from '@/lib/program-guides'

// Prerender one page per transferable currency; nothing else is valid.
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams(): { program: string }[] {
  return allProgramGuideSlugs().map((program) => ({ program }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ program: string }>
}) {
  const { program: slug } = await params
  const guide = programGuideBySlug(slug)
  if (!guide) return {}
  return pageMeta({
    title: `Best use of ${guide.name} points`,
    description: `${guide.partners.length} transfer partners for ${guide.name}, ranked by value — ratios, notes, and the sweet-spot redemptions each one unlocks. Baseline ${guide.baselineCpp.toFixed(2)}¢/point.`,
    path: `/guides/${slug}`,
  })
}

// FAQPage + HowTo JSON-LD, computed from the guide's own ranked partner list.
// No user input flows in (slug already resolved to a known guide), so
// JSON.stringify alone keeps it XSS-safe — same posture as components/StructuredData.
function buildGuideJsonLd(guide: ProgramGuide) {
  const url = absoluteUrl(`/guides/${guide.slug}`)
  const top = guide.partners[0]
  const faq = {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: guide.partners.map((p: PartnerRow) => ({
      '@type': 'Question',
      name: `Should I transfer ${guide.name} points to ${p.name}?`,
      acceptedAnswer: {
        '@type': 'Answer',
        text: `${guide.name} transfers to ${p.name} at ${p.ratio}${p.note ? ` (${p.note})` : ''}. ${p.name}'s baseline value is about ${p.baselineCpp.toFixed(2)}¢/point.`,
      },
    })),
  }
  const howTo = {
    '@type': 'HowTo',
    '@id': `${url}#howto`,
    name: `Best use of ${guide.name} points`,
    description: `The highest-value transfer for ${guide.name} is ${top.name} at ${top.ratio}. ${VERIFY_CAVEAT}`,
    step: guide.partners.map((p: PartnerRow, i: number) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: `Transfer to ${p.name}`,
      text: `${p.ratio}${p.note ? ` — ${p.note}` : ''}. Baseline value ~${p.baselineCpp.toFixed(2)}¢/point.`,
    })),
  }
  return { '@context': 'https://schema.org', '@graph': [faq, howTo] }
}

export default async function ProgramGuidePage({
  params,
}: {
  params: Promise<{ program: string }>
}) {
  const { program: slug } = await params
  const guide = programGuideBySlug(slug)
  if (!guide) notFound()

  const jsonLd = buildGuideJsonLd(guide)

  return (
    <AppShell user={null} hideSearch>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-[var(--container-sm)]">
        <nav aria-label="Breadcrumb" className="pt-8 text-[13px] text-text3">
          <Link href="/guides" className="font-semibold text-brand hover:text-brand-deep">
            Program guides
          </Link>
          <span aria-hidden className="px-1.5">
            /
          </span>
          <span className="text-text2">{guide.name}</span>
        </nav>

        <header className="mt-6 flex max-w-[60ch] items-start gap-4">
          <BrandIcon code={guide.code} name={guide.name} size={72} />
          <div className="min-w-0">
            <span className="text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand">
              {guide.partners.length} transfer {guide.partners.length === 1 ? 'partner' : 'partners'}
            </span>
            <h1 className="mt-3 text-balance font-display text-[32px] font-semibold leading-[1.06] tracking-[-0.02em] text-text sm:text-[46px]">
              Best use of {guide.name} points
            </h1>
            <p className="mt-4 max-w-[52ch] text-pretty text-[16px] leading-relaxed text-text2 sm:text-[17px]">
              {guide.name} is worth about {guide.baselineCpp.toFixed(2)}¢/point cashed out on its own.
              Transfer to the partner below to clear the sweet spot you want.
            </p>
          </div>
        </header>

        {/* transfer partners — ranked by the partner's own baseline value */}
        <section className="mt-9 divide-y divide-hair border-y border-border">
          {guide.partners.map((p) => (
            <article key={p.id} className="grid grid-cols-1 gap-3 py-6 sm:grid-cols-[1fr_auto] sm:gap-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <BrandIcon code={p.code} name={p.name} size={28} />
                  <h2 className="font-display text-[20px] font-semibold leading-tight tracking-[-0.01em] text-text">
                    {p.name}
                  </h2>
                  <span
                    className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[var(--track-label)]"
                    style={{
                      background: 'var(--color-good-bg)',
                      color: 'var(--color-good)',
                      borderColor: 'var(--color-brand-mint-deep)',
                    }}
                  >
                    {p.ratio}
                  </span>
                </div>
                {p.note && (
                  <p className="mt-2 max-w-[60ch] text-[13.5px] leading-relaxed text-text3">{p.note}</p>
                )}
                {p.sweetSpots.length > 0 && (
                  <p className="mt-2.5 max-w-[60ch] text-[14.5px] leading-relaxed text-text2">
                    Sweet spot:{' '}
                    <Link
                      href={`/sweet-spots/${p.sweetSpots[0].programSlug}`}
                      className="font-semibold text-brand hover:text-brand-deep"
                    >
                      {p.sweetSpots[0].route}
                    </Link>
                    {' — '}
                    {p.sweetSpots[0].cabin}
                    {p.sweetSpots[0].metal ? ` on ${p.sweetSpots[0].metal}` : ''}, {p.sweetSpots[0].milesLabel}{' '}
                    miles.
                  </p>
                )}
              </div>

              <div className="flex-shrink-0 sm:text-right">
                <div className="text-[10px] font-semibold uppercase tracking-[var(--track-label)] text-text3">
                  Baseline value
                </div>
                <div className="mt-1 font-display text-[24px] font-semibold leading-none tabular-nums text-text">
                  {p.baselineCpp.toFixed(2)}¢
                </div>
                {p.minimum != null && (
                  <div className="mt-1 text-[12px] text-text3">{p.minimum.toLocaleString()} pt min</div>
                )}
              </div>
            </article>
          ))}
        </section>

        <p className="mt-7 rounded-[var(--radius)] border border-border bg-surface px-4 py-3 text-[14px] leading-relaxed text-text3">
          {WALLET_VALUE_CAVEAT} {VERIFY_CAVEAT}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
          <span className="text-text3">Next:</span>
          <Link href="/search" className="font-semibold text-brand hover:text-brand-deep">
            Search these routes for your dates
          </Link>
          <Link href="/sweet-spots" className="font-semibold text-brand hover:text-brand-deep">
            All sweet spots
          </Link>
          <Link href="/points" className="font-semibold text-brand hover:text-brand-deep">
            Where can I go with my points?
          </Link>
        </div>

        <SiteFooter />
      </div>
    </AppShell>
  )
}
