import Link from 'next/link'
import Icon from '@/components/Icon'
import CountUp from '@/components/CountUp'
import HeroSearch from '@/components/landing/HeroSearch'
import DestinationGrid from '@/components/landing/DestinationGrid'
import AgentComposer from '@/components/landing/AgentComposer'
import type { ConciergeHeroPhoto } from '@/components/ConciergeHero'
import LedgerDream from '@/components/landing/LedgerDream'
import HomeAirportPrompt from '@/components/HomeAirportPrompt'
import {
  affordableWith,
  topValue,
  imageQuery,
  computeCpp,
} from '@/lib/destinations'
import { withoutAvoided, EMPTY_MEMORY_CONTEXT, type MemoryContext } from '@/lib/memory-context'
import { destinationImages } from '@/lib/images'
import { WALLET_VALUE_CAVEAT } from '@/lib/valuations'
import type { SearchState } from '@/components/SearchBar'

// The personalized home for a signed-in member. NOT the marketing page — the
// AGENT is the front door: it leads with a prominent "talk to hop" composer that
// opens the conversation in /ask. Below that, the member's synced points, then
// the aspirational destinations grid, then search as a secondary fast-path and
// program management. Flat, warm, on-brand.
export default async function SignedInHome({
  first,
  programs,
  totalPoints,
  pointsWorth = 0,
  seed,
  hasHomeAirport = true,
  heroBackdrop,
  memory = EMPTY_MEMORY_CONTEXT,
}: {
  first?: string
  programs: number
  totalPoints: number
  /** Engine-computed USD value of the whole wallet (lib/valuations#walletValue). */
  pointsWorth?: number
  seed: SearchState
  hasHomeAirport?: boolean
  /** Photographic backdrop for the agent hero, matching the /ask landing. */
  heroBackdrop?: ConciergeHeroPhoto
  /** Unified memory (lib/memory-context) — drops the member's stated "avoid"
      places from the feed. Defaults to the empty context → today's exact behavior. */
  memory?: MemoryContext
}) {
  // Personalized to the member's real balance; best value first. If they're
  // light on points (or programs failed), fall back to the universally great
  // redemptions so the module is never empty.
  const affordable = affordableWith(totalPoints)
  const personalized = affordable.length >= 4
  // M5 — compounding: drop the member's STATED "avoid" places from this
  // engine-ranked module. Value order is PRESERVED (hop leads with value; loved
  // places shape the concierge's words, not this ranking), so "sorted by value
  // per point" below stays true. A no-op when the profile has no avoided places
  // → today's exact feed.
  const base = personalized ? affordable : topValue(24)
  const picks = withoutAvoided(base, memory.avoided).slice(0, 8)
  const photos = await destinationImages(picks.map((d) => imageQuery(d)))

  // A single headline stat for the summary panel: the best-value trip the member
  // can reach right now (or the best dream if they're light on points). Order is
  // preserved above, so picks[0] is the true cpp-max of the shown set.
  const topPick = picks[0]
  const topCpp = topPick ? computeCpp(topPick) : undefined

  return (
    <div className="flex flex-col gap-14 pt-4 sm:gap-16 sm:pt-6 lg:gap-20">
      {/* ── THE AGENT — the front door ───────────────────────────────────── */}
      {/* Talking to hop is the primary action: a prominent greeting + composer
          that opens the conversation in /ask. Everything else is secondary. */}
      <section
        className="hop-rise"
        style={{ ['--hop-delay' as string]: '40ms' }}
      >
        <AgentComposer
          variant="in"
          first={first}
          totalPoints={programs > 0 ? totalPoints : undefined}
          backdrop={heroBackdrop}
        />
      </section>

      {/* ── YOUR POINTS — compact synced state ───────────────────────────── */}
      {/* Flex, not a 1fr/360px grid: a grid track stretches the text column to
          absorb the FULL remaining shell width, so the short header+line sits
          capped at its measure while the card gets pinned to the far edge —
          a wide dead gap in between. Flex + a measure cap on the text keeps
          the card right next to the copy; any leftover space falls after the
          card instead of splitting the two apart. */}
      <section
        className="hop-rise flex flex-col items-center gap-8 lg:flex-row lg:gap-16"
        style={{ ['--hop-delay' as string]: '80ms' }}
      >
        {/* A short, secondary section header — the agent above already greeted
            the member by name, so we don't repeat "Welcome back". */}
        <div className="w-full lg:max-w-[46ch]">
          <h2 className="font-display text-[26px] font-semibold leading-[1.04] tracking-[-0.02em] text-text sm:text-[34px]">
            {programs > 0 ? 'Your points, working.' : 'Get started.'}
          </h2>
          <p className="mt-3 text-[15px] leading-[1.55] text-text2 sm:text-[17px]">
            {programs > 0
              ? 'What each balance is really worth — and whether to book with points or cash.'
              : 'Add your loyalty programs and hop will show you what each balance is really worth — and whether to book with points or cash.'}
          </p>
        </div>

        {/* Summary panel — anchors the right column.
            Flat: a bordered paper card with a sunk stat row, no shadow/lift. */}
        {programs > 0 ? (
          <aside className="flex w-full flex-col rounded-[var(--radius-lg)] border border-border bg-paper p-6 lg:w-[360px] lg:flex-shrink-0 lg:rounded-[var(--radius-hero)]">
            <span className="text-[11.5px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand">
              Your points
            </span>
            {/* The wallet total gets the panel's one moment: it counts up on
                arrival (CountUp is reduced-motion-safe — instant final value).
                The engine computed both figures; this only ticks to them. */}
            <p className="hop-price mt-2 text-[40px] leading-[1] text-text sm:text-[46px]">
              <CountUp value={totalPoints} />
            </p>
            <p className="mt-1 text-[13.5px] leading-[1.5] text-text2">
              across {programs} {programs === 1 ? 'program' : 'programs'}
            </p>
            {pointsWorth > 0 ? (
              <p
                className="mt-0.5 text-[13.5px] leading-[1.5] text-text3"
                title={WALLET_VALUE_CAVEAT}
              >
                worth ~<CountUp value={pointsWorth} format="usd" delayMs={260} /> at typical
                redemption value
              </p>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-hair bg-hair">
              <div className="bg-sunk p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-text3">
                  {personalized ? 'In reach' : 'Worth saving for'}
                </p>
                <p className="hop-price mt-1 text-[22px] leading-none text-text">
                  {personalized ? affordable.length : picks.length}
                </p>
                <p className="mt-1 text-[12px] leading-[1.4] text-text2">
                  {personalized ? 'trips to reach for' : 'dream trips'}
                </p>
              </div>
              <div className="bg-sunk p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-text3">
                  Best value
                </p>
                <p className="hop-price mt-1 text-[22px] leading-none text-text">
                  {topCpp !== undefined ? `${topCpp.toFixed(1)}¢/pt` : '—'}
                </p>
                <p className="mt-1 truncate text-[12px] leading-[1.4] text-text2">
                  {topPick ? topPick.city : 'per point'}
                </p>
              </div>
            </div>

            <Link
              href="/account"
              className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand transition-colors hover:text-brand-deep"
            >
              Refresh balances
              <span aria-hidden className="text-[15px] leading-none">→</span>
            </Link>
          </aside>
        ) : (
          <aside className="flex w-full flex-col justify-center rounded-[var(--radius-lg)] border border-border bg-brand-light p-6 lg:w-[360px] lg:flex-shrink-0 lg:rounded-[var(--radius-hero)]">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-paper text-brand">
              <Icon name="loyalty" size={24} weight="fill" />
            </span>
            <h2 className="mt-4 font-display text-[20px] font-semibold leading-[1.1] tracking-[-0.01em] text-text">
              Connect your first program
            </h2>
            <p className="mt-2 text-[13.5px] leading-[1.5] text-text2">
              Link a loyalty account and hop fills this in with your real
              balances and where they can take you.
            </p>
            <Link
              href="/account"
              className="mt-5 inline-flex w-fit items-center gap-2 rounded-[var(--radius)] bg-brand px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-deep"
            >
              Add a program
              <span aria-hidden className="text-[15px] leading-none">→</span>
            </Link>
          </aside>
        )}
      </section>

      {/* ── THE LEDGER DREAM — a cinematic "Dream of the Week" ───────────── */}
      {/* The single most aspirational-yet-affordable redemption built FROM their
          real points stack, with the engine's transparent "how you afford it"
          proof and a live AI narration. A highlight, placed right under their
          points so the dream sits next to the wealth that funds it. */}
      <LedgerDream />

      {/* ── SET HOME AIRPORT (only until they've set one) ────────────────── */}
      {!hasHomeAirport ? <HomeAirportPrompt /> : null}

      {/* ── TRIPS YOUR BALANCES CAN GET YOU TO ───────────────────────────── */}
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand">
              Trips your balances can get you to
            </span>
            {/* No max-width/text-balance on the heading itself: a cap sized in ch
                is relative to THIS block's (small) font-size, not the much larger
                heading font, so it was clipping a one-line headline to two. Only
                the body copy gets a measure cap — the heading sizes to its text. */}
            <h2 className="font-display text-[26px] font-semibold leading-[1.08] tracking-[-0.02em] text-text sm:text-[34px]">
              {personalized
                ? 'Within reach.'
                : 'Dreams worth saving toward.'}
            </h2>
            <p className="max-w-[46ch] text-[15px] leading-[1.55] text-text2">
              {personalized
                ? 'Where your balances can take you as you pool and transfer — sorted by value per point.'
                : 'A few more points and these open up. Sorted by value per point.'}
            </p>
          </div>
          <Link
            href="/ask"
            className="inline-flex flex-shrink-0 items-center gap-1.5 self-start text-[13.5px] font-semibold text-brand transition-colors hover:text-brand-deep sm:self-end"
          >
            Ask hop
            <span aria-hidden className="text-[15px] leading-none">→</span>
          </Link>
        </div>

        <div className="mt-8">
          <DestinationGrid destinations={picks} origin={seed.from} photos={photos} />
        </div>
      </section>

      {/* ── RUN A SEARCH — secondary fast-path ───────────────────────────── */}
      {/* The agent above is the primary way in; search is the precise fast-path
          for members who already know the exact route they want. */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px] lg:gap-12">
        {/* Run a real search */}
        <div className="flex flex-col rounded-[var(--radius-lg)] border border-border bg-paper p-6 sm:p-8 lg:rounded-[var(--radius-hero)]">
          <span className="text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-brand">
            Already know the route?
          </span>
          <h2 className="mt-2 text-balance font-display text-[24px] font-semibold leading-[1.08] tracking-[-0.02em] text-text sm:text-[28px]">
            Run a search. Get the verdict.
          </h2>
          <p className="mt-2 max-w-[44ch] text-[14.5px] leading-[1.55] text-text2">
            Pick a route and hop reads your balances, checks award space, prices
            the cash fare, and tells you the smarter way to book it.
          </p>
          <div className="mt-6">
            <HeroSearch initial={seed} align="start" />
          </div>
        </div>

        {/* Back to the agent — a lighter nudge, not a competing concierge card. */}
        <aside
          className="flex flex-col justify-between overflow-hidden rounded-[var(--radius-lg)] p-6 text-hero-cream sm:p-8 lg:rounded-[var(--radius-hero)]"
          style={{ background: 'var(--color-brand)' }}
        >
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-deep px-3 py-1 text-[11px] font-semibold uppercase tracking-[var(--track-tag)] text-mint-bright">
              <Icon name="lightbulb" size={12} />
              Or just ask
            </span>
            <h2 className="mt-4 text-balance font-display text-[24px] font-semibold leading-[1.08] tracking-[-0.02em] text-white sm:text-[28px]">
              Not sure where to go?
            </h2>
            <p className="mt-2.5 text-[14.5px] leading-[1.55] text-hero-body">
              Describe the trip in plain words — beach, big city, cheap flight,
              business class — and hop finds where points beat cash.
            </p>
          </div>
          <Link
            href="/ask"
            className="mt-6 inline-flex w-fit items-center gap-2 rounded-[var(--radius)] bg-white px-6 py-3.5 text-[15px] font-semibold text-brand-ink transition-colors hover:bg-hero-white-hover"
          >
            Ask hop
            <span aria-hidden className="text-[16px] leading-none">→</span>
          </Link>
        </aside>
      </section>

      {/* ── MANAGE PROGRAMS ──────────────────────────────────────────────── */}
      <section className="flex flex-col items-start gap-5 rounded-[var(--radius-lg)] border border-border bg-paper p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8 lg:rounded-[var(--radius-hero)]">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-brand-light text-brand">
            <Icon name="loyalty" size={24} weight="fill" />
          </span>
          <div>
            <h2 className="font-display text-[19px] font-semibold leading-[1.1] tracking-[-0.01em] text-text">
              {programs > 0 ? 'Manage your programs' : 'Add your programs'}
            </h2>
            <p className="mt-1 max-w-[48ch] text-[13.5px] leading-[1.5] text-text2">
              {programs > 0
                ? `${programs} ${programs === 1 ? 'program' : 'programs'} connected. Add a loyalty account or refresh your balances anytime.`
                : 'Link a loyalty account anytime — hop fills in your real balances and the trips they reach.'}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-brand px-6 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-deep"
          >
            <Icon name="settings" size={16} />
            {programs > 0 ? 'Manage programs' : 'Add a program'}
          </Link>
        </div>
      </section>
    </div>
  )
}
