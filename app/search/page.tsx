import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { toNavUser } from '@/lib/nav-user'
import type { SearchParams } from '@/lib/types'
import { assembleSearch, seatsFor } from '@/lib/search'
import type { TravelPrefs } from '@/lib/prefs-model'
import { getUserBalances } from '@/lib/accounts'
import { getPrefs } from '@/lib/prefs'
import { cityForCode } from '@/lib/airports'
import { destinationImage, photoForCode } from '@/lib/images'
import { affordableWith, topValue } from '@/lib/destinations'
import { auth0 } from '@/lib/auth0'
import { ORIGIN_STORAGE_KEY } from '@/lib/origin-constants'
import { isShareReceiptsEnabled, isStandingOrdersCronLive } from '@/lib/env'
import { clampTravelDates, DEFAULT_DEPART } from '@/lib/travel-dates'
import { isoOffset } from '@/lib/dates'
import { SITE_URL } from '@/lib/seo'
import AppShell from '@/components/AppShell'
import RouteBar from '@/components/RouteBar'
import VerdictRail from '@/components/VerdictRail'
import ResultsList from '@/components/ResultsList'
import SearchTelemetry from '@/components/SearchTelemetry'
import PointsPanel from '@/components/PointsPanel'
import SiteFooter from '@/components/SiteFooter'
import HeroSearch from '@/components/landing/HeroSearch'
import DestinationSuggestions from '@/components/DestinationSuggestions'
import SearchAskChips from '@/components/SearchAskChips'

const DEFAULT_PARAMS: SearchParams = {
  from: 'SFO',
  to: 'LAX',
  depart: DEFAULT_DEPART,
  adults: 1,
}

const CABINS = ['economy', 'premium', 'business', 'first'] as const
// Validate the cabin query param against our enum. Unknown/absent → undefined
// (the engine defaults to economy, the legacy behavior).
function parseCabin(raw: string | undefined): SearchParams['cabin'] {
  const c = (raw ?? '').trim().toLowerCase()
  return (CABINS as readonly string[]).includes(c) ? (c as SearchParams['cabin']) : undefined
}

// Parse a non-negative passenger count, clamped to [0, max]. Bad input → 0.
function parseCount(raw: string | undefined, max: number): number {
  const n = parseInt(raw ?? '', 10)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(max, n)
}

// Parse the raw query into a clean SearchParams, defaulting any missing field
// and defensively clamping bad input so a nonsensical URL never crashes or runs
// a broken search. searchParams is a Promise in Next 16 — awaited by the caller.
// `originFallback` (the persistent "where from" cookie) seeds the origin when the
// query omits one, so a bare /search opens on where the user actually departs.
function parseParams(
  q: Record<string, string | string[] | undefined>,
  originFallback?: string,
): SearchParams {
  const str = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v

  const fallbackOrigin =
    originFallback && /^[A-Z]{3}$/.test(originFallback) ? originFallback : undefined
  const from = str(q.from)?.toUpperCase() || fallbackOrigin || DEFAULT_PARAMS.from
  let to = str(q.to)?.toUpperCase() || DEFAULT_PARAMS.to
  // Origin and destination must differ — fall back to a sane default destination.
  if (to === from) to = from === DEFAULT_PARAMS.to ? DEFAULT_PARAMS.from : DEFAULT_PARAMS.to

  // Clamp missing/malformed/past dates up to today; one-way when `return` is
  // absent, and a malformed or pre-departure return is dropped.
  const { depart, return: ret } = clampTravelDates(str(q.depart), str(q.return))

  const adultsRaw = parseInt(str(q.adults) ?? '', 10)
  const adults = Number.isFinite(adultsRaw)
    ? Math.min(9, Math.max(1, adultsRaw))
    : DEFAULT_PARAMS.adults

  const children = parseCount(str(q.children), 8)
  const infants = parseCount(str(q.infants), 8)
  const cabin = parseCabin(str(q.cabin))

  return {
    from,
    to,
    depart,
    return: ret,
    adults,
    // Omit when zero/absent so the URL stays backward-compatible (adults-only).
    ...(children > 0 ? { children } : {}),
    ...(infants > 0 ? { infants } : {}),
    cabin,
  }
}

// True when the URL explicitly asks to exclude connecting itineraries — a
// per-search override that takes priority over any saved account travel
// prefs (below), since it's the user's explicit, in-the-moment choice.
function parseNonstop(q: Record<string, string | string[] | undefined>): boolean {
  const v = Array.isArray(q.nonstop) ? q.nonstop[0] : q.nonstop
  return v === '1' || v === 'true'
}

// Title-case cabin label for the trip-context summary, e.g. "premium" → "Premium".
const CABIN_LABEL: Record<NonNullable<SearchParams['cabin']>, string> = {
  economy: 'Economy',
  premium: 'Premium',
  business: 'Business',
  first: 'First',
}

// Compact passenger + cabin summary for the header trip context, e.g.
// "2 adults · 1 child · Business". Adults-only economy stays "1 adult".
function whoSummary(p: SearchParams): string {
  const parts: string[] = []
  parts.push(p.adults === 1 ? '1 adult' : `${p.adults} adults`)
  if (p.children) parts.push(p.children === 1 ? '1 child' : `${p.children} children`)
  if (p.infants) parts.push(p.infants === 1 ? '1 infant' : `${p.infants} infants`)
  if (p.cabin && p.cabin !== 'economy') parts.push(CABIN_LABEL[p.cabin])
  return parts.join(' · ')
}

// "2026-07-09" → "Jul 9". Parses as UTC so the day never shifts by timezone.
function fmtDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

// "Jul 9 – 12" when same month, else "Jul 9 – Aug 10".
function fmtRange(depart: string, ret?: string): string {
  if (!ret) return fmtDay(depart)
  const [, dm] = depart.split('-').map(Number)
  const [, rm] = ret.split('-').map(Number)
  const rd = Number(ret.split('-')[2])
  if (dm === rm) return `${fmtDay(depart)} – ${rd}`
  return `${fmtDay(depart)} – ${fmtDay(ret)}`
}

// True when the URL names an actual destination. A bare /search (no `to` at
// all — e.g. the header's "Search" nav link, or someone typing the path by
// hand) used to silently run the DEFAULT_PARAMS SFO→LAX verdict as if it were
// a real result. Gated on `to` specifically (not `from`, which reasonably
// defaults from the saved home airport/cookie) — naming a destination is the
// clear signal that this is a real, intentional search.
function hasDestination(q: Record<string, string | string[] | undefined>): boolean {
  const raw = Array.isArray(q.to) ? q.to[0] : q.to
  return !!raw?.trim()
}

// Per-route metadata. Title is "${from} → ${to}" — the root layout's template
// ('%s · hop') appends the suffix, so we do NOT add '· hop' here. The canonical
// points at the CLEAN /search path rebuilt from the parsed params (not the raw,
// possibly-messy query string), so every variant of the same trip dedupes to one
// URL. The description is verdict-flavored without running the engine.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const sp = await searchParams
  if (!hasDestination(sp)) {
    return {
      title: 'Search flights',
      description:
        'Pick a route and hop reads live award space and cash fares side by side, priced in cents per point.',
      alternates: { canonical: '/search' },
    }
  }
  const p = parseParams(sp)
  const nonstop = parseNonstop(sp)
  const fromCity = cityForCode(p.from)
  const toCity = cityForCode(p.to)
  const dates = fmtRange(p.depart, p.return)

  const title = `${p.from} → ${p.to}`
  const description = `Points or cash for ${fromCity} (${p.from}) → ${toCity} (${p.to}), ${dates} — hop reads live award space and cash fares and gives you the verdict, with the value per point.`

  // Clean canonical query: stable key order, only the fields that define the
  // trip, return omitted for one-way.
  const qs = new URLSearchParams({
    from: p.from,
    to: p.to,
    depart: p.depart,
    adults: String(p.adults),
  })
  if (p.return) qs.set('return', p.return)
  // Only append non-default passenger/cabin params so the legacy adults-only,
  // economy trip keeps its original canonical URL (no churn for existing links).
  if (p.children) qs.set('children', String(p.children))
  if (p.infants) qs.set('infants', String(p.infants))
  if (p.cabin && p.cabin !== 'economy') qs.set('cabin', p.cabin)
  if (nonstop) qs.set('nonstop', '1')
  const canonical = `/search?${qs.toString()}`

  const cardTitle = `${title} · hop`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      siteName: 'hop',
      url: `${SITE_URL}${canonical}`,
      title: cardTitle,
      description,
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: cardTitle,
      description,
    },
  }
}

export default async function Search({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Auth0 session → header avatar (null when signed out).
  const session = await auth0.getSession()
  const su = session?.user
  const user = toNavUser(su)

  // Fast, non-suspending inputs — searchParams/cookies never touch the
  // network — read BEFORE the slow balances/award-space work below, so the
  // no-destination branch can decide and render immediately instead of
  // sitting behind it. (It used to await the same Promise.all as the results
  // branch, so app/search/loading.tsx's results-shaped skeleton — built for
  // the destination branch — stayed on screen for however long that upstream
  // call took, then snapped to this structurally different prompt page.)
  const sp = await searchParams
  const cookieStore = await cookies()
  const cookieOrigin = cookieStore.get(ORIGIN_STORAGE_KEY)?.value?.trim().toUpperCase()

  // No destination named — e.g. the header's "Search" nav link — used to
  // silently run the DEFAULT_PARAMS SFO→LAX verdict and present it as if it
  // were a real result. Land on a plain search-initiation state instead: the
  // engine (assembleSearch, cash + award-space lookups) never runs here — only
  // a route the visitor actually asked for triggers it. Prefs + balances ARE
  // read (in parallel, below) to ground the "worth a look" row in this
  // visitor's own points: getUserBalances is a cached DB read now (the
  // AwardWallet cache added alongside #217), not the live per-page call this
  // fast path used to avoid, so it stays cheap. pointsTotal is still omitted
  // from AppShell (TopNav renders fine without it) — that prop is for the
  // header chip, not needed here.
  if (!hasDestination(sp)) {
    const [prefs, userBalances] = await Promise.all([
      su?.sub ? getPrefs(su.sub) : Promise.resolve(undefined),
      su?.sub ? getUserBalances(su.sub) : Promise.resolve(undefined),
    ])
    const originSeed = prefs?.homeAirport ?? cookieOrigin
    // The suggestion cards always need a concrete origin to link from; when
    // the visitor has no saved airport yet, fall back to the same default the
    // engine itself uses (DEFAULT_PARAMS.from) rather than leaving the cards
    // linkless. hasKnownOrigin tracks whether that origin is real vs. guessed,
    // independently of isPersonalized (points-based) below — the heading's
    // "from <code>" suffix is gated on THIS, so a guessed fallback airport
    // never gets attributed to the visitor as their own.
    const hasKnownOrigin = !!originSeed
    const cardOrigin = originSeed ?? DEFAULT_PARAMS.from
    const totalPoints =
      userBalances && userBalances.length > 0
        ? userBalances.reduce((s, b) => s + b.balance, 0)
        : undefined
    // Only claim "computed from your points" when there are enough real
    // affordable destinations to fill the row — a lone card next to three
    // sample ones would misrepresent which figures are real.
    const affordable = totalPoints ? affordableWith(totalPoints) : []
    const isPersonalized = affordable.length >= 3
    const suggestions = (isPersonalized ? affordable : topValue(4)).slice(0, 4)
    // Sensible near-future dates for the suggestion links — same convention
    // as /deals (3 weeks out, home a week later).
    const suggestDepart = isoOffset(21)
    const suggestReturn = isoOffset(28)
    return (
      <AppShell user={user} homeAirport={originSeed} hideSearch>
        <div className="mx-auto max-w-[var(--container-shell)] px-2 pb-16 pt-16">
          <div className="flex min-h-[46vh] flex-col items-center justify-center text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand sm:text-[12px]">
              Points or cash
            </span>
            <h1 className="mt-4 text-balance font-display text-[32px] font-semibold leading-[1.05] tracking-[-0.02em] text-text sm:text-[42px]">
              Where are you flying?
            </h1>
            <p className="mt-3 max-w-[46ch] text-[15px] leading-[1.6] text-text2 sm:text-[16px]">
              Pick a route and hop reads your balances, checks award space, prices the cash fare,
              and tells you the smarter way to book it.
            </p>
            <div className="mt-9 w-full">
              <HeroSearch
                initial={{
                  from: originSeed ?? '',
                  to: '',
                  depart: isoOffset(10),
                  ret: isoOffset(13),
                  adults: 1,
                  children: 0,
                  infants: 0,
                  cabin: 'economy',
                  oneWay: false,
                  nonstop: false,
                }}
              />
            </div>
            <SearchAskChips />
          </div>

          <DestinationSuggestions
            destinations={suggestions}
            fromCode={cardOrigin}
            hasKnownOrigin={hasKnownOrigin}
            depart={suggestDepart}
            ret={suggestReturn}
            isPersonalized={isPersonalized}
            totalPoints={isPersonalized ? totalPoints : undefined}
            isSignedIn={!!user}
          />
        </div>
        <SiteFooter />
      </AppShell>
    )
  }

  // Signed in → ground the search in this user's real balances (manual +
  // AwardWallet, merged); pass them in so no other user's data can leak. Signed
  // out → undefined keeps the env-global/mock fallback inside assembleSearch.
  // Stored travel prefs (nonstop/cabin/…) are remembered like the home airport
  // and re-rank the verdict. Signed out → no prefs → today's cpp-only ranking.
  const [userBalances, prefs] = await Promise.all([
    su?.sub ? getUserBalances(su.sub) : Promise.resolve(undefined),
    su?.sub ? getPrefs(su.sub) : Promise.resolve(undefined),
  ])

  // Origin precedence: explicit ?from= (inside parseParams) → saved home
  // airport → "where from" cookie. ONE shared value feeds both the executed
  // query (parseParams) and the origin pill (AppShell's homeAirport prop) so
  // the pill never shows a different airport than the search actually ran.
  const originSeed = prefs?.homeAirport ?? cookieOrigin

  const params = parseParams(sp, originSeed)
  const nonstop = parseNonstop(sp)
  // An explicit ?nonstop=1 on THIS search always wins over any saved account
  // preference — it's a deliberate, in-the-moment choice, not a stored default.
  const effectivePrefs: TravelPrefs | undefined = nonstop
    ? { ...prefs?.travelPrefs, maxStops: 0, preferNonstop: true }
    : prefs?.travelPrefs
  // Destination photo for the verdict hero — the place you're heading, behind
  // the boarding pass (replaces the redundant bunny). Cached; null → bunny.
  // Curated destinations resolve by the manifest's OWN code (params.to) first —
  // the same identity the home showcase renders from (lib/destinations#code,
  // ShowcaseEntry.code) — so the two surfaces provably render the same file,
  // the precondition for the shared-element photo morph (destPhotoCode below).
  // Only the long-tail (uncurated) destinations fall back to the free-text
  // Unsplash query, keyed off the city name, never the airport code (which
  // surfaces terminals, not beauty) — skipped entirely when cityForCode falls
  // back to the raw IATA code (unmapped airport).
  // Independent of the verdict engine — fetched alongside it, not after, so the
  // photo round-trip never adds to the page's critical path.
  const manifestPhoto = photoForCode(params.to)
  const destCity = cityForCode(params.to)
  const [result, destPhoto] = await Promise.all([
    assembleSearch(params, userBalances, effectivePrefs),
    manifestPhoto
      ? Promise.resolve(manifestPhoto)
      : destCity && destCity !== params.to
        ? destinationImage(`${destCity} skyline travel landmark`)
        : Promise.resolve(null),
  ])
  // Only assign the shared view-transition identity when the photo actually
  // came from the curated manifest by exact code — an Unsplash long-tail photo
  // has no showcase counterpart to morph from/to, so naming it would just be
  // an unmatched transition (harmless, but pointless).
  const destPhotoCode = manifestPhoto ? params.to : undefined

  // The verdict's ownership voice ("You have the miles") is only honest when
  // these balances are this signed-in user's own connected programs. Signed out
  // (or signed in with nothing connected) → value-demonstration framing instead.
  const hasRealBalances = !!userBalances && userBalances.length > 0

  const who = whoSummary(params)

  return (
    <AppShell
      from={cityForCode(params.from)}
      to={cityForCode(params.to)}
      dates={fmtRange(params.depart, params.return)}
      who={who}
      fromCode={params.from}
      toCode={params.to}
      depart={params.depart}
      ret={params.return ?? ''}
      adults={params.adults}
      childrenCount={params.children}
      infants={params.infants}
      cabin={params.cabin}
      nonstop={nonstop}
      user={user}
      pointsTotal={user ? result.balances.reduce((s, b) => s + b.balance, 0) : undefined}
      homeAirport={params.from}
    >
      {/* The results column rides the full-width shell — fluid under the shared
          gutters, centered once it hits --container-shell — so the verdict hero,
          the alternatives, and the wallet use the viewport like the nav does. */}
      <div className="mx-auto max-w-[var(--container-shell)]">
        {/* plain trip context — route + facts, not fake masthead metadata */}
        <RouteBar result={result} hasRealBalances={hasRealBalances} nonstop={nonstop} />

        {/* R0.5 funnel — search_ran (+ verdict_viewed when a hero rendered). */}
        <SearchTelemetry
          from={params.from}
          to={params.to}
          cabin={params.cabin}
          travelers={seatsFor(params)}
          verdict={result.pick ? result.verdict : undefined}
        />

        {/* the verdict hero — only when there's an actual pick to render a
            verdict about. verdict === 'none' means cash AND awards both came
            back empty (or both degraded, see DegradedNote): there's nothing to
            recommend, so EmptyState (below, via ResultsList) owns the page
            instead of a confident-sounding "Pay cash" card built on dashes. */}
        {result.pick ? (
          <VerdictRail
            result={result}
            destPhoto={destPhoto}
            destPhotoCode={destPhotoCode}
            hasRealBalances={hasRealBalances}
            isSignedIn={!!user}
            nonstop={nonstop}
            watchLive={isStandingOrdersCronLive()}
            shareEnabled={isShareReceiptsEnabled() && result.degraded.length === 0}
          />
        ) : null}

        {/* other ways to fly — travelers is the engine's own seatsFor (the
            multiplier already applied to every figure), so the party-basis
            note can never disagree with the numbers it describes. */}
        <ResultsList result={result} travelers={seatsFor(params)} />

        {/* your points — the wallet stands alone; no restating heading */}
        <div className="mt-14">
          <PointsPanel balances={result.balances} pick={result.pick} isExample={!hasRealBalances} />
        </div>

        <SiteFooter />
      </div>
    </AppShell>
  )
}
