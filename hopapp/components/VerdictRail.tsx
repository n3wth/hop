import type { SearchResult } from '@/lib/types'
import Icon from './Icon'

export interface VerdictRailProps {
  result: SearchResult
}

const VERDICT_LABEL: Record<SearchResult['verdict'], string> = {
  'use-points': 'Use points',
  'pay-cash': 'Pay cash',
  none: 'No clear winner',
}

interface VStatProps {
  label: string
  value: string
  unit?: string
  tone?: 'good' | 'brand'
}

function VStat({ label, value, unit, tone }: VStatProps) {
  const toneClass = tone === 'good' ? 'text-good' : tone === 'brand' ? 'text-brand' : undefined
  return (
    <div className="flex flex-col justify-center border-r border-hair px-6 py-3 last:border-r-0">
      <div className="mb-[3px] text-[10px] font-bold uppercase tracking-[0.05em] text-text3">
        {label}
      </div>
      <div className={['text-[18px] font-bold tabular-nums tracking-[-0.02em]', toneClass].filter(Boolean).join(' ')}>
        {value}
        {unit ? <small className="text-xs font-semibold text-text3"> {unit}</small> : null}
      </div>
    </div>
  )
}

// Verdict strip per v9: brand block + hairline-divided stat cells.
export default function VerdictRail({ result }: VerdictRailProps) {
  const { summary, verdict } = result

  return (
    <div className="mb-[22px] flex items-stretch overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex flex-shrink-0 items-center gap-[13px] bg-brand px-[22px] py-4 text-white">
        <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white/[0.16]">
          <Icon name="check_circle" size={22} />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.07em] opacity-85">
            Our verdict
          </div>
          <div className="text-base font-bold tracking-[-0.01em]">{VERDICT_LABEL[verdict]}</div>
        </div>
      </div>

      <div className="flex flex-1">
        <VStat
          label="Cheapest cash"
          value={summary.cheapestCash != null ? `$${summary.cheapestCash.toLocaleString()}` : '—'}
          unit={summary.cheapestCash != null ? 'rt' : undefined}
        />
        <VStat
          label="Best redemption"
          value={summary.bestMiles != null ? summary.bestMiles.toLocaleString() : '—'}
          unit={summary.bestMiles != null ? 'mi' : undefined}
          tone="brand"
        />
        <VStat
          label="Value"
          value={summary.bestCpp != null ? `${summary.bestCpp.toFixed(1)}¢` : '—'}
          unit={summary.bestCpp != null ? '/pt' : undefined}
          tone="good"
        />
        <VStat
          label="You save"
          value={summary.saveVsCash != null ? `$${summary.saveVsCash.toLocaleString()}` : '—'}
          tone="good"
        />
      </div>
    </div>
  )
}
