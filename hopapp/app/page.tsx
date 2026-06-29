import type { SearchParams } from '@/lib/types'
import { assembleSearch } from '@/lib/search'
import AppShell from '@/components/AppShell'
import RouteBar from '@/components/RouteBar'
import VerdictRail from '@/components/VerdictRail'
import ResultsList from '@/components/ResultsList'
import PointsPanel from '@/components/PointsPanel'
import SectionHead from '@/components/SectionHead'

const DEFAULT_PARAMS: SearchParams = {
  from: 'SFO',
  to: 'LAX',
  depart: '2026-07-09',
  return: '2026-07-12',
  adults: 1,
}

export default async function Home() {
  const result = await assembleSearch(DEFAULT_PARAMS)

  return (
    <AppShell
      from="San Francisco"
      to="Los Angeles"
      dates="Jul 9 – 12"
      who="1 adult"
      fromCode={result.params.from}
      toCode={result.params.to}
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
