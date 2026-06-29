import type { Balance, FlightOption } from '@/lib/types'
import BrandIcon from './BrandIcon'

export interface PointsPanelProps {
  balances: Balance[]
  /** The pick, so we can flag the program being spent and how much. */
  pick?: FlightOption
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return n.toLocaleString()
}

// Does this balance fund the pick? Tolerant program/code match.
function isActive(b: Balance, pick?: FlightOption): boolean {
  if (!pick) return false
  const prog = pick.program?.toLowerCase() ?? ''
  const name = pick.airline.toLowerCase()
  const bp = b.program.toLowerCase()
  return (
    (!!prog && (bp.includes(prog) || prog.includes(bp))) ||
    bp.includes(name.split(' ')[0]) ||
    b.code === pick.airlineCode
  )
}

// Dark "Your points" wallet — a clean, aligned list: brand chip + program/status
// (left) and balance (right column, tabular-nums). A value bar under each row
// makes the relative size legible. Flat fills, real program marks.
export default function PointsPanel({ balances, pick }: PointsPanelProps) {
  const total = balances.reduce((sum, b) => sum + b.balance, 0)
  const max = balances.reduce((m, b) => Math.max(m, b.balance), 0) || 1
  const spend = pick?.miles

  return (
    <section className="overflow-hidden rounded-[22px] text-[#eef3f1]" style={{ background: 'var(--color-text)' }}>
      {/* no restating header — the balances + total speak for themselves */}
      <div className="px-[30px] pt-[10px]">
        {balances.map((b, i) => {
          const active = isActive(b, pick)
          const pct = Math.max(5, Math.round((b.balance / max) * 100))
          return (
            <div
              key={b.code + b.program}
              className={`grid items-center gap-5 py-[18px] ${i > 0 ? 'border-t border-white/[0.07]' : ''}`}
              style={{ gridTemplateColumns: '46px 1fr 200px 116px' }}
            >
              <BrandIcon code={b.code} name={b.program} size={46} surface="dark" />

              <div className="min-w-0">
                <div
                  className="truncate text-[14px] font-medium"
                  style={{ color: active ? '#7be0c6' : '#e6edeb' }}
                >
                  {b.program}
                </div>
                <div className="mt-[2px] text-[12px] text-[#8aa39e]">
                  {active && spend != null ? `Using ${spend.toLocaleString()} here` : b.status}
                </div>
              </div>

              {/* value bar */}
              <div className="h-[8px] overflow-hidden rounded-full bg-white/10">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: active ? 'var(--color-mint-bright)' : 'rgba(255,255,255,0.32)',
                  }}
                />
              </div>

              <div className="text-right font-display text-[16px] font-semibold tabular-nums text-white">
                {b.balance.toLocaleString()}
              </div>
            </div>
          )
        })}
      </div>

      {/* footer total — with a low-key sync line that earns its place */}
      <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.03] px-[30px] py-[18px]">
        <span className="text-[13px] text-[#9fb5b0]">
          {total.toLocaleString()} across {balances.length} programs
          <span className="ml-2 text-[11px] text-[#6f8782]">AwardWallet · updated today</span>
        </span>
        <span className="font-display text-[20px] font-semibold tabular-nums text-white">
          {compact(total)}
        </span>
      </div>
    </section>
  )
}
