'use client'

import { useCallback, useState } from 'react'
import type { SearchResult } from '@/lib/types'
import ResultRow from './ResultRow'
import EmptyState from './EmptyState'
import DegradedNote from './DegradedNote'
import Icon from './Icon'

export interface ResultsListProps {
  result: SearchResult
  /** Seat-occupying travelers, computed server-side by the engine's seatsFor —
      passed in (not re-derived here) so the party-basis note always matches
      the multiplier the figures were scaled by. Defaults to 1 (no note). */
  travelers?: number
}

// "Other ways to fly" — the pick lives in the hero, so this ranks the remaining
// options as value-weighted cards (best deal reads first via the value bars).
// Each card owns its own expand state (collapsed on load); an expand/collapse-all
// toolbar drives them together. Surfaces degraded + empty states.
export default function ResultsList({ result, travelers = 1 }: ResultsListProps) {
  const { pick, options, degraded } = result
  const oneWay = !result.params.return
  const others = options.filter((o) => o.id !== pick?.id)

  // Per-card expand state — a Set of open option ids so cards open/close
  // independently, while the toolbar can still drive them all at once.
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())

  // Stable reference — setOpenIds (from useState) is itself stable, but it's
  // listed explicitly so the React Compiler's static dependency inference
  // matches the source deps. Passed directly to memoised ResultRow so memo's
  // shallow comparison sees the same function reference across parent re-renders.
  const toggleOne = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [setOpenIds])

  // Strongest cpp among the alternatives, to scale the value bars relatively.
  const maxCpp = others.reduce((m, o) => (o.cpp != null && o.cpp > m ? o.cpp : m), 0)

  const isEmpty = options.length === 0
  const hasCards = !isEmpty && others.length > 0
  // "All expanded" reflects the toolbar's aria-expanded — true only when every
  // card is open; toggling then collapses all, otherwise expands all.
  const allExpanded = hasCards && openIds.size === others.length

  const toggleAll = () => {
    if (allExpanded) {
      setOpenIds(new Set())
    } else {
      setOpenIds(new Set(others.map((o) => o.id)))
    }
  }

  return (
    <div className="w-full">
      {/* Section head — ONE row sharing a single ink underline: display-size
          title left, expand/collapse toolbar right, both bottom-aligned on the
          same rule so they can't drift apart. Shown only when there are cards. */}
      {hasCards ? (
        <div className="flex items-end justify-between gap-4 border-b-[1.5px] border-text pb-4">
          <h2 className="font-display text-[21px] font-semibold tracking-[-0.01em] text-text sm:text-[24px]">
            Other ways to fly
          </h2>
          <button
            type="button"
            onClick={toggleAll}
            className="mb-[2px] flex flex-shrink-0 items-center gap-[4px] text-[13px] font-medium text-text2 hover:text-text transition-colors"
            aria-expanded={allExpanded}
          >
            <span>{allExpanded ? 'Collapse all' : 'Expand all'}</span>
            <span
              className={`inline-block transition-transform duration-200 ${
                allExpanded ? 'rotate-180' : ''
              }`}
            >
              <Icon name="expand_more" size={16} />
            </span>
          </button>
        </div>
      ) : null}

      <DegradedNote degraded={degraded} />

      {isEmpty ? (
        <div className="mt-[18px]">
          <EmptyState
            route={`${result.params.from} → ${result.params.to}`}
            fromCode={result.params.from}
            toCode={result.params.to}
          />
        </div>
      ) : others.length === 0 ? (
        <p className="mt-[18px] text-[14px] leading-[1.55] text-text2">
          That&apos;s the only fare we found for this route — it&apos;s the one above.
        </p>
      ) : (
        <>
          <div className="mt-[14px] grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
            {others.map((option, i) => (
              <ResultRow
                key={option.id}
                option={option}
                rank={i + 1}
                maxCpp={maxCpp || undefined}
                index={i}
                open={openIds.has(option.id)}
                onToggle={toggleOne}
                oneWay={oneWay}
              />
            ))}
          </div>
          {/* Party-basis note — same sentence as the verdict hero's, so the
              card figures are never mistaken for per-person economics. */}
          {travelers > 1 ? (
            <p className="mt-[14px] text-[12px] font-medium text-text3">
              Totals for {travelers} travelers.
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
