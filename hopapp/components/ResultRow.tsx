import type { CppTier, FlightOption } from '@/lib/types'

export interface ResultRowProps {
  option: FlightOption
  pick?: boolean
}

const TILE_BG: Record<string, string> = {
  AS: 'bg-as',
  WN: 'bg-wn',
  UA: 'bg-ua',
}

const TIER_TEXT: Record<CppTier, string> = {
  green: 'text-good',
  amber: 'text-ok',
  muted: 'text-text3',
}

interface Metric {
  label: string
  value: string
  className?: string
}

// Build the right-aligned metric columns from the option, matching v9 per kind.
function buildMetrics(option: FlightOption): Metric[] {
  const cppText =
    option.cpp != null ? `${option.cpp.toFixed(1)}¢/pt` : undefined
  const youHave =
    option.youHave != null ? option.youHave.toLocaleString() : undefined

  if (option.kind === 'cash') {
    return [
      { label: 'Price', value: option.cashPrice != null ? `$${option.cashPrice.toLocaleString()}` : '—' },
      {
        label: 'Type',
        value: option.roundTrip ? 'RT' : 'OW',
        className: 'text-text3 text-[13px] font-semibold',
      },
      {
        label: 'Earn',
        value: option.earn != null ? `~$${option.earn.toFixed(2)}` : '—',
        className: 'text-brand text-[13px]',
      },
    ]
  }

  // award + transfer share the same Miles/Value/You-have layout
  const milesLabel = option.kind === 'transfer' ? 'Miles' : option.program?.includes('Southwest') ? 'Points' : 'Miles'
  return [
    {
      label: milesLabel,
      value: option.miles != null ? option.miles.toLocaleString() : '—',
      className: TIER_TEXT[option.tier],
    },
    {
      label: 'Value',
      value: cppText ?? '—',
      className: TIER_TEXT[option.tier],
    },
    {
      label: 'You have',
      value: youHave ?? '—',
      className: 'text-text3 font-semibold',
    },
  ]
}

interface ActionConfig {
  text: string
  variant: 'primary' | 'secondary' | 'ghost'
}

function buildAction(option: FlightOption, pick: boolean): ActionConfig {
  // Honor the explicit action intent decided at assembly time (lib/search.ts).
  switch (option.action) {
    case 'book-cash':
      return { text: 'Book cash', variant: 'secondary' }
    case 'pay-cash':
      return { text: 'Pay cash instead →', variant: 'ghost' }
    case 'transfer':
      return { text: 'Transfer', variant: 'secondary' }
    case 'book-points':
      return { text: 'Book points', variant: pick ? 'primary' : 'secondary' }
  }

  // Fallback for options without an explicit action (defensive).
  if (option.kind === 'cash') return { text: 'Book cash', variant: 'secondary' }
  if (option.kind === 'transfer') return { text: 'Transfer', variant: 'secondary' }
  if (option.tier === 'muted') return { text: 'Pay cash instead →', variant: 'ghost' }
  return { text: 'Book points', variant: pick ? 'primary' : 'secondary' }
}

const BTN_VARIANT: Record<ActionConfig['variant'], string> = {
  primary: 'bg-brand text-white hover:bg-brand-deep',
  secondary: 'bg-surface text-text border border-border hover:bg-sunk',
  ghost: 'bg-transparent text-text3 hover:text-text2',
}

export default function ResultRow({ option, pick = false }: ResultRowProps) {
  const tileBg = (option.airlineCode && TILE_BG[option.airlineCode]) || 'bg-brand'
  const monogram =
    option.airlineCode ?? option.airline.slice(0, 2).toUpperCase()
  const metrics = buildMetrics(option)
  const action = buildAction(option, pick)

  return (
    <div
      className={[
        'flex cursor-pointer items-center gap-[15px] border-b border-hair px-[18px] py-4 transition-colors last:border-b-0',
        pick ? 'bg-brand-tint hover:bg-[#e6f3ef]' : 'hover:bg-sunk',
      ].join(' ')}
    >
      <div
        className={[
          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold tracking-[-0.02em] text-white',
          tileBg,
        ].join(' ')}
      >
        {monogram}
      </div>

      <div className="w-[248px] min-w-0 flex-shrink-0">
        <div className="mb-0.5 flex items-center gap-2 text-[14.5px] font-bold tracking-[-0.01em]">
          {option.airline}
          {option.direct ? (
            <span className="inline-flex rounded-full bg-good-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.03em] text-good">
              Direct
            </span>
          ) : null}
        </div>
        <div className="text-[12.5px] text-text2">
          {option.date} · {option.route}
          {option.durationMin != null
            ? ` · ${Math.floor(option.durationMin / 60)}h ${option.durationMin % 60}m`
            : ''}
        </div>
        {option.note ? <div className="mt-0.5 text-[11.5px] text-text3">{option.note}</div> : null}
      </div>

      <div className="ml-auto flex flex-shrink-0 items-center">
        {metrics.map((m) => (
          <div key={m.label} className="w-20 text-right">
            <div className="mb-[3px] text-[10px] font-bold uppercase tracking-[0.05em] text-text3">
              {m.label}
            </div>
            <div className={['text-[15px] font-bold tabular-nums', m.className].filter(Boolean).join(' ')}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      <div className="ml-[18px] flex w-[132px] flex-shrink-0 justify-end">
        <a
          href={option.bookingUrl}
          className={[
            'inline-flex items-center gap-[5px] whitespace-nowrap rounded-[10px] px-4 py-[9px] text-[13px] font-semibold transition-colors',
            BTN_VARIANT[action.variant],
          ].join(' ')}
        >
          {action.text}
        </a>
      </div>
    </div>
  )
}
