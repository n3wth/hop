import type { SearchResult } from '@/lib/types'
import ResultRow from './ResultRow'
import SectionHead from './SectionHead'

export interface ResultsListProps {
  result: SearchResult
}

// "Other ways to fly" — the pick lives in the hero, so this ranks the remaining
// options as value-weighted cards (best deal reads first via the value bars).
export default function ResultsList({ result }: ResultsListProps) {
  const { pick, options } = result
  const others = options.filter((o) => o.id !== pick?.id)

  // Strongest cpp among the alternatives, to scale the value bars relatively.
  const maxCpp = others.reduce((m, o) => (o.cpp != null && o.cpp > m ? o.cpp : m), 0)

  return (
    <section>
      <SectionHead title="Other ways to fly" note="Ranked by value" />

      <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
        {others.map((option, i) => (
          <ResultRow
            key={option.id}
            option={option}
            rank={i + 1}
            maxCpp={maxCpp || undefined}
          />
        ))}
      </div>
    </section>
  )
}
