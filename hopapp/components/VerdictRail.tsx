import type { FlightOption, SearchResult } from '@/lib/types'
import { POINTS_THRESHOLD_CPP } from '@/lib/search'
import Icon from './Icon'
import Logo from './Logo'
import BrandIcon from './BrandIcon'
import SeeTheMath from './SeeTheMath'
import CountUp from './CountUp'

export interface VerdictRailProps {
  result: SearchResult
}

function fmt(n: number | undefined): string {
  return n != null ? n.toLocaleString() : '—'
}

function milesUnit(pick: FlightOption | undefined): string {
  if (!pick) return 'miles'
  return pick.program?.toLowerCase().includes('southwest') ? 'points' : 'miles'
}

// Editorial verdict hero — the magazine cover. Teal plane: headline + factual
// subline + stat strip on the left; bunny + boarding-pass pick card on the right.
export default function VerdictRail({ result }: VerdictRailProps) {
  const { pick, summary, verdict } = result
  const usingPoints = verdict === 'use-points'
  const unit = milesUnit(pick)

  const save = summary.saveVsCash ?? 0
  const cpp = summary.bestCpp
  const miles = summary.bestMiles
  const cash = summary.cheapestCash

  const airlineShort = pick?.airline.split(' ')[0] ?? 'points'

  return (
    <section
      className="mt-[26px] grid grid-cols-1 overflow-hidden rounded-[20px] text-[#eafaf7] lg:grid-cols-[1fr_392px] lg:rounded-[28px]"
      style={{ background: 'var(--color-brand)' }}
    >
      {/* LEFT — the verdict */}
      <div className="px-6 pb-9 pt-8 sm:px-10 lg:px-[52px] lg:pb-[46px] lg:pt-12">
        <span className="mb-[26px] inline-flex items-center gap-[11px] border-b border-white/15 pb-4 text-[12px] font-semibold uppercase tracking-[0.22em] text-[#9fe0d6]">
          <span className="h-[7px] w-[7px] rounded-full bg-[#5fe3c8]" />
          Best value
        </span>

        <h1 className="hop-rise font-display text-[34px] font-semibold leading-[1.02] tracking-[-0.025em] text-white sm:text-[48px] sm:leading-[1.0] lg:text-[64px] lg:leading-[0.98]" style={{ ['--hop-delay' as string]: '60ms' }}>
          {usingPoints ? (
            <>
              Use your <span className="text-[#ffe7b0]">{airlineShort}&nbsp;{unit}.</span>
              <br />
              Save{' '}
              <CountUp
                className="text-[#6ff0d2] tabular-nums"
                value={save}
                format="usd"
                delayMs={420}
              />{' '}
              vs cash.
            </>
          ) : (
            <>
              Pay <span className="text-[#ffe7b0]">cash.</span>
              <br />
              Points don&apos;t pay off here.
            </>
          )}
        </h1>

        {usingPoints ? (
          <p className="hop-rise mt-6 max-w-[46ch] text-[17px] leading-[1.55] text-[#c7ece5]" style={{ ['--hop-delay' as string]: '140ms' }}>
            <b className="font-semibold text-white">
              {fmt(miles)} {unit}
            </b>{' '}
            at{' '}
            <b className="font-semibold text-white">{cpp != null ? `${cpp.toFixed(1)}¢` : '—'} each</b>{' '}
            — the best redemption across your {result.balances.length} programs. Cash is{' '}
            <b className="font-semibold text-white">${fmt(cash)}</b>. You have the {unit}.
          </p>
        ) : (
          <p className="hop-rise mt-6 max-w-[46ch] text-[17px] leading-[1.55] text-[#c7ece5]" style={{ ['--hop-delay' as string]: '140ms' }}>
            No redemption clears the bar on this route. Cash is{' '}
            <b className="font-semibold text-white">${fmt(cash)}</b> — keep your points for a trip
            where they stretch further.
          </p>
        )}

        <div className="mt-[34px] flex flex-wrap items-center gap-4">
          <a
            href={pick?.bookingUrl ?? '#'}
            className="inline-flex items-center gap-[10px] rounded-[14px] bg-white px-7 py-4 text-[16px] font-semibold text-[#073e3e] transition-colors hover:bg-[#fffdf6]"
          >
            <Icon name="check_circle" size={19} />
            {usingPoints ? `Book with ${airlineShort} ${unit}` : 'Book cash'}
          </a>
          {/* See the math — sits to the RIGHT of Book; its panel expands below. */}
          {pick ? (
            <SeeTheMath
              pick={pick}
              cheapestCash={cash}
              threshold={POINTS_THRESHOLD_CPP}
              unit={unit}
            />
          ) : null}
        </div>

        <div className="hop-rise mt-8 flex flex-wrap gap-x-8 gap-y-5 border-t border-white/15 pt-7 sm:gap-10 lg:mt-[42px] lg:pt-[30px]" style={{ ['--hop-delay' as string]: '220ms' }}>
          <HStat label="You pay" value={fmt(miles)} unit={unit} />
          <HStat label="Value" value={cpp != null ? `${cpp.toFixed(1)}¢` : '—'} unit={`/ ${unit.slice(0, -1)}`} />
          <HStat label="Cash price" value={`$${fmt(cash)}`} />
          <HStat label="You save" value={`$${fmt(save)}`} accent />
        </div>
      </div>

      {/* RIGHT — bunny + boarding-pass pick */}
      <aside
        className="relative flex flex-col justify-between border-t border-dashed border-white/20 lg:border-l lg:border-t-0"
        style={{
          background:
            'radial-gradient(120% 120% at 85% 15%, rgba(255,255,255,.10), rgba(255,255,255,0) 55%), var(--color-brand-deep)',
        }}
      >
        <div className="relative grid flex-1 place-items-center overflow-hidden pt-9">
          <span className="hop-float">
            <Logo size={172} carve="var(--color-brand-deep)" className="text-white" />
          </span>
        </div>

        {pick ? <PickPass pick={pick} /> : null}
      </aside>
    </section>
  )
}

function HStat({
  label,
  value,
  unit,
  accent,
}: {
  label: string
  value: string
  unit?: string
  accent?: boolean
}) {
  return (
    <div>
      <div className="mb-[6px] text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8fcabf]">
        {label}
      </div>
      <div
        className="font-display text-[27px] font-semibold tracking-[-0.01em] tabular-nums"
        style={{ color: accent ? '#6ff0d2' : '#fff' }}
      >
        {value}
        {unit ? <small className="text-[14px] font-medium text-[#9fe0d6]"> {unit}</small> : null}
      </div>
    </div>
  )
}

// Boarding-pass card for the pick — a real ticket: airline + flight no, the
// itinerary as origin/time —✈ dur nonstop— dest/time, and a cabin/aircraft/fare
// detail row. Notched ticket edge. Airline name appears once.
function PickPass({ pick }: { pick: FlightOption }) {
  const [routeFrom, routeTo] = pick.route.split('→').map((s) => s.trim())
  const origin = pick.originCode ?? routeFrom
  const dest = pick.destCode ?? routeTo
  const dur =
    pick.durationMin != null
      ? `${Math.floor(pick.durationMin / 60)}h ${pick.durationMin % 60}m`
      : ''
  const stopLabel =
    pick.stops === 0 || pick.direct
      ? 'nonstop'
      : pick.stops != null
        ? `${pick.stops} stop${pick.stops > 1 ? 's' : ''}`
        : ''

  // Compact detail row: cabin · aircraft · fare brand (only present ones).
  const details = [pick.cabin, pick.aircraft, pick.fareBrand].filter(Boolean)

  return (
    <div className="relative mx-[26px] mb-[26px] rounded-[18px] bg-paper text-text">
      {/* header band: airline + flight no + Direct tag */}
      <div className="flex items-center justify-between px-[22px] pb-[14px] pt-[18px]">
        <div className="flex min-w-0 items-center gap-[11px]">
          <BrandIcon code={pick.airlineCode} name={pick.airline} size={40} />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-tight">{pick.airline}</div>
            <div className="text-[11.5px] text-text3">
              {pick.flightNo}
              {pick.operatedBy ? ` · ${pick.operatedBy}` : ''}
            </div>
          </div>
        </div>
        {stopLabel === 'nonstop' ? (
          <span className="flex-shrink-0 rounded-lg bg-brand-light px-[10px] py-[5px] text-[11px] font-semibold uppercase tracking-[0.02em] text-brand">
            Direct
          </span>
        ) : null}
      </div>

      {/* notched perforation */}
      <div className="relative">
        <span
          className="absolute left-[-9px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full"
          style={{ background: 'var(--color-brand-deep)' }}
        />
        <span
          className="absolute right-[-9px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full"
          style={{ background: 'var(--color-brand-deep)' }}
        />
        <div className="mx-[22px] border-t-[1.5px] border-dashed border-border" />
      </div>

      {/* itinerary */}
      <div className="flex items-center justify-between gap-3 px-[22px] pb-[16px] pt-[16px]">
        <div className="flex-shrink-0">
          <div className="font-display text-[22px] font-semibold leading-none">{origin}</div>
          {pick.departTime ? (
            <div className="mt-[3px] text-[12px] text-text3">{pick.departTime}</div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col items-center gap-[2px]">
          <div className="flex w-full items-center gap-[6px] text-brand">
            <span className="h-px flex-1 bg-border" />
            <Icon name="flight" size={18} className="rotate-90" />
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="text-[11px] text-text3">
            {dur}
            {dur && stopLabel ? ' · ' : ''}
            {stopLabel}
          </div>
        </div>

        <div className="flex-shrink-0 text-right">
          <div className="font-display text-[22px] font-semibold leading-none">{dest}</div>
          {pick.arriveTime ? (
            <div className="mt-[3px] text-[12px] text-text3">{pick.arriveTime}</div>
          ) : null}
        </div>
      </div>

      {/* detail row: cabin · aircraft · fare */}
      {details.length > 0 ? (
        <div className="border-t border-border px-[22px] py-[11px] text-[11.5px] text-text2">
          {details.join(' · ')}
        </div>
      ) : null}
    </div>
  )
}
