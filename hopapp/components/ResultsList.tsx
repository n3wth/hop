'use client'

import { useState } from 'react'
import type { FlightOption, SearchResult } from '@/lib/types'
import Icon from './Icon'
import ResultRow from './ResultRow'

export interface ResultsListProps {
  result: SearchResult
}

type Tab = 'all' | 'points' | 'cash'

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All results' },
  { id: 'points', label: 'Points' },
  { id: 'cash', label: 'Cash' },
]

function matchesTab(option: FlightOption, tab: Tab): boolean {
  if (tab === 'all') return true
  if (tab === 'points') return option.kind === 'award' || option.kind === 'transfer'
  return option.kind === 'cash'
}

// Integrated results plane: toolbar (tabs + sort) + bordered container with the
// pick banner above the pick row, then the rest of the options.
export default function ResultsList({ result }: ResultsListProps) {
  const [tab, setTab] = useState<Tab>('all')
  const { pick, options, summary } = result

  const visible = options.filter((o) => matchesTab(o, tab))
  const pickVisible = pick != null && matchesTab(pick, tab)
  const rest = visible.filter((o) => o.id !== pick?.id)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="inline-flex gap-0.5 rounded border border-border-soft bg-sunk p-[3px]">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                'rounded-[9px] px-[15px] py-[7px] text-[13px] font-semibold transition-colors',
                tab === t.id
                  ? 'border border-border bg-surface text-text'
                  : 'border border-transparent text-text2 hover:text-text',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex cursor-pointer items-center gap-[5px] text-[13px] font-medium text-text2">
          Sorted by <b className="font-semibold text-text">best value</b>
          <Icon name="expand_more" size={18} className="text-text3" />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {pickVisible && pick ? (
          <>
            <div className="flex items-center gap-2 bg-brand px-[18px] py-2 text-xs font-semibold text-white">
              <Icon name="workspace_premium" size={16} />
              Our pick · best value
              {summary.saveVsCash != null ? (
                <span className="ml-auto rounded-full bg-white/20 px-[11px] py-[3px]">
                  Save ${summary.saveVsCash.toLocaleString()}
                </span>
              ) : null}
            </div>
            <ResultRow option={pick} pick />
          </>
        ) : null}

        {rest.map((option) => (
          <ResultRow key={option.id} option={option} />
        ))}
      </div>
    </div>
  )
}
