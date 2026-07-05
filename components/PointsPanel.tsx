import Link from 'next/link'
import type { Balance, FlightOption } from '@/lib/types'
import { walletValue, WALLET_VALUE_CAVEAT } from '@/lib/valuations'
import BrandIcon from './BrandIcon'

export interface PointsPanelProps {
  balances: Balance[]
  /** The pick, so we can flag the program being spent and how much. */
  pick?: FlightOption
  /** True when these are NOT the viewer's own connected balances (signed out,
      or MOCK's demo fallback) — labels the panel so specific-looking numbers
      (six figures, real program names) never get mistaken for the visitor's
      own account before they've signed in. */
  isExample?: boolean
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return n.toLocaleString('en-US')
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
export default function PointsPanel({ balances, pick, isExample = false }: PointsPanelProps) {
  const total = balances.reduce((sum, b) => sum + b.balance, 0)
  const max = balances.reduce((m, b) => Math.max(m, b.balance), 0) || 1
  const spend = pick?.miles
  const worth = walletValue(balances)

  // No programs yet → don't show a fake "0 across 0 programs" wallet. Invite the
  // user to add their points so hop can value redemptions against what they hold.
  if (balances.length === 0) {
    return (
      <section
        className="overflow-hidden rounded-[22px] px-5 py-7 text-hero-cream sm:px-[30px]"
        style={{ background: 'var(--color-brand-ink)' }}
      >
        <h2 className="text-[13px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-wallet-active">
          Your points
        </h2>
        <p className="mt-2 max-w-[40ch] text-[14px] leading-[1.55] text-hero-body">
          Add your loyalty programs and hop will tell you which redemptions your
          points actually unlock — and whether to book with miles or cash.
        </p>
        <Link
          href="/account"
          className="mt-4 inline-flex items-center gap-2 rounded-[12px] bg-white px-5 py-3 text-[14px] font-semibold text-brand-ink transition-colors hover:bg-hero-cream"
        >
          Add your programs
          <span aria-hidden className="text-[15px] leading-none">→</span>
        </Link>
      </section>
    )
  }

  return (
    // Full shell width, same as every other search-page section (a narrower
    // card read as a layout bug next to them). Row legibility is preserved by
    // the grid instead: the LABEL column is capped and the VALUE BAR flexes,
    // so extra width lengthens the bars rather than stranding labels across
    // dead air (the problem the old --container-app cap was papering over).
    <section
      className="overflow-hidden rounded-[22px] text-hero-cream"
      style={{ background: 'var(--color-brand-ink)' }}
    >
      {/* Example-data label — only when these balances aren't the viewer's own
          (signed out, or MOCK's demo fallback). Loud enough that a specific,
          real-looking six-figure balance table never reads as "my account
          somehow got connected already" or "this site is faking data" —
          two independent first-time-visitor complaints this fixes. Real
          balances get no header, same as before. */}
      {isExample ? (
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3 sm:px-[30px]">
          <span className="rounded-full bg-white/10 px-2.5 py-[3px] text-[10px] font-semibold uppercase tracking-[var(--track-tag)] text-hero-label">
            Example
          </span>
          <span className="text-[12.5px] text-hero-label">
            Sign in to see your own balances here.
          </span>
        </div>
      ) : null}
      <div className="px-4 pt-[14px] sm:px-[30px] sm:pt-[18px]">
        {balances.map((b, i) => {
          const active = isActive(b, pick)
          const pct = Math.max(5, Math.round((b.balance / max) * 100))
          return (
            <div
              key={b.code + b.program}
              className={`grid items-center gap-3 py-[16px] sm:gap-5 sm:py-[18px] [grid-template-columns:40px_1fr_auto] lg:[grid-template-columns:46px_minmax(0,420px)_1fr_116px] ${i > 0 ? 'border-t border-white/[0.07]' : ''}`}
            >
              <BrandIcon code={b.code} name={b.program} size={40} surface="dark" />

              <div className="min-w-0">
                <div
                  className={`truncate text-[13px] font-medium sm:text-[14px] ${
                    active ? 'text-wallet-active' : 'text-hero-cream'
                  }`}
                >
                  {b.program}
                </div>
                <div className="mt-[2px] truncate text-[12px] text-hero-label">
                  {active && spend != null ? `Using ${spend.toLocaleString('en-US')} here` : b.status}
                </div>
              </div>

              {/* value bar — desktop only (no room on mobile). Grows from 0 to its
                  share on load (hop-bar), staggered down the list. Inactive bars
                  stay quiet so the active mint bar reads as the one being spent. */}
              <div className="hidden h-[8px] overflow-hidden rounded-full bg-white/[0.08] lg:block">
                <span
                  className="hop-bar block h-full rounded-full"
                  style={{
                    ['--hop-bar-w' as string]: `${pct}%`,
                    ['--hop-delay' as string]: `${160 + i * 70}ms`,
                    background: active ? 'var(--color-wallet-active)' : 'rgba(255,255,255,0.26)',
                  }}
                />
              </div>

              <div className="hop-num text-right text-[15px] font-semibold text-white sm:text-[16px]">
                {b.balance.toLocaleString('en-US')}
              </div>
            </div>
          )
        })}
      </div>

      {/* footer total — with a low-key sync line that earns its place */}
      <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.03] px-4 py-[16px] sm:px-[30px] sm:py-[18px]">
        <span className="text-[13px] text-hero-label">
          {total.toLocaleString('en-US')} across {balances.length}{' '}
          {balances.length === 1 ? 'program' : 'programs'}
        </span>
        <span className="flex items-baseline gap-2">
          <span className="hop-price text-[20px] text-white">
            {compact(total)}
          </span>
          {worth > 0 ? (
            <span
              className="text-[13px] text-[#9fb5b0]"
              title={WALLET_VALUE_CAVEAT}
            >
              ~${compact(worth)}
            </span>
          ) : null}
        </span>
      </div>
    </section>
  )
}
