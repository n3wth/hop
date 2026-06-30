import type { Metadata } from 'next'
import type { SearchParams } from '@/lib/types'
import { assembleSearch } from '@/lib/search'
import { getUserBalances } from '@/lib/accounts'
import { getPrefs } from '@/lib/prefs'
import { cityForCode } from '@/lib/airports'
import { destinationImage } from '@/lib/images'
import { auth0 } from '@/lib/auth0'
import { SITE_URL } from '@/lib/seo'
import AppShell from '@/components/AppShell'
import RouteBar from '@/components/RouteBar'
import VerdictRail from '@/components/VerdictRail'
import ResultsList from '@/components/ResultsList'
import PointsPanel from '@/components/PointsPanel'
import SiteFooter from '@/components/SiteFooter'

const DEFAULT_PARAMS: SearchParams = {
  from: 'SFO',
  to: 'LAX',
  depart: '2026-07-09',
  return: '2026-07-12',
  adults: 1,
}

// Local-midnight ISO for today — the floor for any valid depart/return date.
function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// True for a well-formed "YYYY-MM-DD" string.
function isValidISO(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
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
function parseParams(q: Record<string, string | string[] | undefined>): SearchParams {
  const str = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v

  const from = str(q.from)?.toUpperCase() || DEFAULT_PARAMS.from
  let to = str(q.to)?.toUpperCase() || DEFAULT_PARAMS.to
  // Origin and destination must differ — fall back to a sane default destination.
  if (to === from) to = from === DEFAULT_PARAMS.to ? DEFAULT_PARAMS.from : DEFAULT_PARAMS.to

  const floor = todayISO()
  const departRaw = str(q.depart)
  // Clamp a missing/malformed/past depart up to today (or the default).
  let depart = isValidISO(departRaw) ? departRaw : DEFAULT_PARAMS.depart
  if (depart < floor) depart = floor > DEFAULT_PARAMS.depart ? floor : DEFAULT_PARAMS.depart

  // One-way when `return` is absent. Drop a malformed or pre-departure return.
  const retRaw = str(q.return)
  const ret =
    retRaw === undefined
      ? undefined
      : isValidISO(retRaw) && retRaw >= depart
        ? retRaw
        : undefined

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
  const p = parseParams(await searchParams)
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
  const params = parseParams(await searchParams)

  // Auth0 session → header avatar (null when signed out).
  const session = await auth0.getSession()
  const su = session?.user
  const user = su
    ? {
        initial: (su.name ?? su.email ?? 'U').trim().charAt(0).toUpperCase(),
        name: su.name ?? su.email ?? undefined,
        email: su.email ?? undefined,
        picture: su.picture ?? undefined,
      }
    : null

  // Signed in → ground the search in this user's real balances (manual +
  // AwardWallet, merged); pass them in so no other user's data can leak. Signed
  // out → undefined keeps the env-global/mock fallback inside assembleSearch.
  // Stored travel prefs (nonstop/cabin/…) are remembered like the home airport
  // and re-rank the verdict. Signed out → no prefs → today's cpp-only ranking.
  const [userBalances, prefs] = await Promise.all([
    su?.sub ? getUserBalances(su.sub) : Promise.resolve(undefined),
    su?.sub ? getPrefs(su.sub) : Promise.resolve(undefined),
  ])
  const result = await assembleSearch(params, userBalances, prefs?.travelPrefs)

  // The verdict's ownership voice ("You have the miles") is only honest when
  // these balances are this signed-in user's own connected programs. Signed out
  // (or signed in with nothing connected) → value-demonstration framing instead.
  const hasRealBalances = !!userBalances && userBalances.length > 0

  // Destination photo for the verdict hero — the place you're heading, behind
  // the boarding pass (replaces the redundant bunny). Query the CITY skyline/
  // landscape, never the airport code (which surfaces terminals, not beauty).
  // Cached; null → bunny.
  // Only query when we have a real city name — if cityForCode falls back to the
  // raw IATA code (unmapped airport), skip the photo so we never search "JFK"
  // and get a terminal. Bunny fallback covers it.
  const destCity = cityForCode(params.to)
  const destPhoto =
    destCity && destCity !== params.to
      ? await destinationImage(`${destCity} skyline travel landmark`)
      : null

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
      user={user}
      pointsTotal={user ? result.balances.reduce((s, b) => s + b.balance, 0) : undefined}
    >
      {/* The results column is generous on wide screens (the verdict hero, the
          4-up alternatives, and the wallet all earn the width) but capped so it
          reads as a premium spread, not edge-to-edge sprawl at 1920+. */}
      <div className="mx-auto max-w-[1440px] 2xl:max-w-[1560px]">
        {/* plain trip context — route + facts, not fake masthead metadata */}
        <RouteBar result={result} hasRealBalances={hasRealBalances} />

        {/* the verdict hero */}
        <VerdictRail result={result} destPhoto={destPhoto} hasRealBalances={hasRealBalances} />

        {/* other ways to fly */}
        <ResultsList result={result} />

        {/* your points — the wallet stands alone; no restating heading */}
        <div className="mt-14">
          <PointsPanel balances={result.balances} pick={result.pick} />
        </div>

        <SiteFooter />
      </div>
    </AppShell>
  )
}
