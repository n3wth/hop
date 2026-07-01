import { ledgerDream, reachableDreamCount } from '@/lib/ledger-dream'
import { resolveDreamSession } from '@/lib/dream-server'
import { toDreamCardData } from '@/lib/dream-view'
import { destinationImage } from '@/lib/images'
import { templatedBlurb } from '@/lib/dream-narration'
import LedgerDreamCard from '@/components/LedgerDreamCard'

// THE LEDGER DREAM module for the signed-in home — a server component that asks
// the ENGINE for the user's single most aspirational-yet-affordable redemption,
// resolves its hero photo, and hands a fully-grounded card to the client (which
// streams the AI narration and handles "Dream me another"). Inspiration generated
// from their wealth, not filtered by it.
//
// Self-contained: resolves its own session, so the home page can drop it in with
// no props. Renders nothing only if the engine somehow yields no destination
// (it always returns one, even signed-out), so this is effectively always shown.
export default async function LedgerDream() {
  const { balances, origin } = await resolveDreamSession()
  const dream = ledgerDream(balances, 0)
  const variantCount = Math.max(1, reachableDreamCount(balances))

  // Hero photo (cached, day-long revalidate). Null → brand-fallback tile.
  const photo = await destinationImage(dream.imageQuery).catch(() => null)
  // Server templated blurb seeds the card so it's never blank before the AI
  // narration streams in client-side.
  const card = toDreamCardData(dream, photo, templatedBlurb(dream), origin)

  return (
    <section
      className="hop-rise"
      style={{ ['--hop-delay' as string]: '120ms' }}
      aria-label="Your dream of the week"
    >
      <div className="mb-5 flex flex-col gap-2 sm:max-w-[60ch]">
        <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brand">
          The Ledger Dream
        </span>
        <h2 className="font-display text-[26px] font-semibold leading-[1.08] tracking-[-0.02em] text-text sm:text-[34px]">
          {card.saveToward ? 'A dream worth saving toward.' : 'The trip your points already bought.'}
        </h2>
        <p className="text-[15px] leading-[1.55] text-text2">
          {card.saveToward
            ? 'You\'re closer than you think. Here\'s where your points are headed — and the exact path that gets you there.'
            : 'Written from your real points stack — not filtered by it. Every number below is hop\'s engine, not a guess.'}
        </p>
      </div>

      <LedgerDreamCard dream={card} variantCount={variantCount} />
    </section>
  )
}
