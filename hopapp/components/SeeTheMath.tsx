'use client'

import { useId, useState } from 'react'
import type { FlightOption } from '@/lib/types'
import Icon from './Icon'

export interface SeeTheMathProps {
  pick: FlightOption
  /** Cheapest cash baseline the cpp is computed against. */
  cheapestCash?: number
  /** The cpp threshold above which points win (from lib/search). */
  threshold: number
  unit: string
}

function money(n: number | undefined): string {
  return n != null ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'
}

// "See the math" — the transparency panel behind the verdict. Shows the CPP
// calculation step by step: (cash − taxes) ÷ miles × 100 = X¢/pt, and why that
// clears (or misses) the threshold. Wired to real values from result.pick.
// 'use client' for the toggle; expands smoothly in place (.hop-collapse).
export default function SeeTheMath({ pick, cheapestCash, threshold, unit }: SeeTheMathProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  const cash = cheapestCash ?? pick.cashPrice
  const taxes = pick.taxes ?? 0
  const miles = pick.miles ?? 0
  const cpp = pick.cpp
  const net = cash != null ? cash - taxes : undefined
  const clears = cpp != null && cpp >= threshold

  return (
    // basis-full so, in the hero's button row, the button sits beside "Book"
    // (it's the first inline child) but the expanding panel wraps to full width below.
    <div className="contents">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex items-center gap-[8px] rounded-[14px] border-[1.5px] border-[#bfe9e1]/40 px-7 py-4 text-[15px] font-medium text-[#bfe9e1] transition-colors hover:border-[#bfe9e1] hover:text-white"
      >
        See the math
        <span
          className="transition-transform duration-300"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <Icon name="expand_more" size={18} />
        </span>
      </button>

      <div className="hop-collapse basis-full" data-open={open} id={panelId} role="region" aria-label="How we value these points">
        <div>
          <div className="mt-[18px] rounded-[16px] border border-white/12 bg-white/[0.04] p-[22px] text-[#dcefe9]">
            {/* the formula, spelled out with this pick's real numbers */}
            <div className="grid gap-[2px] font-display text-[15px] tabular-nums">
              <MathRow
                label="Cash price"
                value={money(cash)}
                hint="cheapest comparable cash fare"
              />
              <MathRow label="− Taxes & fees" value={`− ${money(taxes)}`} hint="paid on the award" />
              <div className="my-[8px] border-t border-white/12" />
              <MathRow label="= Cash value of the seat" value={money(net)} strong />
              <MathRow label="÷ Miles spent" value={`÷ ${miles.toLocaleString()} ${unit}`} />
              <MathRow label="× 100" value="× 100" hint="cents per point" />
              <div className="my-[8px] border-t border-white/12" />
              <MathRow
                label="= Value per point"
                value={cpp != null ? `${cpp.toFixed(1)}¢ / ${unit.slice(0, -1)}` : '—'}
                accent
                strong
              />
            </div>

            {/* threshold logic — why "use points" (or not) */}
            <div className="mt-[18px] flex items-start gap-[10px] border-t border-white/12 pt-[16px] text-[13.5px] leading-[1.55] text-[#bfe1da]">
              <span className="mt-[1px] flex-shrink-0 text-[#6ff0d2]">
                <Icon name={clears ? 'check_circle' : 'lightbulb'} size={17} />
              </span>
              <p>
                {clears ? (
                  <>
                    <b className="font-semibold text-white">
                      {cpp != null ? `${cpp.toFixed(1)}¢` : '—'}
                    </b>{' '}
                    clears our{' '}
                    <b className="font-semibold text-white">{threshold.toFixed(1)}¢</b> bar for
                    redeeming, so points beat cash here. Below{' '}
                    <b className="font-semibold text-white">{threshold.toFixed(1)}¢</b> we&apos;d tell
                    you to pay cash and keep the {unit} for a richer redemption.
                  </>
                ) : (
                  <>
                    At{' '}
                    <b className="font-semibold text-white">
                      {cpp != null ? `${cpp.toFixed(1)}¢` : '—'}
                    </b>{' '}
                    this redemption sits under our{' '}
                    <b className="font-semibold text-white">{threshold.toFixed(1)}¢</b> bar — paying
                    cash and keeping your {unit} stretches them further on another trip.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MathRow({
  label,
  value,
  hint,
  strong,
  accent,
}: {
  label: string
  value: string
  hint?: string
  strong?: boolean
  accent?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-[3px]">
      <span className={`text-[13.5px] ${strong ? 'font-semibold text-white' : 'text-[#bfe1da]'}`}>
        {label}
        {hint ? <span className="ml-2 text-[11.5px] font-normal text-[#84b3aa]">{hint}</span> : null}
      </span>
      <span
        className="flex-shrink-0 font-semibold"
        style={{ color: accent ? '#6ff0d2' : '#fff' }}
      >
        {value}
      </span>
    </div>
  )
}
