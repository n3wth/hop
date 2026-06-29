import type { SearchParams } from '@/lib/types'
import { assembleSearch } from '@/lib/search'
import { getUserBalances } from '@/lib/accounts'
import { cityForCode } from '@/lib/airports'
import { auth0 } from '@/lib/auth0'
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

  return { from, to, depart, return: ret, adults }
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
  const userBalances = su?.sub ? await getUserBalances(su.sub) : undefined
  const result = await assembleSearch(params, userBalances)

  const who =
    params.adults === 1 ? '1 adult' : `${params.adults} adults`

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
      user={user}
      pointsTotal={user ? result.balances.reduce((s, b) => s + b.balance, 0) : undefined}
    >
      {/* plain trip context — route + facts, not fake masthead metadata */}
      <RouteBar result={result} />

      {/* the verdict hero */}
      <VerdictRail result={result} />

      {/* other ways to fly */}
      <ResultsList result={result} />

      {/* your points — the wallet stands alone; no restating heading */}
      <div className="mt-14">
        <PointsPanel balances={result.balances} pick={result.pick} />
      </div>

      <SiteFooter />
    </AppShell>
  )
}
