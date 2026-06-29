import type { SearchResult } from '@/lib/types'
import Icon from './Icon'

export interface RouteBarProps {
  result: SearchResult
}

const CITY_NAMES: Record<string, string> = {
  SFO: 'San Francisco',
  LAX: 'Los Angeles',
}

// A right-aligned stat: bold value over a small caption, so the summary carries
// real weight against the route codes instead of one thin run-on line.
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-end leading-none">
      <span className="font-display text-[18px] font-semibold tabular-nums tracking-[-0.01em] text-text">
        {value}
      </span>
      <span className="mt-[5px] text-[11px] uppercase tracking-[0.06em] text-text3">{label}</span>
    </div>
  )
}

// Editorial route line: origin/dest codes with a flight arc, balanced by a
// weighted stat group on the right. Pure read-out — every token informs the trip.
export default function RouteBar({ result }: RouteBarProps) {
  const { from, to, adults } = result.params
  const ways = result.options.length
  const programs = result.balances.length

  return (
    <div className="flex items-center justify-between pt-4">
      <div className="flex items-center gap-[18px]">
        <div className="flex flex-col">
          <span className="font-display text-[19px] font-semibold tracking-[-0.01em] text-text">
            {from}
          </span>
          <span className="text-[12px] uppercase tracking-[0.06em] text-text3">
            {CITY_NAMES[from] ?? from}
          </span>
        </div>
        <span className="flex items-center text-brand">
          <Icon name="flight" size={30} className="rotate-90" />
        </span>
        <div className="flex flex-col">
          <span className="font-display text-[19px] font-semibold tracking-[-0.01em] text-text">
            {to}
          </span>
          <span className="text-[12px] uppercase tracking-[0.06em] text-text3">
            {CITY_NAMES[to] ?? to}
          </span>
        </div>
      </div>

      {/* right-side stat group — structured + weighted to balance the route codes */}
      <div className="flex items-center gap-7">
        <Stat value={String(ways)} label={ways === 1 ? 'way to fly' : 'ways to fly'} />
        <span className="h-9 w-px bg-border" />
        <Stat value={String(adults)} label={adults === 1 ? 'traveler' : 'travelers'} />
        <span className="h-9 w-px bg-border" />
        <Stat value="RT" label="round trip" />
        <span className="h-9 w-px bg-border" />
        <Stat value={String(programs)} label="programs" />
      </div>
    </div>
  )
}
