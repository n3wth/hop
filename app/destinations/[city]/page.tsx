import Link from 'next/link'
import { notFound } from 'next/navigation'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import { pageMeta, absoluteUrl } from '@/lib/seo'
import {
  destinations,
  destinationByCode,
  computeCpp,
  imageQuery,
  type Destination,
} from '@/lib/destinations'
import { tier, formatValue } from '@/lib/cpp'
import { destinationImage } from '@/lib/images'
import { isoOffset } from '@/lib/dates'
import { sweetSpotsByProgram, type Program } from '@/lib/sweet-spots'
import { computeSeasonality } from '@/lib/climate'
import { CLIMATE_NORMALS } from '@/lib/climate-normals'
import ClimateStrip from '@/components/ClimateStrip'
import Essentials from '@/components/Essentials'

// Prerender one page per destination code; nothing else is valid.
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams(): { city: string }[] {
  return destinations.map((d) => ({ city: d.code.toLowerCase() }))
}

function resolve(cityParam: string): Destination | undefined {
  return destinationByCode(cityParam)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>
}) {
  const { city } = await params
  const dest = resolve(city)
  if (!dest) return {}
  const value = computeCpp(dest)
  const valueNote = value !== undefined ? ` at ~${formatValue(value)}` : ''
  return pageMeta({
    title: `${dest.city} with points`,
    description: `How to get to ${dest.city}, ${dest.country} with points — the vibe, when to go, and the award sweet spot${valueNote}. ${dest.bestProgram} books it.`,
    path: `/destinations/${dest.code.toLowerCase()}`,
  })
}

// Region → a plain, generic "when to go" hint. Not city-specific invention —
// hemisphere/latitude seasonality only, stated as the broad rule it is. Honest
// about being general guidance, not a forecast.
const SEASON_BY_REGION: Record<string, string> = {
  Asia: 'Spring (Mar–Apr) and autumn (Oct–Nov) trade heat and rain for mild, clear days. Avoid the summer monsoon.',
  Europe: 'Shoulder season — May–Jun and Sep–Oct — means thinner crowds and lower award demand than peak July–August.',
  'North America': 'Late spring and early autumn balance weather and crowds; award space loosens outside summer and the winter holidays.',
  'South America': 'Seasons flip below the equator. The Sep–Nov and Mar–May shoulders are reliably pleasant.',
  Oceania: 'Down under, summer runs Dec–Feb. The Oct–Nov and Mar–Apr shoulders are warm with fewer crowds.',
  Africa: 'Dry season is the easy window. Aim for the shoulder months either side of peak to ease crowds and prices.',
  'Middle East': 'Skip the high-summer heat — Nov–Mar is the comfortable, walkable window.',
}

// A practical, non-fabricated "good to know" derived from the tags we hold.
function goodToKnow(dest: Destination): string {
  const t = new Set(dest.tags)
  if (t.has('beach')) return 'Pack for the coast, and check whether your travel dates fall in or out of the local rainy season.'
  if (t.has('budget')) return 'Costs stay low on the ground here, so the flight is the main expense to optimize.'
  if (t.has('city')) return 'A walkable core and good transit mean you can skip a rental car for most of the trip.'
  if (t.has('nature') || t.has('adventure')) return 'Book activities ahead in peak months, and leave buffer days for weather.'
  return 'Check visa and entry requirements for your passport before you commit the miles.'
}

// Find the sweet-spot program most relevant to this destination, for the mesh.
// We match the destination's free-text bestProgram against the structured
// program names — a deterministic substring match, no guessing. Returns the
// program + the single most relevant spot (region-matched if possible).
function relatedSweetSpot(dest: Destination): { program: Program; spotRoute: string } | null {
  const programs = sweetSpotsByProgram()
  const best = dest.bestProgram.toLowerCase()
  const match = programs.find((p) => {
    const name = p.name.toLowerCase()
    // bestProgram strings like "Virgin Atlantic (ANA metal)" or "ANA via Amex MR";
    // match on the program name, or on a metal that appears in a spot.
    if (best.includes(name) || name.includes(best.split(' ')[0])) return true
    return p.spots.some((s) => s.metal && best.includes(s.metal.toLowerCase().split(' ')[0]))
  })
  if (!match) return null
  // Prefer a spot whose route mentions the destination's region.
  const region = dest.region.toLowerCase()
  const spot =
    match.spots.find((s) => s.route.toLowerCase().includes(region.split(' ')[0])) ?? match.spots[0]
  return { program: match, spotRoute: spot.route }
}

export default async function DestinationGuidePage({
  params,
}: {
  params: Promise<{ city: string }>
}) {
  const { city } = await params
  const dest = resolve(city)
  if (!dest) notFound()

  const value = computeCpp(dest)
  const t = tier(value)
  const related = relatedSweetSpot(dest)

  // Real climate normals (committed ERA5 seed data) → an honest, computed
  // "when to go". Null falls back to the generic region note below.
  const normals = CLIMATE_NORMALS[dest.code]
  const seasonality = normals ? computeSeasonality(normals) : null

  // Hero photo (cached, day-long revalidate); null → solid brand-deep banner.
  const photo = await destinationImage(imageQuery(dest))

  // Seed a search CTA ~3 weeks out, a week-long trip — same convention as deals.
  const depart = isoOffset(21)
  const ret = isoOffset(28)
  const searchHref = `/search?to=${dest.code}&depart=${depart}&ret=${ret}&adults=1`

  // Place + FAQPage JSON-LD, computed from the destination data. No user input
  // (city already resolved to a known destination), so JSON.stringify is safe.
  const url = absoluteUrl(`/destinations/${dest.code.toLowerCase()}`)
  const faqText =
    value !== undefined
      ? `A typical one-way award runs about ${dest.typicalAwardMiles.toLocaleString('en-US')} miles versus roughly $${Math.round(dest.typicalCashUSD).toLocaleString('en-US')} cash — about ${formatValue(value)}. ${dest.bestProgram} books it well.`
      : `A typical one-way fare runs roughly $${Math.round(dest.typicalCashUSD).toLocaleString('en-US')} cash. ${dest.bestProgram} books it well with miles.`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Place',
        '@id': `${url}#place`,
        name: `${dest.city}, ${dest.country}`,
        description: dest.vibe,
        address: { '@type': 'PostalAddress', addressCountry: dest.countryCode.toUpperCase() },
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: [
          {
            '@type': 'Question',
            name: `How many points to fly to ${dest.city}?`,
            acceptedAnswer: { '@type': 'Answer', text: faqText },
          },
          {
            '@type': 'Question',
            name: `When's the best time to visit ${dest.city}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                seasonality?.summary ??
                SEASON_BY_REGION[dest.region] ??
                'Aim for shoulder season for the best mix of weather, crowds, and award availability.',
            },
          },
        ],
      },
    ],
  }

  const season = SEASON_BY_REGION[dest.region] ?? 'Shoulder season usually wins — milder weather, fewer crowds, and looser award space than peak.'

  return (
    <AppShell user={null} hideSearch>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="mx-auto max-w-[var(--container-article)]">
        {/* breadcrumb */}
        <nav aria-label="Breadcrumb" className="pt-8 text-[13px] text-text3">
          <Link href="/destinations" className="font-semibold text-brand hover:text-brand-deep">
            Destinations
          </Link>
          <span aria-hidden className="px-1.5">
            /
          </span>
          <span className="text-text2">{dest.city}</span>
        </nav>

        {/* hero */}
        <header className="mt-5">
          <div
            className="relative aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-lg)] border border-border"
            style={{
              backgroundColor: photo?.color ?? 'var(--color-brand-deep)',
              backgroundImage: photo?.blur ? `url("${photo.blur}")` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.url} alt={photo.alt} className="h-full w-full object-cover" width={1200} height={675} />
            ) : (
              <div aria-hidden className="h-full w-full" style={{ background: 'var(--color-brand-deep)' }} />
            )}
            {photo && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to top, rgba(7,62,62,0.82) 0%, rgba(7,62,62,0.30) 42%, rgba(7,62,62,0) 70%)',
                }}
              />
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-6">
              <span className={`fi fi-${dest.countryCode} mb-2 h-[18px] w-[24px] flex-shrink-0 rounded-[2px]`} aria-hidden />
              <div className="min-w-0">
                <h1 className="font-display text-[34px] font-semibold leading-[1.04] tracking-[-0.02em] text-white sm:text-[44px]">
                  {dest.city}
                </h1>
                <p className="mt-0.5 text-[13px] font-semibold uppercase tracking-[var(--track-label)] text-white/85">
                  {dest.country} · {dest.region}
                </p>
              </div>
            </div>
          </div>
          <p className="mt-5 text-balance font-display text-[20px] font-medium leading-snug text-text2 sm:text-[22px]">
            {dest.vibe.charAt(0).toUpperCase() + dest.vibe.slice(1)}.
          </p>
        </header>

        {/* GETTING THERE — the computed economics. Every figure from lib/*. */}
        <section className="mt-9 rounded-[var(--radius-lg)] border border-border bg-paper p-6">
          <h2 className="text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand">Getting there</h2>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[var(--track-label)] text-text3">Typical award</div>
              <div className="mt-1 font-display text-[22px] font-semibold leading-none tabular-nums text-text">
                {(dest.typicalAwardMiles / 1000) % 1 === 0
                  ? `${dest.typicalAwardMiles / 1000}K`
                  : `${(dest.typicalAwardMiles / 1000).toFixed(1)}K`}
              </div>
              <div className="mt-1 text-[12px] text-text3">miles one-way</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[var(--track-label)] text-text3">vs. cash</div>
              <div className="mt-1 font-display text-[22px] font-semibold leading-none tabular-nums text-text">
                ${Math.round(dest.typicalCashUSD).toLocaleString('en-US')}
              </div>
              <div className="mt-1 text-[12px] text-text3">one-way</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[var(--track-label)] text-text3">Value</div>
              <div
                className="mt-1 font-display text-[22px] font-semibold leading-none tabular-nums"
                style={{
                  color:
                    t === 'green'
                      ? 'var(--color-good)'
                      : t === 'amber'
                        ? 'var(--color-ok)'
                        : 'var(--color-text3)',
                }}
              >
                {value !== undefined ? value.toFixed(1) : '—'}
              </div>
              <div className="mt-1 text-[12px] text-text3">¢/pt</div>
            </div>
          </div>
          <p className="mt-4 border-t border-hair pt-4 text-[14.5px] leading-relaxed text-text2">
            <span className="font-semibold text-text">Best via {dest.bestProgram}.</span> Figures are typical one-way
            seed references — run a live search for your dates to see what’s actually open.
          </p>
        </section>

        {/* WHEN TO GO — computed from real climate normals; falls back to a
            generic region note if a destination has no normals on file. */}
        <section className="mt-8">
          <h2 className="text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand">When to go</h2>
          {seasonality && normals ? (
            <>
              <p className="mt-3 text-[15.5px] leading-relaxed text-text2">{seasonality.summary}</p>
              <ClimateStrip normals={normals} seasonality={seasonality} />
            </>
          ) : (
            <p className="mt-3 text-[15.5px] leading-relaxed text-text2">{season}</p>
          )}
        </section>

        {/* ESSENTIALS — real currency/language/time facts + a computed FX line */}
        <Essentials code={dest.code} />

        {/* POINTS PLAY — the structured sweet-spot link (mesh) */}
        {related && (
          <section className="mt-8">
            <h2 className="text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand">Points play</h2>
            <p className="mt-3 text-[15.5px] leading-relaxed text-text2">
              {dest.bestProgram} is the way in. If you hold {related.program.name} miles, see its{' '}
              <Link
                href={`/sweet-spots/${related.program.slug}`}
                className="font-semibold text-brand underline decoration-border underline-offset-2 hover:text-brand-deep"
              >
                full sweet-spot list
              </Link>{' '}
              — {related.spotRoute} is one of them.
            </p>
          </section>
        )}

        {/* GOOD TO KNOW */}
        <section className="mt-8">
          <h2 className="text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand">Good to know</h2>
          <p className="mt-3 text-[15.5px] leading-relaxed text-text2">{goodToKnow(dest)}</p>
        </section>

        {/* CTA — into the live tool */}
        <div className="mt-9 flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[15px] leading-snug text-text2">
            <span className="font-semibold text-text">Ready to price it?</span> See points vs cash for your dates.
          </p>
          <Link
            href={searchHref}
            className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius)] bg-brand px-5 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-brand-deep"
          >
            Search to {dest.code}
            <span aria-hidden>→</span>
          </Link>
        </div>

        {/* mesh footer links */}
        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
          <span className="text-text3">More:</span>
          <Link href="/destinations" className="font-semibold text-brand hover:text-brand-deep">
            All destinations
          </Link>
          <Link href="/sweet-spots" className="font-semibold text-brand hover:text-brand-deep">
            Sweet spots by program
          </Link>
          <Link href="/deals" className="font-semibold text-brand hover:text-brand-deep">
            Today’s deals
          </Link>
        </div>
      </article>

      <div className="mx-auto max-w-[var(--container-shell)]">
        <SiteFooter />
      </div>
    </AppShell>
  )
}
