import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { toNavUser } from '@/lib/nav-user'
import type { SearchParams } from '@/lib/types'
import { assembleSearch, seatsFor } from '@/lib/search'
import type { TravelPrefs } from '@/lib/prefs-model'
import { getUserBalances } from '@/lib/accounts'
import { getPrefs } from '@/lib/prefs'
import { cityForCode } from '@/lib/airports'
import { destinationImage } from '@/lib/images'
import { auth0 } from '@/lib/auth0'
import { ORIGIN_STORAGE_KEY } from '@/lib/origin-constants'
import { isStandingOrdersCronLive } from '@/lib/env'
import { clampTravelDates, DEFAULT_DEPART } from '@/lib/travel-dates'
import { SITE_URL } from '@/lib/seo'
import AppShell from '@/components/AppShell'
import RouteBar from '@/components/RouteBar'
import VerdictRail from '@/components/VerdictRail'
import ResultsList from '@/components/ResultsList'
import SearchTelemetry from '@/components/SearchTelemetry'
import PointsPanel from '@/components/PointsPanel'
import SiteFooter from '@/components/SiteFooter'

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
  const cookieStore = await cookies()
  const cookieOrigin = cookieStore.get(ORIGIN_STORAGE_KEY)?.value?.trim().toUpperCase()
  const originSeed = prefs?.homeAirport ?? cookieOrigin
  const sp = await searchParams
  const params = parseParams(sp, originSeed)
  const nonstop = parseNonstop(sp)
  // An explicit ?nonstop=1 on THIS search always wins over any saved account
  // preference — it's a deliberate, in-the-moment choice, not a stored default.
  const effectivePrefs: TravelPrefs | undefined = nonstop
    ? { ...prefs?.travelPrefs, maxStops: 0, preferNonstop: true }
    : prefs?.travelPrefs
  // Destination photo for the verdict hero — the place you're heading, behind
  // the boarding pass (replaces the redundant bunny). Query the CITY skyline/
  // landscape, never the airport code (which surfaces terminals, not beauty).
  // Cached; null → bunny.
  // Only query when we have a real city name — if cityForCode falls back to the
  // raw IATA code (unmapped airport), skip the photo so we never search "JFK"
  // and get a terminal. Bunny fallback covers it.
  // Independent of the verdict engine — fetched alongside it, not after, so the
  // photo round-trip never adds to the page's critical path.
  const destCity = cityForCode(params.to)
  const [result, destPhoto] = await Promise.all([
    assembleSearch(params, userBalances, effectivePrefs),
    destCity && destCity !== params.to
      ? destinationImage(`${destCity} skyline travel landmark`)
      : Promise.resolve(null),
  ])

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
            hasRealBalances={hasRealBalances}
            isSignedIn={!!user}
            nonstop={nonstop}
            watchLive={isStandingOrdersCronLive()}
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
