import type { CppTier, FlightOption } from '@/lib/types'
import Icon from './Icon'
import BrandIcon from './BrandIcon'

export interface ResultRowProps {
  option: FlightOption
  /** 1-based rank among the alternatives (the pick lives in the hero). */
  rank?: number
  /** Max cpp across the alternatives, to scale value bars relatively. */
  maxCpp?: number
}

// Value chip color by tier — semantic, not all-teal.
const CHIP: Record<CppTier, string> = {
  green: 'bg-good-bg text-good',
  amber: 'bg-ok-bg text-ok',
  muted: 'bg-weak-bg text-weak',
}
const BAR: Record<CppTier, string> = {
  green: 'var(--color-brand)',
  amber: 'var(--color-amber)',
  muted: 'var(--color-weak)',
}

function rankLabel(option: FlightOption, rank?: number): string {
  if (option.kind === 'cash') return 'Cash'
  if (rank == null) return ''
  const map: Record<number, string> = { 1: 'Runner-up', 2: '3rd', 3: '4th', 4: '5th' }
  return map[rank] ?? `${rank + 1}th`
}

// One plain assessment line — no first-person bunny theatrics (copy-spec).
function assessment(option: FlightOption): string {
  if (option.note) return option.note
  if (option.kind === 'cash') return 'Cash fare — keep your points.'
  if (option.tier === 'muted') return 'Skip it. Weak redemption here.'
  return 'Workable redemption on this route.'
}

function actionLabel(option: FlightOption): string {
  switch (option.action) {
    case 'book-cash':
      return 'Book cash'
    case 'pay-cash':
      return 'Pay cash instead'
    case 'transfer':
      return 'Transfer & book'
    case 'book-points':
      return 'Book with miles'
  }
  if (option.kind === 'cash') return 'Book cash'
  if (option.kind === 'transfer') return 'Transfer & book'
  return 'Book with miles'
}

// Editorial alternative card. Ranked, with a value bar so the best deal reads
// instantly, a semantic value chip, and one factual assessment line.
export default function ResultRow({ option, rank, maxCpp }: ResultRowProps) {
  const isCash = option.kind === 'cash'
  const cpp = option.cpp
  const cppText = cpp != null ? `${cpp.toFixed(1)}¢` : null

  // Value bar: award/transfer scaled by cpp vs the strongest alternative; cash
  // gets a fixed neutral baseline (it has no cpp).
  const barPct = isCash
    ? 40
    : cpp != null && maxCpp
      ? Math.max(10, Math.round((cpp / maxCpp) * 100))
      : 0
  const barColor = isCash ? 'var(--color-text2)' : BAR[option.tier]

  const unit = option.program?.toLowerCase().includes('southwest') ? 'pts' : 'mi'

  return (
    <article
      className="flex min-h-[268px] flex-col rounded-[20px] border-[1.5px] border-border bg-paper px-[22px] pb-[22px] pt-6 transition-colors hover:border-brand-mint-deep"
    >
      <div className="flex items-start justify-between">
        <BrandIcon code={option.airlineCode} name={option.airline} size={46} />
        <span className="font-display text-[14px] font-semibold text-text3">
          {rankLabel(option, rank)}
        </span>
      </div>

      <div className="mt-[18px] font-display text-[19px] font-semibold leading-[1.1] text-text">
        {option.airline}
      </div>
      <div className="mt-[5px] text-[12.5px] tracking-[0.02em] text-text3">
        {option.direct ? 'Direct · ' : ''}
        {option.route}
        {option.durationMin != null
          ? ` · ${Math.floor(option.durationMin / 60)}h ${option.durationMin % 60}m`
          : ''}
      </div>

      <div className="mt-auto pt-[18px]">
        <div className="font-display text-[30px] font-semibold leading-none tracking-[-0.01em] text-text">
          {isCash
            ? `$${option.cashPrice?.toLocaleString() ?? '—'}`
            : option.miles?.toLocaleString() ?? '—'}
          <small className="text-[14px] font-medium text-text3">
            {isCash ? ' rt' : ` ${unit}`}
          </small>
        </div>

        <div className="mt-[10px] flex items-center gap-2">
          {cppText ? (
            <span className={`rounded-[7px] px-[9px] py-1 text-[11.5px] font-semibold ${CHIP[option.tier]}`}>
              {cppText} / pt
            </span>
          ) : option.earn != null ? (
            <span className="rounded-[7px] bg-sunk px-[9px] py-1 text-[11.5px] font-semibold text-text2">
              earns ~${option.earn.toFixed(2)}
            </span>
          ) : null}
        </div>

        {/* value bar — visual ranking */}
        <div className="mt-[14px] h-[6px] overflow-hidden rounded-full bg-border">
          <span
            className="block h-full rounded-full"
            style={{ width: `${barPct}%`, background: barColor }}
          />
        </div>
      </div>

      <p className="mt-3 text-[12.5px] leading-[1.45] text-text2">{assessment(option)}</p>

      <div className="mt-4">
        <a
          href={option.bookingUrl}
          className="flex w-full items-center justify-center gap-[6px] rounded-[11px] border-[1.5px] border-text bg-transparent px-3 py-[11px] text-[14px] font-semibold text-text transition-colors hover:bg-text hover:text-white"
        >
          {actionLabel(option)}
          <Icon name="swap_horiz" size={15} className="hidden" />
        </a>
      </div>
    </article>
  )
}
