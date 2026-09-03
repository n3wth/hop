import Link from 'next/link'
import Icon from '@/components/Icon'
import Card from '@/components/ui/Card'
import Eyebrow from '@/components/ui/Eyebrow'
import HeroSearch from '@/components/landing/HeroSearch'
import DestinationGrid from '@/components/landing/DestinationGrid'
import SignedInHero from '@/components/landing/SignedInHero'
import type { ShowcaseEntry } from '@/components/landing/ShowcaseRotator'
import LedgerDream from '@/components/landing/LedgerDream'
import TransferUnlockShelf from '@/components/landing/TransferUnlockShelf'
import LiveValuationShelf from '@/components/landing/LiveValuationShelf'
import HomeAirportPrompt from '@/components/HomeAirportPrompt'
import {
  affordableWith,
  topValue,
  imageQuery,
  computeCpp,
} from '@/lib/destinations'
import { POINTS_THRESHOLD_CPP } from '@/lib/search'
import { reachableDestinations } from '@/lib/ledger-dream'
import { withoutAvoided, EMPTY_MEMORY_CONTEXT, type MemoryContext } from '@/lib/memory-context'
import { destinationImages } from '@/lib/images'
import type { SearchState } from '@/components/SearchBar'
import type { Balance } from '@/lib/types'

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
  memory = EMPTY_MEMORY_CONTEXT,
  balances = [],
}: {
  first?: string
  programs: number
  totalPoints: number
  /** Engine-computed USD value of the whole wallet (lib/valuations#walletValue). */
  pointsWorth?: number
  seed: SearchState
  hasHomeAirport?: boolean
  /** Unified memory (lib/memory-context) — drops the member's stated "avoid"
      places from the feed. Defaults to the empty context → today's exact behavior. */
  memory?: MemoryContext
  /** The member's real per-program balances. Confirms "in reach" against the
      SPECIFIC (non-transferable) currency each destination's bestProgram
      needs — totalPoints alone sums across every program regardless of
      currency, so it can flag a destination reachable when the member holds
      none of what it actually takes. Defaults to [] → today's exact fallback
      (the totalPoints-only affordableWith gate) when a caller has nothing. */
  balances?: Balance[]
}) {
  // Personalized to the member's real balance; best value first. If they're
  // light on points (or programs failed), fall back to the universally great
  // redemptions so the module is never empty. reachableDestinations() adds the
  // per-program (or verified-transfer) confirmation on top of the raw-points
  // affordableWith() gate — see lib/ledger-dream.ts.
  const affordable = balances.length > 0 ? reachableDestinations(balances) : affordableWith(totalPoints)
  const personalized = affordable.length >= 4
  // M5 — compounding: drop the member's STATED "avoid" places from this
  // engine-ranked module. Value order is PRESERVED (hop leads with value; loved
  // places shape the concierge's words, not this ranking), so "sorted by value
  // per point" below stays true. A no-op when the profile has no avoided places
  // → today's exact feed.
  const base = personalized ? affordable : topValue(24)
  const pool = withoutAvoided(base, memory.avoided)
  // The hero rotator takes the TOP picks; "Where your points already reach"
  // takes the next 2-3; the grid continues where THAT ends — so one page
  // never shows the same destination photo twice (experience heuristic:
  // repetition reads as template, not curation). Value order is preserved
  // across every seam.
  const heroPicks = pool.slice(0, 5)
  const reachPicks = pool.slice(heroPicks.length, heroPicks.length + 3)
  const picks = pool.slice(
    heroPicks.length + reachPicks.length,
    heroPicks.length + reachPicks.length + 8,
  )
  const photos = await destinationImages(
    [...heroPicks, ...reachPicks, ...picks].map((d) => imageQuery(d)),
  )

  // The hero showcase — the member's own reachable picks, in the exact visual
  // language of the signed-out hero (photo + engine-numbers card + ambience).
  // Every figure computed here, server-side; the rotator only cycles.
  // IMPORTANT: preserve stable ordering even when photos are missing — filter
  // AFTER mapping so the first entry is deterministic (prevents hydration
  // flash when photo availability differs between server/client).
  const heroEntriesAll: (ShowcaseEntry | null)[] = heroPicks.map((d) => {
    const photo = photos[imageQuery(d)]
    const cppVal = computeCpp(d)
    if (cppVal === undefined) return null
    return {
      code: d.code,
      city: d.city,
      country: d.country,
      cpp: cppVal,
      miles: d.typicalAwardMiles,
      program: d.bestProgram,
      cabin: d.cabin,
      pointsWin: cppVal >= POINTS_THRESHOLD_CPP,
      image: photo?.url ?? '',
      thumb: photo?.thumb ?? '',
      color: photo?.color,
      href: `/search?from=${encodeURIComponent(seed.from)}&to=${encodeURIComponent(d.code)}&adults=1`,
      cashValue: d.typicalCashUSD,
    }
  })
  // Filter out nulls but keep entries with missing photos (they'll render with
  // the color fallback in ShowcaseRotator). This ensures entries[0] is always
  // the best-value destination regardless of photo availability.
  const heroEntries: ShowcaseEntry[] = heroEntriesAll.filter(
    (e): e is ShowcaseEntry => e !== null,
  )

  return (
    <div className="flex flex-col gap-14 pt-4 sm:gap-16 sm:pt-6 lg:gap-20">
      {/* ── THE FRONT DOOR — hero + immediate reach, one coupled unit ─────── */}
      {/* Tighter inner gap than the outer rhythm below: the reach tiles are
          the hero's balance line paying off immediately, not a new section —
          closing this "dead band" is what makes the two read as one move. */}
      <div className="flex flex-col gap-8 sm:gap-10">
        {/* Greeting + engine-computed wallet line + the conversation composer
            on the left; the member's own reachable trips rotating on the
            right with the photo ambience washing the section. The old stats
            panel folded into the hero status line — the showcase card already
            carries the best-value figures. */}
        <SignedInHero
          first={first}
          programs={programs}
          totalPoints={totalPoints}
          pointsWorth={pointsWorth}
          entries={heroEntries}
          personalized={personalized}
          balances={balances}
        />

        {/* ── WHERE YOUR POINTS ALREADY REACH ────────────────────────────── */}
        {/* A compact, static row of the member's next-best reachable
            redemptions (continuing the ranked pool right where the hero
            rotator left off — see the slicing above). `personalized`
            (computed above from the real reachableDestinations() gate)
            decides whether this is genuinely theirs or the generic
            best-value sample. */}
        {reachPicks.length > 0 ? (
          <LedgerDream picks={reachPicks} origin={seed.from} sample={!personalized} photos={photos} />
        ) : null}
      </div>

      {/* ── SET HOME AIRPORT (only until they've set one) ────────────────── */}
      {!hasHomeAirport ? <HomeAirportPrompt /> : null}

      {/* ── TRIPS YOUR BALANCES CAN GET YOU TO ───────────────────────────── */}
      {/* Hidden entirely when the hero already showcased everything reachable
          (small wallets) — an empty grid under a full header reads broken. */}
      {picks.length > 0 ? (
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <Eyebrow className="text-brand text-[12px]">
              Trips your balances can get you to
            </Eyebrow>
            {/* No max-width/text-balance on the heading itself: a cap sized in ch
                is relative to THIS block's (small) font-size, not the much larger
                heading font, so it was clipping a one-line headline to two. Only
                the body copy gets a measure cap — the heading sizes to its text. */}
            <h2 className="font-display text-[26px] font-semibold leading-[1.08] tracking-[-0.02em] text-text sm:text-[34px]">
              {personalized
                ? 'Within reach.'
                : 'Just out of reach.'}
            </h2>
            <p className="max-w-[46ch] text-[15px] leading-[1.55] text-text2">
              {personalized
                ? 'Where your balances can take you as you pool and transfer. Sorted by value per point.'
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
      ) : null}

      {/* ── UNLOCKED BY TRANSFER — trips one verified transfer away ──────── */}
      {/* Never repeats a destination already shown in "Within reach" above
          (excludeCodes = the exact codes rendered there). Omits entirely
          (returns null) when there's nothing left to show. */}
      <TransferUnlockShelf
        balances={balances}
        excludeCodes={[
          ...heroEntries.map((e) => e.code),
          ...reachPicks.map((d) => d.code),
          ...picks.map((d) => d.code),
        ]}
        origin={seed.from}
      />

      {/* ── YOUR POINTS, PRICED LIVE — real observed cpp for held programs ── */}
      {/* Ships completely dark until a program the member holds crosses the
          live-valuation trust threshold (lib/valuations-live). */}
      <LiveValuationShelf balances={balances} />

      {/* ── RUN A SEARCH — secondary fast-path ───────────────────────────── */}
      {/* The agent above is the primary way in; search is the precise fast-path
          for members who already know the exact route they want. */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px] lg:gap-12">
        {/* Run a real search */}
        <Card surface="paper" radius="lg" className="flex flex-col p-6 sm:p-8 lg:rounded-[var(--radius-hero)]">
          <Eyebrow className="text-brand text-[12px]">
            Already know the route?
          </Eyebrow>
          <h2 className="mt-2 text-balance font-display text-[24px] font-semibold leading-[1.08] tracking-[-0.02em] text-text sm:text-[28px]">
            Run a search. Get the verdict.
          </h2>
          <p className="mt-2 max-w-[44ch] text-[14.5px] leading-[1.55] text-text2">
            Pick a route and hop reads your balances, the published saver chart,
            and the cash fare. Points or cash, with the math.
          </p>
          {/* mt-auto bottom-anchors the search pill so this card's composition
              mirrors the teal panel beside it (whose CTA is bottom-anchored via
              justify-between) — otherwise the grid row stretches both cells to
              equal height and the shorter card shows dead space under the pill. */}
          <div className="mt-auto pt-6">
            <HeroSearch initial={seed} align="start" />
          </div>
        </Card>

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
              Describe the trip in plain words: beach, big city, cheap flight,
              business class. hop finds where points beat cash.
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
      <Card as="section" surface="paper" radius="lg" className="flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8 lg:rounded-[var(--radius-hero)]">
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
                : 'Link a loyalty account anytime. hop fills in your real balances and the trips they reach.'}
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
      </Card>
    </div>
  )
}
