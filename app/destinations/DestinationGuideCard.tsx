import Link from 'next/link'
import type { Destination } from '@/lib/destinations'
import { computeCpp } from '@/lib/destinations'
import { tier, formatValue } from '@/lib/cpp'
import type { CppTier } from '@/lib/types'
import type { DestImage } from '@/lib/images'

// cpp tier → chip palette. Mirrors DealCard's editorial mapping (strong = teal,
// fair = amber, low = neutral) but this card links into the destination GUIDE,
// not straight to /search — it's the inspiration grid's tile. Tokens only.
const CHIP: Record<CppTier, { bg: string; fg: string; bd: string }> = {
  green: { bg: 'var(--color-good-bg)', fg: 'var(--color-good)', bd: 'var(--color-brand-mint-deep)' },
  amber: { bg: 'var(--color-ok-bg)', fg: 'var(--color-ok)', bd: 'var(--color-gold-soft)' },
  muted: { bg: 'var(--color-sunk)', fg: 'var(--color-text3)', bd: 'var(--color-border)' },
}

const TIER_WORD: Record<CppTier, string> = {
  green: 'strong value',
  amber: 'fair value',
  muted: 'low value',
}

function compactMiles(n: number): string {
  const k = n / 1000
  return `${Number.isInteger(k) ? k : k.toFixed(1)}K`
}

function sentenceCase(s: string): string {
  const t = s.trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t
}

export default function DestinationGuideCard({
  dest,
  photo,
}: {
  dest: Destination
  photo?: DestImage | null
}) {
  const value = computeCpp(dest)
  const t = tier(value)
  const chip = CHIP[t]

  return (
    <Link
      href={`/destinations/${dest.code.toLowerCase()}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-paper transition-colors hover:border-brand"
    >
      {/* photo header */}
      <div className="relative aspect-[16/10] w-full overflow-hidden" style={{ background: 'var(--color-brand-deep)' }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.thumb}
            alt={photo.alt}
            loading="lazy"
            width={640}
            height={400}
            className="h-full w-full object-cover"
          />
        ) : (
          <div aria-hidden className="h-full w-full" style={{ background: 'var(--color-brand-deep)' }} />
        )}

        {photo && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(7,62,62,0.78) 0%, rgba(7,62,62,0.28) 38%, rgba(7,62,62,0) 64%)',
            }}
          />
        )}

        {value !== undefined && (
          <span
            className="absolute right-3 top-3 flex items-baseline gap-0.5 rounded-full border px-3 py-1.5"
            style={{ background: chip.bg, borderColor: chip.bd }}
            aria-label={`${formatValue(value)} — ${TIER_WORD[t]}`}
          >
            <span
              aria-hidden
              className="font-display text-[17px] font-semibold leading-none tabular-nums"
              style={{ color: chip.fg }}
            >
              {value.toFixed(1)}
            </span>
            <span aria-hidden className="text-[11px] font-semibold leading-none" style={{ color: chip.fg }}>
              ¢/pt
            </span>
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 flex items-end gap-2.5 p-4">
          <span className={`fi fi-${dest.countryCode} mb-1 h-[15px] w-[20px] flex-shrink-0 rounded-[2px]`} aria-hidden />
          <div className="min-w-0">
            <h3 className="truncate font-display text-[24px] font-semibold leading-tight tracking-[-0.01em] text-white">
              {dest.city}
            </h3>
            <p className="truncate text-[12px] font-semibold uppercase tracking-[var(--track-label)] text-white/85">
              {dest.country} · {dest.region}
            </p>
          </div>
        </div>
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[14px] leading-snug text-text2">{sentenceCase(dest.vibe)}</p>
        <div className="mt-4 flex items-center gap-x-4 border-t border-hair pt-4 text-[13px] text-text3">
          <span>
            <b className="font-semibold text-text2 tabular-nums">{compactMiles(dest.typicalAwardMiles)}</b> mi
          </span>
          <span aria-hidden>·</span>
          <span>
            <b className="font-semibold text-text2 tabular-nums">${Math.round(dest.typicalCashUSD).toLocaleString('en-US')}</b> cash
          </span>
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <span className="text-[14px] font-semibold text-text transition-colors group-hover:text-brand">
            Read the guide
          </span>
          <span aria-hidden className="flex-shrink-0 text-[15px] font-semibold text-text3 transition-colors group-hover:text-brand">
            →
          </span>
        </div>
      </div>
    </Link>
  )
}
