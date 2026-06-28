import type { SearchParams } from '@/lib/types'
import { assembleSearch } from '@/lib/search'
import AppShell from '@/components/AppShell'
import Logo from '@/components/Logo'
import Rail from '@/components/Rail'
import SearchBar from '@/components/SearchBar'
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

export default async function Home() {
  const result = await assembleSearch(DEFAULT_PARAMS)

  const ways = result.options.length
  const adults = result.params.adults
  const subtitle = `${ways} ${ways === 1 ? 'way' : 'ways'} to fly · Jul 9–12 · ${adults} ${
    adults === 1 ? 'adult' : 'adults'
  }`

  return (
    <AppShell
      logoCell={<Logo size={40} />}
      topbar={<SearchBar />}
      rail={<Rail />}
    >
      <div className="mx-auto max-w-[1180px] px-7 py-7">
        <header className="mb-[22px]">
          <h1 className="text-[26px] font-bold tracking-[-0.02em]">
            San Francisco → Los Angeles
          </h1>
          <p className="mt-1 text-[13.5px] text-text2">{subtitle}</p>
        </header>

        <VerdictRail result={result} />

        <div className="flex items-start gap-6">
          <div className="min-w-0 flex-1">
            <ResultsList result={result} />
          </div>
          <aside className="w-[320px] flex-shrink-0">
            <PointsPanel balances={result.balances} />
          </aside>
        </div>
      </div>
    </AppShell>
  )
}
