import type { SearchResult } from '@/lib/types'
import { cityForCode } from '@/lib/airports'
import Stat from './ui/Stat'

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

// Editorial route line — desktop (lg+) only: origin/dest codes joined by a
// typographic arrow, balanced by a weighted stat group on the right. Pure
// read-out — every token informs the trip. Below lg this row does NOT render:
// the TopNav "Edit search" pill already carries the trip context (route ·
// dates · party), so a compact row here would duplicate the header.
export default function RouteBar({ result, hasRealBalances = false, nonstop = false }: RouteBarProps) {
  const { from, to, adults } = result.params
  const oneWay = !result.params.return
  const ways = result.options.length
  const programs = result.balances.length
  // The "N programs" stat only reads honestly when the balances are the user's
  // own — otherwise it's an ambiguous count of mock/fallback programs.
  const showPrograms = hasRealBalances && programs > 0

  return (
    // Full shell width — the same edges as the verdict hero below, so the
    // route codes sit flush left and the stat group flush right against the
    // content column (no narrower cap stranding the stats mid-air).
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
        <span aria-hidden className="font-display text-[22px] font-semibold leading-none text-brand">
          →
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
  )
}
