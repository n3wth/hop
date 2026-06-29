import type { Destination } from '@/lib/destinations'
import { computeCpp } from '@/lib/destinations'
import { tier } from '@/lib/cpp'

export interface DealCardProps {
  dest: Destination
  /** Origin IATA the deal is hooked from, e.g. 'SFO'. */
  fromCode: string
  /** Search dates to seed the CTA. */
  depart: string
  ret: string
  /** Rank in the feed (0 = the single best find). */
  rank: number
}

// cpp tier → chip palette. Mirrors lib/cpp tiers but renders editorially:
// strong value reads teal, mid reads amber, weak/muted stays neutral.
const CHIP: Record<string, { bg: string; fg: string; bd: string }> = {
  green: { bg: 'var(--color-good-bg)', fg: 'var(--color-good)', bd: 'var(--color-brand-mint-deep)' },
  amber: { bg: 'var(--color-ok-bg)', fg: 'var(--color-ok)', bd: 'var(--color-gold-soft)' },
  muted: { bg: 'var(--color-sunk)', fg: 'var(--color-text3)', bd: 'var(--color-border)' },
}

// 37500 → "37.5K", 40000 → "40K". Compact miles for the headline figure.
function compactMiles(n: number): string {
  const k = n / 1000
  return `${Number.isInteger(k) ? k : k.toFixed(1)}K`
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

// One standout award redemption, rendered as a card you'd want to chase.
// Flat, on-system: no shadow/gradient, hover is color-only, no vertical motion.
export default function DealCard({ dest, fromCode, depart, ret, rank }: DealCardProps) {
  const value = computeCpp(dest)
  const t = tier(value)
  const chip = CHIP[t]
  const isTopFind = rank === 0

  const href =
    `/search?from=${fromCode}&to=${dest.code}` +
    `&depart=${depart}&ret=${ret}&adults=1`

  // Cash value of the miles at the computed cpp — the "what you'd otherwise pay".
  const cashCompare = money(dest.typicalCashUSD)

  return (
    <a
      href={href}
      className="group flex flex-col rounded-[var(--radius-lg)] border border-border bg-paper p-5 transition-colors hover:border-brand sm:p-6"
    >
      {/* top row: place + the value chip */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isTopFind && (
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]"
                style={{
                  background: 'var(--color-gold-soft)',
                  color: 'var(--color-amber)',
                  borderColor: 'var(--color-gold)',
                }}
              >
                Best find
              </span>
            )}
            <span className="truncate text-[12px] font-semibold uppercase tracking-[0.08em] text-text3">
              {dest.country}
            </span>
          </div>
          <h3 className="mt-1 truncate font-display text-[24px] font-bold leading-tight text-text">
            {dest.city}
          </h3>
        </div>

        <span
          className="flex flex-shrink-0 flex-col items-end rounded-[14px] border px-3 py-2 text-right"
          style={{ background: chip.bg, borderColor: chip.bd }}
          title="cents per point — how much value each mile pulls"
        >
          <span className="font-display text-[22px] font-bold leading-none tabular-nums" style={{ color: chip.fg }}>
            {value?.toFixed(1)}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: chip.fg }}>
            cents / pt
          </span>
        </span>
      </div>

      {/* vibe + route hook */}
      <p className="mt-3 text-[14px] leading-snug text-text2">{dest.vibe}</p>
      <p className="mt-1 text-[13px] font-medium text-text3">from {fromCode}</p>

      {/* the economics: miles needed, cash you'd skip, best program */}
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-hair pt-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-text3">Miles</div>
          <div className="mt-0.5 font-display text-[18px] font-bold tabular-nums text-text">
            {compactMiles(dest.typicalAwardMiles)}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-text3">vs. cash</div>
          <div className="mt-0.5 font-display text-[18px] font-bold tabular-nums text-text">
            {cashCompare}
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-text3">Book it with</div>
          <div className="mt-0.5 truncate text-[14px] font-semibold text-brand">{dest.bestProgram}</div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-5 flex items-center justify-between">
        <span className="text-[14px] font-bold text-text transition-colors group-hover:text-brand">
          See the math
        </span>
        <span
          aria-hidden
          className="text-[15px] font-bold text-text3 transition-colors group-hover:text-brand"
        >
          Search this →
        </span>
      </div>
    </a>
  )
}
