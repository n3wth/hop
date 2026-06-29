import type { Destination } from '@/lib/destinations'
import { computeCpp } from '@/lib/destinations'
import { tier } from '@/lib/cpp'
import type { CppTier } from '@/lib/types'

export interface DealCardProps {
  dest: Destination
  /** Origin IATA the deal is hooked from, e.g. 'SFO'. */
  fromCode: string
  /** Search dates to seed the CTA. */
  depart: string
  ret: string
  /** Rank in the feed (0 = the single best find). */
  rank: number
  /** Hero photo for this destination (null → solid brand-tint fallback). */
  photo?: { url: string; thumb: string; alt: string; credit: { name: string; link: string } } | null
}

// cpp tier → chip palette. Mirrors lib/cpp tiers but renders editorially:
// strong value reads teal, mid reads amber, weak/muted stays neutral.
const CHIP: Record<CppTier, { bg: string; fg: string; bd: string }> = {
  green: { bg: 'var(--color-good-bg)', fg: 'var(--color-good)', bd: 'var(--color-brand-mint-deep)' },
  amber: { bg: 'var(--color-ok-bg)', fg: 'var(--color-ok)', bd: 'var(--color-gold-soft)' },
  muted: { bg: 'var(--color-sunk)', fg: 'var(--color-text3)', bd: 'var(--color-border)' },
}

// Plain-language strength word per tier, for the chip's screen-reader label.
const TIER_WORD: Record<CppTier, string> = {
  green: 'strong value',
  amber: 'fair value',
  muted: 'low value',
}

// 37500 → "37.5K", 40000 → "40K". Compact miles for the headline figure.
function compactMiles(n: number): string {
  const k = n / 1000
  return `${Number.isInteger(k) ? k : k.toFixed(1)}K`
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

// One standout award redemption, rendered as a travel-magazine card you'd want
// to chase: a real destination photo up top (with a legibility scrim + the city
// and its flag overlaid), then the economics — cpp value, miles, cash compare,
// and the program that books it. Flat + on-system: no card shadow/lift; hover
// gently scales the IMAGE inside its clipped frame and tints the border.
export default function DealCard({ dest, fromCode, depart, ret, rank, photo }: DealCardProps) {
  const value = computeCpp(dest)
  const t = tier(value)
  const chip = CHIP[t]
  // "Best find" must be earned: the #1-ranked card only carries the badge when
  // it actually clears the strong-value bar (rank is by cpp desc, so rank 0 is
  // the highest cpp in the feed — but if even the top card is only fair, don't
  // overclaim). Factual, not decorative.
  const isTopFind = rank === 0 && t === 'green'

  const href =
    `/search?from=${fromCode}&to=${dest.code}` +
    `&depart=${depart}&ret=${ret}&adults=1`

  // Cash value of the miles at the computed cpp — the "what you'd otherwise pay".
  const cashCompare = money(dest.typicalCashUSD)

  return (
    <a
      href={href}
      className="group flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-paper transition-colors hover:border-brand"
    >
      {/* ── photo header ─────────────────────────────────────────────────── */}
      <div
        className="relative aspect-[16/10] w-full overflow-hidden"
        style={{ background: 'var(--color-brand-deep)' }}
      >
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
          // Solid brand-deep fallback — never a broken image; keeps the white
          // city + flag overlay legible.
          <div aria-hidden className="h-full w-full" style={{ background: 'var(--color-brand-deep)' }} />
        )}

        {/* legibility scrim (allowed: image overlay, not a UI surface). Only over
            a real photo — the solid brand-deep fallback already reads white, so a
            second dark wash there is redundant and muddies the tile. */}
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

        {/* best-find ribbon — light surface w/ brand text: reads on photo + on
            the dark fallback, and stays distinct from the gold cpp chip */}
        {isTopFind && (
          <span
            className="absolute left-3 top-3 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ background: 'var(--color-paper)', color: 'var(--color-brand)' }}
          >
            Best find
          </span>
        )}

        {/* value chip — cents per point, color-coded by tier so amber/muted read
            honestly. The visible figure is decorative; the spoken label carries
            the full meaning. */}
        {value !== undefined && (
          <span
            className="absolute right-3 top-3 flex items-baseline gap-0.5 rounded-full border px-3 py-1.5"
            style={{ background: chip.bg, borderColor: chip.bd }}
            aria-label={`${value.toFixed(1)} cents per point — ${TIER_WORD[t]}`}
          >
            <span
              aria-hidden
              className="font-display text-[17px] font-semibold leading-none tabular-nums"
              style={{ color: chip.fg }}
            >
              {value.toFixed(1)}
            </span>
            <span
              aria-hidden
              className="text-[11px] font-semibold leading-none"
              style={{ color: chip.fg }}
            >
              ¢/pt
            </span>
          </span>
        )}

        {/* city + flag overlaid bottom-left */}
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-2.5 p-4">
          <span
            className={`fi fi-${dest.countryCode} mb-1 h-[15px] w-[20px] flex-shrink-0 rounded-[2px]`}
            aria-hidden
          />
          <div className="min-w-0">
            <h3 className="truncate font-display text-[24px] font-semibold leading-tight tracking-[-0.01em] text-white">
              {dest.city}
            </h3>
            <p className="truncate text-[12px] font-semibold uppercase tracking-[0.08em] text-white/85">
              {dest.country}
            </p>
          </div>
        </div>
      </div>

      {/* ── body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[14px] leading-snug text-text2">{dest.vibe}</p>

        {/* the economics: miles needed, cash you'd skip, best program */}
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3.5 border-t border-hair pt-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text3">Miles</div>
            <div className="mt-1 font-display text-[19px] font-semibold leading-none tabular-nums text-text">
              {compactMiles(dest.typicalAwardMiles)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text3">vs. cash</div>
            <div className="mt-1 font-display text-[19px] font-semibold leading-none tabular-nums text-text">
              {cashCompare}
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text3">Best via</div>
            <div className="mt-1 truncate text-[14px] font-semibold leading-tight text-brand">{dest.bestProgram}</div>
          </div>
        </div>

        {/* CTA — single confident action; arrow nudges via color on hover */}
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <span className="text-[14px] font-semibold text-text transition-colors group-hover:text-brand">
            from {fromCode} · See the math
          </span>
          <span
            aria-hidden
            className="flex-shrink-0 text-[15px] font-semibold text-text3 transition-colors group-hover:text-brand"
          >
            →
          </span>
        </div>

        {/* photo credit — Unsplash API terms (plain text; cannot nest <a> in the
            card link. The /deals footer carries the linked Unsplash attribution.) */}
        {photo && (
          <p className="mt-3 text-[10px] text-text3">
            Photo: {photo.credit.name} / Unsplash
          </p>
        )}
      </div>
    </a>
  )
}
