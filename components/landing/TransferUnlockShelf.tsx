import Link from 'next/link'
import { DestinationCard } from '@/components/landing/DestinationGrid'
import { imageQuery } from '@/lib/destinations'
import { unlockedByTransfer } from '@/lib/verdict-shelves'
import { destinationImages } from '@/lib/images'
import type { Balance } from '@/lib/types'

// ── UNLOCKED BY TRANSFER ─────────────────────────────────────────────────────
// Trips the member can ONLY reach by moving points across a verified transfer
// edge (lib/transfers#effectiveBalanceFor) — never a destination already
// bookable with a direct hold, and never one already shown in "Within reach"
// (excludeCodes). Renders nothing when the shelf would be empty: no held
// transferable currency, or every transfer-reachable trip is already shown
// above.
export default async function TransferUnlockShelf({
  balances,
  excludeCodes,
  origin,
}: {
  balances: Balance[]
  /** Destination codes already rendered in "Within reach" — never repeat one here. */
  excludeCodes: Iterable<string>
  origin: string
}) {
  const items = unlockedByTransfer(balances, excludeCodes).slice(0, 4)
  if (items.length === 0) return null

  const photos = await destinationImages(items.map((i) => imageQuery(i.destination)))

  return (
    <section
      className="hop-rise"
      style={{ ['--hop-delay' as string]: '160ms' }}
      aria-label="Unlocked by transfer"
    >
      <div className="flex flex-col gap-2 sm:max-w-[60ch]">
        <span className="text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand">
          Unlocked by transfer
        </span>
        <h2 className="text-balance font-display text-[26px] font-semibold leading-[1.08] tracking-[-0.02em] text-text sm:text-[34px]">
          One transfer away.
        </h2>
        <p className="text-[15px] leading-[1.55] text-text2">
          Not reachable with what you hold directly — but a verified transfer
          from a bank currency you already have gets you there.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <DestinationCard
            key={item.destination.code}
            d={item.destination}
            origin={origin}
            photo={photos[imageQuery(item.destination)]}
            viaBadge={{ source: item.source, ratio: item.ratio }}
          />
        ))}
      </div>

      <Link
        href={`/ask?q=${encodeURIComponent('Which of my destinations need a transfer, and how do I do it?')}`}
        className="mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand transition-colors hover:text-brand-deep"
      >
        Ask hop which of these use a transfer
        <span aria-hidden className="text-[15px] leading-none">→</span>
      </Link>
    </section>
  )
}
