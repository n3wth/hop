'use client'

import { memo, useId } from 'react'
import type { CppTier, FlightOption } from '@/lib/types'
import { TIER_CLASS } from '@/components/ui/TierChip'
import { track } from '@/lib/posthog-client'
import Icon from './Icon'
import BrandIcon from './BrandIcon'
import Button from './ui/Button'
import Eyebrow from './ui/Eyebrow'

export interface ResultRowProps {
  option: FlightOption
  /** 1-based rank among the alternatives (the pick lives in the hero). */
  rank?: number
  /** Max cpp across the alternatives, to scale value bars relatively. */
  maxCpp?: number
  /** 0-based position, for the entrance stagger. */
  index?: number
  /** Controlled expand state — all rows expand/collapse together via the toolbar. */
  open: boolean
  onToggle: (id: string) => void
  oneWay?: boolean
};

// Value chip color by tier — semantic, not all-teal.
const CHIP: Record<CppTier, string> = {
  green: TIER_CLASS.green,
  amber: TIER_CLASS.amber,
  muted: TIER_CLASS.muted,
}
const BAR: Record<CppTier, string> = {
  green: 'var(--color-brand)',
  amber: 'var(--color-amber)',
  muted: 'var(--color-weak)',
}
// Plain-language strength word per tier, so the chip's value isn't conveyed by
// color alone to screen readers (mirrors DealCard's chip label).
const TIER_WORD: Record<CppTier, string> = {
  green: 'Excellent',
  amber: 'Good',
  muted: 'Fair',
}

function rankLabel(option: FlightOption, rank?: number): string {
  if (option.kind === 'cash') return 'Cash'
  if (rank == null) return ''
  const map: Record<number, string> = { 1: 'Runner-up', 2: '3rd', 3: '4th', 4: '5th' }
  // Overall placement is rank + 1 (the pick is 1st). Ordinal-suffix the fallback
  // so beyond the mapped few it reads "6th", "21st", "22nd" — never "21th".
  const place = rank + 1
  const tens = place % 100
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][place % 10] ?? 'th'
  return map[rank] ?? `${place}${suffix}`
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

function durationText(min?: number): string {
  if (min == null) return ''
  return `${Math.floor(min / 60)}h ${min % 60}m`
}

// Editorial alternative card. Ranked, with a value bar so the best deal reads
// instantly, a semantic value chip, and one factual assessment line. Clicking
// the card expands the full detail in place (itinerary, transfer steps, fare,
// booking CTA) with a smooth height grow — no vertical lift.
// Memoised: expand/collapse state lives in the parent (ResultsList) and only
// the toggled card's `open` prop changes, so siblings skip re-rendering.
const ResultRow = memo(function ResultRow({ option, rank, maxCpp, index = 0, open, onToggle, oneWay = false }: ResultRowProps) {
  const panelId = useId()

  const isCash = option.kind === 'cash'
  const cpp = option.cpp
  const cppText = cpp != null ? `${cpp.toFixed(1)}¢` : null

  // Value bar: award/transfer scaled by cpp vs the strongest alternative. Cash
  // has no cpp to rank, so its track reads EMPTY (0%) — a phantom fixed fill
  // would imply a value score it doesn't have.
  const barPct = isCash
    ? 0
    : cpp != null && maxCpp
      ? Math.max(10, Math.round((cpp / maxCpp) * 100))
      : 0
  const barColor = isCash ? 'var(--color-text3)' : BAR[option.tier]

  const unit = option.program?.toLowerCase().includes('southwest') ? 'pts' : 'mi'

  const [routeFrom, routeTo] = option.route.split('→').map((s) => s.trim())
  const origin = option.originCode ?? routeFrom
  const dest = option.destCode ?? routeTo
  const dur = durationText(option.durationMin)
  const stopLabel =
    option.stops === 0 || option.direct
      ? 'nonstop'
      : option.stops != null
        ? `${option.stops} stop${option.stops > 1 ? 's' : ''}`
        : ''

  const detailFacts = [option.cabin, option.aircraft, option.fareBrand].filter(Boolean)
  const transfers = option.transferFrom ?? []

  return (
    <article
      className="hop-rise flex flex-col rounded-[20px] border-[1.5px] border-border bg-paper transition-colors hover:border-brand-mint-deep data-[open=true]:border-brand"
      data-open={open}
      style={{ ['--hop-delay' as string]: `${120 + index * 70}ms` }}
    >
      {/* summary — the whole top is the toggle */}
      <button
        type="button"
        onClick={() => onToggle(option.id)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${open ? 'Hide' : 'Show'} details for ${option.airline} ${option.route}`}
        className="flex flex-1 cursor-pointer flex-col px-[18px] pb-[18px] pt-5 text-left sm:px-[22px] sm:pb-[22px] sm:pt-6"
      >
        <div className="flex items-start justify-between">
          <BrandIcon code={option.airlineCode} name={option.airline} size={46} />
          <span className="mt-[3px] font-display text-[12px] font-semibold uppercase tracking-[var(--track-label)] text-text3">
            {rankLabel(option, rank)}
          </span>
        </div>

        {/* fixed-height name+route block so price/value/bar align across cards —
            sm+ only; the single-column phone layout has nothing to align with,
            so the min-height would just be dead space. */}
        <div className="mt-[14px] sm:mt-[18px] sm:min-h-[58px]">
          <div className="font-display text-[17px] font-semibold leading-[1.1] text-text sm:text-[19px]">
            {option.airline}
          </div>
          <div className="mt-[5px] text-[12.5px] tracking-[var(--track-label)] text-text3">
            {option.direct ? 'Direct · ' : ''}
            {option.route}
            {option.durationMin != null ? ` · ${dur}` : ''}
          </div>
        </div>

        <div className="pt-[14px] sm:pt-[18px]">
          <div className="hop-price text-[26px] leading-none text-text sm:text-[30px]">
            {isCash
              ? `$${option.cashPrice?.toLocaleString('en-US') ?? '—'}`
              : option.miles?.toLocaleString('en-US') ?? '—'}
            <small className="font-sans text-[14px] font-medium text-text3">
              {isCash ? (oneWay ? ' ow' : ' rt') : ` ${unit}`}
            </small>
          </div>

          <div className="mt-[10px] flex items-center gap-2">
            {cppText ? (
              <span
                className={`hop-num rounded-full px-[9px] py-1 text-[11.5px] font-semibold ${CHIP[option.tier]}`}
                aria-label={`${cppText} per point — ${TIER_WORD[option.tier]}`}
              >
                <span aria-hidden="true">{cppText} / pt</span>
              </span>
            ) : option.earn != null ? (
              <span className="hop-num rounded-full bg-sunk px-[9px] py-1 text-[11.5px] font-semibold text-text2">
                earns ~${option.earn.toFixed(2)}
              </span>
            ) : null}
          </div>

          {/* value bar — visual ranking, grows from 0 on load */}
          <div className="mt-[14px] h-[6px] overflow-hidden rounded-full bg-border">
            <span
              className="hop-bar block h-full rounded-full"
              style={{
                ['--hop-bar-w' as string]: `${barPct}%`,
                ['--hop-delay' as string]: `${260 + index * 70}ms`,
                background: barColor,
              }}
            />
          </div>
        </div>

        {/* footer note row — items-start so a wrapped assessment line keeps the
            Details affordance pinned to the first line instead of floating mid-card */}
        <div className="mt-3 flex items-start justify-between gap-3 border-t border-hair pt-[10px] sm:mt-[14px] sm:items-center sm:pt-[12px]">
          <span className="min-w-0 flex-1 text-[12.5px] leading-[1.45] text-text2">{assessment(option)}</span>
          <span
            aria-hidden
            className="mt-[2px] flex flex-shrink-0 items-center gap-[3px] text-[11px] font-semibold text-text3 sm:mt-0"
          >
            {open ? 'Less' : 'Details'}
            <span
              className="transition-transform duration-300 motion-reduce:transition-none"
              style={{ transform: open ? 'rotate(180deg)' : 'none' }}
            >
              <Icon name="expand_more" size={16} />
            </span>
          </span>
        </div>
      </button>

      {/* expandable detail — smooth height grow, no vertical lift. While
          collapsed it's inert + aria-hidden so its booking link leaves the tab
          order and screen-reader flow until the card is opened. */}
      <div
        className="hop-collapse px-[18px] sm:px-[22px]"
        data-open={open}
        id={panelId}
        role="region"
        inert={!open}
        aria-hidden={!open}
      >
        <div>
          <div className="border-t border-border pb-[20px] pt-[16px]">
            {/* itinerary */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex-shrink-0">
                <div className="font-display text-[20px] font-semibold leading-none text-text">
                  {origin}
                </div>
                {option.departTime ? (
                  <div className="mt-[3px] text-[12px] text-text3">{option.departTime}</div>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col items-center gap-[2px]">
                <div className="flex w-full items-center gap-[6px] text-brand">
                  <span className="h-px flex-1 bg-border" />
                  <span aria-hidden className="text-[15px] font-semibold leading-none">→</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="text-[11px] text-text3">
                  {dur}
                  {dur && stopLabel ? ' · ' : ''}
                  {stopLabel}
                </div>
              </div>

              <div className="flex-shrink-0 text-right">
                <div className="font-display text-[20px] font-semibold leading-none text-text">
                  {dest}
                </div>
                {option.arriveTime ? (
                  <div className="mt-[3px] text-[12px] text-text3">{option.arriveTime}</div>
                ) : null}
              </div>
            </div>

            {/* flight facts: flight no · operated by */}
            {(option.flightNo || option.operatedBy) && (
              <div className="mt-[14px] text-[12px] text-text2">
                {option.flightNo}
                {option.operatedBy ? ` · operated by ${option.operatedBy}` : ''}
              </div>
            )}

            {/* cabin · aircraft · fare brand */}
            {detailFacts.length > 0 && (
              <div className="mt-[6px] flex flex-wrap gap-[6px]">
                {detailFacts.map((f) => (
                  <span
                    key={f}
                    className="rounded-[6px] bg-sunk px-[8px] py-[3px] text-[11px] font-medium text-text2"
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}

            {/* transfer steps */}
            {option.kind === 'transfer' && transfers.length > 0 && (
              <div className="mt-[14px] rounded-[10px] bg-brand-tint px-[12px] py-[10px]">
                <Eyebrow className="mb-[6px]">How to book</Eyebrow>
                <ol className="space-y-[5px] text-[12.5px] leading-[1.45] text-text2">
                  {transfers.map((t, i) => (
                    <li key={t.source} className="flex gap-[8px]">
                      <span className="flex-shrink-0 font-semibold text-brand">{i + 1}.</span>
                      <span>
                        Transfer{option.miles != null ? ` ${option.miles.toLocaleString('en-US')}` : ''}{' '}
                        <b className="font-semibold text-text">{t.source}</b>
                        {t.ratio ? ` (${t.ratio})` : ''} →{' '}
                        <b className="font-semibold text-text">{option.program}</b>, then book.
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* booking CTA — cash bookings emit the client-side outclick
                funnel event (the /api/go/kiwi redirect records the server
                shadow either way). */}
            <div className="mt-[16px]">
              <Button
                variant="ink"
                fullWidth
                href={option.bookingUrl}
                onClick={(e) => {
                  e.stopPropagation()
                  if (option.kind === 'cash') {
                    track('outclick', { kind: 'cash', target: option.route })
                  }
                }}
              >
                {actionLabel(option)}
                <Icon name="swap_horiz" size={16} className={option.kind === 'transfer' ? '' : 'hidden'} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
})

export default ResultRow
