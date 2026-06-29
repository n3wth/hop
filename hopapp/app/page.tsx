import type { SearchParams } from '@/lib/types'
import { assembleSearch } from '@/lib/search'
import { cityForCode } from '@/lib/airports'
import AppShell from '@/components/AppShell'
import RouteBar from '@/components/RouteBar'
import VerdictRail from '@/components/VerdictRail'
import ResultsList from '@/components/ResultsList'
import PointsPanel from '@/components/PointsPanel'

const DEFAULT_PARAMS: SearchParams = {
  from: 'SFO',
  to: 'LAX',
  depart: '2026-07-09',
  return: '2026-07-12',
  adults: 1,
}

// Parse the raw query into a clean SearchParams, defaulting any missing field.
// searchParams is a Promise in Next 16 — the caller awaits before passing in.
function parseParams(q: Record<string, string | string[] | undefined>): SearchParams {
  const str = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v

  const from = str(q.from)?.toUpperCase() || DEFAULT_PARAMS.from
  const to = str(q.to)?.toUpperCase() || DEFAULT_PARAMS.to
  const depart = str(q.depart) || DEFAULT_PARAMS.depart
  const ret = str(q.return) || DEFAULT_PARAMS.return
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

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = parseParams(await searchParams)
  const result = await assembleSearch(params)

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

      <footer className="mt-[46px] flex flex-col gap-4 border-t border-border pt-6 text-[12px] tracking-[0.04em] text-text3 sm:flex-row sm:items-center sm:justify-between sm:border-t-0 sm:pt-0">
        <div>
          hop compares <b className="font-semibold text-text2">cash, miles, and transfer partners</b>{' '}
          in one search.
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 sm:gap-[22px]">
          <span>How we value points</span>
          <span>Refresh balances</span>
          <span>Price alert</span>
        </div>
      </footer>
    </AppShell>
  )
}
