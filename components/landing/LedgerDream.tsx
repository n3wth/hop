import Link from 'next/link'
import { reachableDreamCount, type LedgerDream as LedgerDreamData } from '@/lib/ledger-dream'
import { dreamRotationSlots } from '@/lib/verdict-shelves'
import { resolveDreamSession } from '@/lib/dream-server'
import { toDreamCardData, dreamSearchHref } from '@/lib/dream-view'
import { destinationImage, destinationImages, type DestImage } from '@/lib/images'
import { templatedBlurb } from '@/lib/dream-narration'
import LedgerDreamCard from '@/components/LedgerDreamCard'

function compactMiles(n: number): string {
  const k = n / 1000
  return `${Number.isInteger(k) ? k : k.toFixed(1)}K`
}

// A compact sibling dream card — no AI narration (that stays exclusive to the
// larger slot-0 hero card, which is the only one that costs any AI on a
// passive view). Shows the same engine numbers + the transparent proof.path
// so the row still teaches, just without the cinematic treatment.
function DreamMiniCard({
  dream,
  photo,
  origin,
}: {
  dream: LedgerDreamData
  photo: DestImage | null
  origin: string
}) {
  const d = dream.destination
  return (
    <Link
      href={dreamSearchHref(d.code, origin)}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-paper transition-colors duration-200 ease-[var(--ease-premium)] hover:border-brand-mint-deep"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden" style={{ background: 'var(--color-brand-deep)' }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.thumb} alt={photo.alt} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div aria-hidden className="h-full w-full" style={{ background: 'var(--color-brand-deep)' }} />
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(7,62,62,0.74) 0%, rgba(7,62,62,0.18) 42%, rgba(7,62,62,0) 66%)' }}
        />
        {dream.cpp !== undefined ? (
          <span
            className="absolute right-2.5 top-2.5 rounded-full px-2 py-1 text-[11px] font-semibold text-good"
            style={{ background: 'var(--color-good-bg)' }}
          >
            {dream.cpp.toFixed(1)}¢/pt
          </span>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-3">
          <span className={`fi fi-${d.countryCode} mb-1 h-[13px] w-[18px] flex-shrink-0 rounded-[2px]`} aria-hidden />
          <h3 className="truncate font-display text-[17px] font-semibold leading-[1.1] tracking-[-0.01em] text-white">
            {d.city}
          </h3>
        </div>
      </div>
      <div className="flex flex-col gap-1 p-3">
        <span className="text-[11.5px] font-medium text-text3">{compactMiles(dream.milesNeeded)} mi</span>
        <span className="truncate text-[12px] font-semibold text-text2">{dream.proof.path}</span>
      </div>
    </Link>
  )
}

// THE LEDGER DREAM module for the signed-in home — a server component that asks
// the ENGINE for up to MAX_DREAM_SLOTS distinct aspirational-yet-affordable
// redemptions (lib/verdict-shelves#dreamRotationSlots, walking
// lib/ledger-dream#ledgerDream over reachableDreamCount) and renders them as a
// row: the FIRST slot larger — the existing cinematic card, which streams the
// AI narration and handles "Dream me another" — the rest as compact cards that
// still show the engine's transparent proof.path. With nothing reachable there
// is only ever the one save-toward fallback dream, so the row collapses to a
// single (larger) slot.
//
// Self-contained: resolves its own session, so the home page can drop it in
// with no props. Renders nothing only if the engine somehow yields no
// destination (it always returns one, even signed-out), so this is
// effectively always shown.
export default async function LedgerDream() {
  const { balances, origin } = await resolveDreamSession()
  const slots = dreamRotationSlots(balances)
  const [hero, ...rest] = slots
  const variantCount = Math.max(1, reachableDreamCount(balances))

  // Hero photo (cached, day-long revalidate). Null → brand-fallback tile.
  const [heroPhoto, restPhotos] = await Promise.all([
    destinationImage(hero.imageQuery).catch(() => null),
    destinationImages(rest.map((d) => d.imageQuery)),
  ])
  // Server templated blurb seeds the card so it's never blank before the AI
  // narration streams in client-side.
  const card = toDreamCardData(hero, heroPhoto, templatedBlurb(hero), origin)

  return (
    <section
      className="hop-rise"
      style={{ ['--hop-delay' as string]: '120ms' }}
      aria-label="Your dream of the week"
    >
      <div className="mb-5 flex flex-col gap-2 sm:max-w-[60ch]">
        <span className="text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand">
          The Ledger Dream
        </span>
        <h2 className="text-balance font-display text-[26px] font-semibold leading-[1.08] tracking-[-0.02em] text-text sm:text-[34px]">
          {card.saveToward ? 'A dream worth saving toward.' : 'The trip your points already bought.'}
        </h2>
        <p className="text-[15px] leading-[1.55] text-text2">
          {card.saveToward
            ? 'You\'re closer than you think. Here\'s where your points are headed — and the exact path that gets you there.'
            : 'Written from your real points stack — not filtered by it. Every number below is hop\'s engine, not a guess.'}
        </p>
      </div>

      <LedgerDreamCard dream={card} variantCount={variantCount} />

      {rest.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {rest.map((dream) => (
            <DreamMiniCard
              key={dream.destination.code}
              dream={dream}
              photo={restPhotos[dream.imageQuery] ?? null}
              origin={origin}
            />
          ))}
        </div>
      ) : null}

      <Link
        href={`/ask?q=${encodeURIComponent('Which of my dream trips can I actually afford right now?')}`}
        className="mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand transition-colors hover:text-brand-deep"
      >
        Ask hop about these dreams
        <span aria-hidden className="text-[15px] leading-none">→</span>
      </Link>
    </section>
  )
}
