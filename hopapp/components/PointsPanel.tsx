import type { Balance } from '@/lib/types'

export interface PointsPanelProps {
  balances: Balance[]
}

// Right-rail panel: head + balance rows + summed footer.
export default function PointsPanel({ balances }: PointsPanelProps) {
  const total = balances.reduce((sum, b) => sum + b.balance, 0)

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-hair px-[18px] py-3.5">
        <div className="text-[13.5px] font-bold">Your points</div>
        <div className="text-[11px] font-semibold text-text3">AwardWallet</div>
      </div>

      {balances.map((b) => (
        <div
          key={b.code + b.program}
          className="flex items-center justify-between border-b border-hair px-[18px] py-3 transition-colors last:border-b-0 hover:bg-sunk"
        >
          <div className="flex min-w-0 items-center gap-[11px]">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] border border-border-soft bg-sunk text-[11px] font-bold text-text2">
              {b.code}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-semibold">{b.program}</div>
              {b.status ? <div className="text-[11px] text-text3">{b.status}</div> : null}
            </div>
          </div>
          <div className="flex-shrink-0 text-sm font-bold tabular-nums">
            {b.balance.toLocaleString()}
          </div>
        </div>
      ))}

      <div className="flex justify-between border-t border-hair bg-sunk px-[18px] py-[13px] text-xs text-text2">
        <span>Total · {balances.length} programs</span>
        <b className="font-bold text-text">{total.toLocaleString()}</b>
      </div>
    </div>
  )
}
