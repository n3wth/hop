import type { SearchResult } from '@/lib/types'
import ResultRow from './ResultRow'
import SectionHead from './SectionHead'
import EmptyState from './EmptyState'
import DegradedNote from './DegradedNote'

export interface ResultsListProps {
  result: SearchResult
}

// "Other ways to fly" — the pick lives in the hero, so this ranks the remaining
// options as value-weighted cards (best deal reads first via the value bars).
// Surfaces a degraded note when a source failed, and a calm empty state when
// nothing came back at all.
export default function ResultsList({ result }: ResultsListProps) {
  const { pick, options, degraded } = result
  const others = options.filter((o) => o.id !== pick?.id)

  // Strongest cpp among the alternatives, to scale the value bars relatively.
  const maxCpp = others.reduce((m, o) => (o.cpp != null && o.cpp > m ? o.cpp : m), 0)

  // Empty when the whole search produced no bookable options.
  const isEmpty = options.length === 0

  return (
    <section>
      <SectionHead title="Other ways to fly" note={isEmpty ? undefined : 'Ranked by value'} />

      <DegradedNote degraded={degraded} />

      {isEmpty ? (
        <div className="mt-[18px]">
          <EmptyState route={`${result.params.from} → ${result.params.to}`} />
        </div>
      ) : others.length === 0 ? (
        // The pick is the only option — nothing left to rank, but not "empty".
        <p className="mt-[18px] text-[14px] leading-[1.55] text-text2">
          That&apos;s the only fare we found for this route — it&apos;s the one above.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {others.map((option, i) => (
            <ResultRow
              key={option.id}
              option={option}
              rank={i + 1}
              maxCpp={maxCpp || undefined}
              index={i}
            />
          ))}
        </div>
      )}
    </section>
  )
}
