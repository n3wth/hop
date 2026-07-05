import Link from 'next/link'
import { notFound } from 'next/navigation'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import CoverArt from '@/components/CoverArt'
import { pageMeta, absoluteUrl } from '@/lib/seo'
import { allPrograms, VERIFY_CAVEAT, type Cabin, type Program, type SweetSpot } from '@/lib/sweet-spots'
import { getProgramBySlug } from '@/lib/sweet-spots-live'

// Prerender one page per program; nothing else is valid. Static params come
// from the STATIC table only (never the DB) — a draft can only add spots to
// an existing program, never introduce a new one, so build-time route
// generation doesn't need the drafts queue. See lib/sweet-spot-drafts.ts.
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams(): { program: string }[] {
  return allPrograms().map((program) => ({ program }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ program: string }>
}) {
  const { program: slug } = await params
  const program = await getProgramBySlug(slug)
  if (!program) return {}
  const count = program.spots.length
  return pageMeta({
    title: `${program.name} sweet spots`,
    description: `The ${count} best award redemptions to book with ${program.name} — route, cabin, and typical miles for each. Researched seed figures; verify live before booking.`,
    path: `/sweet-spots/${slug}`,
  })
}

// Cabin → chip palette. Premium reads teal (strong-value cue), economy neutral.
const CABIN_CHIP: Record<Cabin, { bg: string; fg: string; bd: string }> = {
  First: { bg: 'var(--color-good-bg)', fg: 'var(--color-good)', bd: 'var(--color-brand-mint-deep)' },
  Business: { bg: 'var(--color-good-bg)', fg: 'var(--color-good)', bd: 'var(--color-brand-mint-deep)' },
  Economy: { bg: 'var(--color-sunk)', fg: 'var(--color-text3)', bd: 'var(--color-border)' },
}

// FAQPage + HowTo JSON-LD, computed from the program's spots. No user input
// flows in (slug already resolved to a known program), so JSON.stringify alone
// keeps it XSS-safe — same posture as components/StructuredData.
function buildProgramJsonLd(program: Program) {
  const url = absoluteUrl(`/sweet-spots/${program.slug}`)
  const faq = {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: program.spots.map((s: SweetSpot) => ({
      '@type': 'Question',
      name: `What's a sweet-spot redemption for ${s.route} with ${program.name}?`,
      acceptedAnswer: {
        '@type': 'Answer',
        text: `${s.cabin}${s.metal ? ` on ${s.metal}` : ''} for about ${s.milesLabel} miles one-way. ${s.why}`,
      },
    })),
  }
  const howTo = {
    '@type': 'HowTo',
    '@id': `${url}#howto`,
    name: `How to book ${program.name} award sweet spots`,
    description: `Find and book the best-value ${program.name} award redemptions. ${VERIFY_CAVEAT}`,
    step: program.spots.map((s: SweetSpot, i: number) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: `${s.route} — ${s.cabin}`,
      text: `${s.cabin}${s.metal ? ` on ${s.metal}` : ''} for ~${s.milesLabel} miles. ${s.why}`,
    })),
  }
  return { '@context': 'https://schema.org', '@graph': [faq, howTo] }
}

export default async function ProgramSweetSpotsPage({
  params,
}: {
  params: Promise<{ program: string }>
}) {
  const { program: slug } = await params
  const program = await getProgramBySlug(slug)
  if (!program) notFound()

  const jsonLd = buildProgramJsonLd(program)

  return (
    <AppShell user={null} hideSearch>
      {/* computed structured data — FAQPage + HowTo */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-[var(--container-sm)]">
        {/* breadcrumb back to the index */}
        <nav aria-label="Breadcrumb" className="pt-8 text-[13px] text-text3">
          <Link href="/sweet-spots" className="font-semibold text-brand hover:text-brand-deep">
            Sweet spots
          </Link>
          <span aria-hidden className="px-1.5">
            /
          </span>
          <span className="text-text2">{program.name}</span>
        </nav>

        {/* header — the cover art shares the index tile's seed (program.slug),
            so it's the same artwork the reader saw on the /sweet-spots shelf,
            just at the header size class (experience-heuristics.md #16) */}
        <header className="mt-6 flex max-w-[60ch] items-start gap-4">
          <CoverArt
            seed={program.slug}
            decorative
            size={72}
            className="flex-shrink-0 rounded-[var(--radius)]"
          />
          <div className="min-w-0">
            <span className="text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand">
              {program.spots.length} {program.spots.length === 1 ? 'redemption' : 'redemptions'}
            </span>
            <h1 className="mt-3 text-balance font-display text-[32px] font-semibold leading-[1.06] tracking-[-0.02em] text-text sm:text-[46px]">
              Best uses of {program.name} miles
            </h1>
            <p className="mt-4 max-w-[52ch] text-pretty text-[16px] leading-relaxed text-text2 sm:text-[17px]">
              The redemptions where {program.name} beats cash by the widest margin —
              premium cabins first.
            </p>
          </div>
        </header>

        {/* the redemption rows — flat editorial, one per spot */}
        <section className="mt-9 divide-y divide-hair border-y border-border">
          {program.spots.map((s) => {
            const chip = CABIN_CHIP[s.cabin]
            return (
              <article key={s.id} className="grid grid-cols-1 gap-3 py-6 sm:grid-cols-[1fr_auto] sm:gap-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-[20px] font-semibold leading-tight tracking-[-0.01em] text-text">
                      {s.route}
                    </h2>
                    <span
                      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[var(--track-label)]"
                      style={{ background: chip.bg, color: chip.fg, borderColor: chip.bd }}
                    >
                      {s.cabin}
                    </span>
                    {s.confidence === 'med' && (
                      <span
                        className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[var(--track-label)]"
                        style={{
                          background: 'var(--color-ok-bg)',
                          color: 'var(--color-ok)',
                          borderColor: 'var(--color-gold-soft)',
                        }}
                      >
                        Soft figure
                      </span>
                    )}
                  </div>
                  {s.metal && (
                    <p className="mt-1 text-[13px] font-semibold uppercase tracking-[var(--track-label)] text-text3">
                      on {s.metal} metal
                    </p>
                  )}
                  <p className="mt-2.5 max-w-[60ch] text-[14.5px] leading-relaxed text-text2">
                    {s.why}
                  </p>
                </div>

                {/* the figure — typical one-way miles */}
                <div className="flex-shrink-0 sm:text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-[var(--track-label)] text-text3">
                    ~Miles one-way
                  </div>
                  <div className="mt-1 font-display text-[24px] font-semibold leading-none tabular-nums text-text">
                    {s.milesLabel}
                  </div>
                </div>
              </article>
            )
          })}
        </section>

        {/* accuracy caveat */}
        <p className="mt-7 rounded-[var(--radius)] border border-border bg-surface px-4 py-3 text-[14px] leading-relaxed text-text3">
          {VERIFY_CAVEAT}
        </p>

        {/* internal-link mesh → live tool + sibling content */}
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
          <span className="text-text3">Next:</span>
          <Link href="/search" className="font-semibold text-brand hover:text-brand-deep">
            Search these routes for your dates
          </Link>
          <Link href="/deals" className="font-semibold text-brand hover:text-brand-deep">
            Today’s deals
          </Link>
          <Link href="/destinations" className="font-semibold text-brand hover:text-brand-deep">
            Destination guides
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-[var(--container-shell)]">
        <SiteFooter />
      </div>
    </AppShell>
  )
}
