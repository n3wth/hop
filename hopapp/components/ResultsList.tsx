'use client'

import { useState } from 'react'
import type { SearchResult } from '@/lib/types'
import ResultRow from './ResultRow'
import SectionHead from './SectionHead'
import EmptyState from './EmptyState'
import DegradedNote from './DegradedNote'
import Icon from './Icon'

export interface ResultsListProps {
  result: SearchResult
}

// "Other ways to fly" — the pick lives in the hero, so this ranks the remaining
// options as value-weighted cards (best deal reads first via the value bars).
// All cards share ONE expand state (collapsed on load) so they open/close in
// sync and stay aligned. Surfaces degraded + empty states.
export default function ResultsList({ result }: ResultsListProps) {
  const { pick, options, degraded } = result
  const oneWay = !result.params.return
  const others = options.filter((o) => o.id !== pick?.id)
  const [expanded, setExpanded] = useState(false)

  // Strongest cpp among the alternatives, to scale the value bars relatively.
  const maxCpp = others.reduce((m, o) => (o.cpp != null && o.cpp > m ? o.cpp : m), 0)

  const isEmpty = options.length === 0
  const hasCards = !isEmpty && others.length > 0

  return (
    <section>
      <div className="flex items-end justify-between">
        <SectionHead title="Other ways to fly" note={undefined} />
        {hasCards ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mb-[2px] flex flex-shrink-0 items-center gap-1.5 text-[13px] font-semibold text-text2 transition-colors hover:text-text"
          >
            {expanded ? 'Collapse all' : 'Expand all'}
            <span
              className="transition-transform duration-300 motion-reduce:transition-none"
              style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
            >
              <Icon name="expand_more" size={16} />
            </span>
          </button>
        ) : null}
      </div>

      <DegradedNote degraded={degraded} />

      {isEmpty ? (
        <div className="mt-[18px]">
          <EmptyState route={`${result.params.from} → ${result.params.to}`} />
        </div>
      ) : others.length === 0 ? (
        <p className="mt-[18px] text-[14px] leading-[1.55] text-text2">
          That&apos;s the only fare we found for this route — it&apos;s the one above.
        </p>
      ) : (
        <div className="mt-[14px] grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {others.map((option, i) => (
            <ResultRow
              key={option.id}
              option={option}
              rank={i + 1}
              maxCpp={maxCpp || undefined}
              index={i}
              open={expanded}
              onToggle={() => setExpanded((v) => !v)}
              oneWay={oneWay}
            />
          ))}
        </div>
      )}
    </section>
  )
}
