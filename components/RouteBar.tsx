import type { SearchResult } from '@/lib/types'
import { cityForCode } from '@/lib/airports'
import Icon from './Icon'

export interface RouteBarProps {
  result: SearchResult
  /** True only when the balances are the signed-in user's own connected
      programs. When false (signed out / mock / nothing connected) the
      "N programs" stat would be misleading, so it's hidden. */
  hasRealBalances?: boolean
  /** The search was filtered to nonstop-only — surfaced so the trip context
      confirms the filter actually applied (otherwise the only feedback is an
      absence: no connecting itineraries in the results below). */
  nonstop?: boolean
}

// A right-aligned stat: bold value over a small caption, so the summary carries
// real weight against the route codes instead of one thin run-on line.
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-end leading-none">
      <span className="hop-num text-[18px] font-semibold text-text">
        {value}
      </span>
      <span className="mt-[5px] text-[11px] uppercase tracking-[0.06em] text-text3">{label}</span>
    </div>
  )
}

// Editorial route line: origin/dest codes with a flight arc, balanced by a
// weighted stat group on the right. Pure read-out — every token informs the trip.
// A compact stacked variant covers small screens (below lg).
export default function RouteBar({ result, hasRealBalances = false, nonstop = false }: RouteBarProps) {
  const { from, to, adults } = result.params
  const oneWay = !result.params.return
  const ways = result.options.length
  const programs = result.balances.length
  // The "N programs" stat only reads honestly when the balances are the user's
  // own — otherwise it's an ambiguous count of mock/fallback programs.
  const showPrograms = hasRealBalances && programs > 0

  return (
    <>
      {/* COMPACT — small screens (below lg). Codes + a thin facts line so the
          trip context is never hidden on a phone. */}
      <div className="flex items-center justify-between gap-3 pt-4 lg:hidden">
        <div className="flex min-w-0 items-center gap-[10px]">
          <span className="font-display text-[16px] font-semibold tracking-[-0.01em] text-text">
            {from}
          </span>
          <span className="flex items-center text-brand">
            <Icon name="flight" size={18} className="rotate-90" />
          </span>
          <span className="font-display text-[16px] font-semibold tracking-[-0.01em] text-text">
            {to}
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5 text-[12px] text-text3">
          <span className="tabular-nums">
            {ways} {ways === 1 ? 'way' : 'ways'}
          </span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">
            {adults} {adults === 1 ? 'traveler' : 'travelers'}
          </span>
          <span aria-hidden>·</span>
          <span>{oneWay ? 'one way' : 'round trip'}</span>
          {nonstop ? (
            <>
              <span aria-hidden>·</span>
              <span className="font-semibold text-brand">nonstop only</span>
            </>
          ) : null}
        </div>
      </div>

      {/* FULL — wide screens (lg+). */}
      <div className="hidden items-center justify-between pt-4 lg:flex">
        <div className="flex items-center gap-[18px]">
          <div className="flex flex-col">
            <span className="font-display text-[19px] font-semibold tracking-[-0.01em] text-text">
              {from}
            </span>
            <span className="text-[13px] text-text2">
              {cityForCode(from)}
            </span>
          </div>
          <span className="flex items-center text-brand">
            <Icon name="flight" size={30} className="rotate-90" />
          </span>
          <div className="flex flex-col">
            <span className="font-display text-[19px] font-semibold tracking-[-0.01em] text-text">
              {to}
            </span>
            <span className="text-[13px] text-text2">
              {cityForCode(to)}
            </span>
          </div>
        </div>

        {/* right-side stat group — structured + weighted to balance the route codes */}
        <div className="flex items-center gap-7">
          <Stat value={String(ways)} label={ways === 1 ? 'way to fly' : 'ways to fly'} />
          <span className="h-9 w-px bg-hair" />
          <Stat value={String(adults)} label={adults === 1 ? 'traveler' : 'travelers'} />
          <span className="h-9 w-px bg-hair" />
          <Stat value={oneWay ? 'OW' : 'RT'} label={oneWay ? 'one way' : 'round trip'} />
          {nonstop ? (
            <>
              <span className="h-9 w-px bg-hair" />
              <Stat value="0" label="stops" />
            </>
          ) : null}
          {showPrograms ? (
            <>
              <span className="h-9 w-px bg-hair" />
              <Stat value={String(programs)} label={programs === 1 ? 'program' : 'programs'} />
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}
