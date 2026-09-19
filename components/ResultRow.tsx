'use client'

import { memo } from 'react'
import type { CppTier, FlightOption } from '@/lib/types'
import { track } from '@/lib/posthog-client'
import { TIER_CLASS } from './ui/TierChip'
import Icon from './Icon'
import Button from './ui/Button'
import Card from './ui/Card'
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
  /** One-way trip — cash price reads "ow" instead of "rt". */
  oneWay?: boolean
}

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
  if (rank === 1) return '#1 Alt'
  if (rank === 2) return '#2 Alt'
  if (rank === 3) return '#3 Alt'
  return rank != null ? `#${rank}` : 'Alt'
}

function subheadText(option: FlightOption, oneWay?: boolean): string {
  const trip = oneWay ? 'OW' : 'RT'
  // Cash is the only branch that says "Cash" — award AND transfer options are
  // points redemptions, named by their loyalty program, never priced as $0.
  if (option.kind === 'cash') {
    return [option.airline, trip, 'Cash'].filter(Boolean).join(' • ')
  }
  return [option.program ?? option.airline, trip, 'Points'].filter(Boolean).join(' • ')
}

function actionLabel(option: FlightOption): string {
  if (option.kind === 'transfer') return 'Transfer points'
  if (option.kind === 'award') return 'Book with miles'
  return 'Book cash'
}

/**
 * Alternative flight option card rendered inside ResultsList.
 *
 * Wrapped in `memo` so that expanding or collapsing a single card in
 * `ResultsList` (which mutates `openIds` state) only re-renders the toggled
 * card, leaving all sibling cards un-rendered.
 */
const ResultRow = memo(function ResultRow({
  option,
  rank,
  maxCpp,
  open,
  onToggle,
  oneWay,
}: ResultRowProps) {
  const isTransfer = option.kind === 'transfer'
  const isCash = option.kind === 'cash'

  // Relative width for the value bar — scales against the strongest cpp in the batch.
  const cpp = option.cpp ?? 0
  const barPercent = maxCpp && maxCpp > 0 ? Math.min(100, Math.round((cpp / maxCpp) * 100)) : 0

  return (
    <article
      className="group relative flex flex-col transition-all duration-200"
      data-card-id={option.id}
    >
      <Card surface="surface" radius="sm" className="flex flex-1 flex-col p-[20px]">
        {/* Header — rank badge + value chip */}
        <div className="flex items-center justify-between gap-[8px]">
          <Eyebrow>{rankLabel(option, rank)}</Eyebrow>
          {cpp > 0 ? (
            <span
              className={`inline-flex items-center rounded-[6px] px-[8px] py-[2px] text-[12px] font-semibold tracking-[-0.01em] ${CHIP[option.tier]}`}
              aria-label={`Value score: ${cpp.toFixed(1)} cents per point, ${TIER_WORD[option.tier]}`}
            >
              {cpp.toFixed(1)}¢/pt
            </span>
          ) : isCash ? (
            <Eyebrow>
              Pay cash
            </Eyebrow>
          ) : null}
        </div>

        {/* Primary headline — price/points */}
        <div className="mt-[12px]">
          {/* Branch on CASH, not transfer — award options are points options.
              A missing figure renders "—", never a coalesced $0. */}
          <div className="text-[26px] font-semibold tracking-[-0.03em] text-text">
            {isCash ? (
              option.cashPrice != null ? `$${option.cashPrice.toLocaleString('en-US')}` : '—'
            ) : option.miles != null ? (
              <>
                {option.miles.toLocaleString('en-US')}{' '}
                <span className="text-[14px] font-medium tracking-normal text-text2">pts</span>
              </>
            ) : (
              '—'
            )}
          </div>
          <div className="mt-[2px] text-[13px] font-normal leading-[1.4] text-text2">
            {subheadText(option, oneWay)}
          </div>
        </div>

        {/* Value bar — visual strength relative to the batch leader */}
        {cpp > 0 ? (
          <div
            className="mt-[12px] h-[3px] w-full overflow-hidden rounded-full bg-surface2"
            aria-hidden="true"
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(8, barPercent)}%`,
                backgroundColor: BAR[option.tier],
              }}
            />
          </div>
        ) : null}

        {/* Secondary detail row — taxes / fees / programmatic source */}
        <div className="mt-[14px] flex flex-wrap items-center justify-between gap-[8px] text-[12px] text-text2">
          <span>
            {option.taxes ? `+$${option.taxes} taxes & fees` : 'No extra fees'}
          </span>
          {option.program ? (
            <span className="font-medium text-text">{option.program}</span>
          ) : null}
        </div>

        {/* Toggle CTA bar */}
        <div className="mt-[16px] pt-[12px] border-t border-border/60">
          <button
            type="button"
            onClick={() => onToggle(option.id)}
            className="flex w-full items-center justify-between text-[13px] font-medium text-text hover:text-brand transition-colors"
            aria-expanded={open}
          >
            <span>{open ? 'Hide details' : 'View flight details'}</span>
            <Icon
              name="expand_more"
              size={16}
              className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </Card>

      {/* Expandable detail drawer — rendered inline below card body when open */}
      <div
        className={`grid transition-all duration-200 ease-in-out ${
          open ? 'grid-rows-[1fr] opacity-100 mt-[12px]' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <Card surface="paper" className="p-[18px] text-[13px]">
            {/* Flight segment summary */}
            <div className="space-y-[8px]">
              <div className="flex items-center justify-between text-text">
                <span className="font-semibold">{option.route}</span>
                <span className="text-text2">{option.stops === 0 ? 'Nonstop' : `${option.stops} stop`}</span>
              </div>
              <div className="text-text2">
                Cabin: <span className="font-medium text-text capitalize">{option.cabin}</span>
              </div>
              {option.durationMin ? (
                <div className="text-text2">
                  Duration: <span className="font-medium text-text">{option.durationMin}m</span>
                </div>
              ) : null}
            </div>

            {/* Step-by-step instructions for points transfer if applicable */}
            {isTransfer && option.transferFrom && (
              <div className="mt-[14px] pt-[12px] border-t border-border/60">
                <Eyebrow className="mb-[6px]">
                  Transfer steps
                </Eyebrow>
                <ol className="list-decimal pl-[16px] space-y-[4px] text-[12px] text-text2">
                  {option.transferFrom.map((t, idx) => (
                    <li key={idx}>
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

            {/* booking CTA */}
            <div className="mt-[16px]">
              <Button
                variant="ink"
                fullWidth
                href={option.bookingUrl}
                onClick={(e) => {
                  e.stopPropagation()
                  track('outclick', {
                    kind: option.kind === 'cash' ? 'booking' : 'award',
                    target: option.program ?? option.airline,
                    tier: option.tier,
                  })
                }}
              >
                {actionLabel(option)}
                <Icon name="swap_horiz" size={16} className={option.kind === 'transfer' ? '' : 'hidden'} />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </article>
  )
})

export default ResultRow
