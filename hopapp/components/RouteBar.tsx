import type { SearchResult } from '@/lib/types'
import Icon from './Icon'

export interface RouteBarProps {
  result: SearchResult
}

const CITY_NAMES: Record<string, string> = {
  SFO: 'San Francisco',
  LAX: 'Los Angeles',
}

// Editorial route line: origin/dest codes with a flight arc, plus a one-line
// factual summary of the search. Pure read-out — every token informs the trip.
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

      <div className="text-[13px] tracking-[0.04em] text-text2">
        <b className="font-semibold text-text">
          {ways} {ways === 1 ? 'way' : 'ways'} to fly
        </b>{' '}
        · {adults} {adults === 1 ? 'adult' : 'adults'} · round trip · scanned {programs} programs
      </div>
    </div>
  )
}
