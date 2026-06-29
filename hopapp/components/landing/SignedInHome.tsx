import Icon from '@/components/Icon'
import HeroSearch from '@/components/landing/HeroSearch'
import DestinationGrid from '@/components/landing/DestinationGrid'
import HomeAirportPrompt from '@/components/HomeAirportPrompt'
import {
  affordableWith,
  topValue,
  imageQuery,
  computeCpp,
} from '@/lib/destinations'
import { destinationImages } from '@/lib/images'
import type { SearchState } from '@/components/SearchBar'

// The personalized home for a signed-in member. NOT the marketing page — it
// leads with a warm greeting and their synced state, then the single most
// useful, aspirational module: where their actual points can take them right
// now. Search, concierge, and program management follow. Flat, warm, on-brand.
export default async function SignedInHome({
  first,
  programs,
  totalPoints,
  seed,
  hasHomeAirport = true,
}: {
  first?: string
  programs: number
  totalPoints: number
  seed: SearchState
  hasHomeAirport?: boolean
}) {
  // Personalized to the member's real balance; best value first. If they're
  // light on points (or programs failed), fall back to the universally great
  // redemptions so the module is never empty.
  const affordable = affordableWith(totalPoints)
  const picks = (affordable.length >= 4 ? affordable : topValue(8)).slice(0, 8)
  const personalized = affordable.length >= 4
  const photos = await destinationImages(picks.map((d) => imageQuery(d)))

  // A single headline stat for the summary panel: the best-value trip the
  // member can reach right now (or the best dream if they're light on points).
  const topPick = picks[0]
  const topCpp = topPick ? computeCpp(topPick) : undefined

  return (
    <div className="flex flex-col gap-14 pt-4 sm:gap-16 sm:pt-8 lg:gap-20">
      {/* ── GREETING + SUMMARY ───────────────────────────────────────────── */}
      <section
        className="hop-rise grid grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_360px] lg:gap-12"
        style={{ ['--hop-delay' as string]: '40ms' }}
      >
        {/* Greeting */}
        <div>
          {programs > 0 ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-paper px-3.5 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-brand">
              <Icon name="check_circle" size={13} />
              Balances synced
            </span>
          ) : (
            <a
              href="/account"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-paper px-3.5 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-brand transition-colors hover:bg-sunk"
            >
              <Icon name="loyalty" size={13} />
              Add your programs to get started
            </a>
          )}
          <h1 className="mt-4 font-display text-[36px] font-semibold leading-[1.02] tracking-[-0.03em] text-text sm:text-[52px] lg:text-[60px]">
            {first ? `Welcome back, ${first}.` : 'Welcome back.'}
          </h1>
          <p className="mt-3 max-w-[52ch] text-[16px] leading-[1.55] text-text2 sm:text-[18px]">
            {programs > 0
              ? "Here's where your points can take you — and what each trip is really worth."
              : 'Add your loyalty programs and hop will show you exactly where your points can take you — and whether to book with miles or cash.'}
          </p>
        </div>

        {/* Summary panel — balances the hero and anchors the right column.
            Flat: a bordered paper card with a sunk stat row, no shadow/lift. */}
        {programs > 0 ? (
          <aside className="flex flex-col rounded-[20px] border border-border bg-paper p-6 lg:rounded-[24px]">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-brand">
              Your points
            </span>
            <p className="mt-2 font-display text-[40px] font-semibold leading-[1] tracking-[-0.02em] text-text tabular-nums sm:text-[46px]">
              {totalPoints.toLocaleString()}
            </p>
            <p className="mt-1 text-[13.5px] leading-[1.5] text-text2">
              across {programs} {programs === 1 ? 'program' : 'programs'}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-hair bg-hair">
              <div className="bg-sunk p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text3">
                  Within reach
                </p>
                <p className="mt-1 font-display text-[22px] font-semibold leading-none text-text tabular-nums">
                  {personalized ? affordable.length : 0}
                </p>
                <p className="mt-1 text-[12px] leading-[1.4] text-text2">
                  destinations
                </p>
              </div>
              <div className="bg-sunk p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text3">
                  Best value
                </p>
                <p className="mt-1 font-display text-[22px] font-semibold leading-none text-text tabular-nums">
                  {topCpp !== undefined ? `${topCpp.toFixed(1)}¢` : '—'}
                </p>
                <p className="mt-1 truncate text-[12px] leading-[1.4] text-text2">
                  {topPick ? `per mi · ${topPick.city}` : 'per mile'}
                </p>
              </div>
            </div>

            <a
              href="/account"
              className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand transition-colors hover:text-brand-deep"
            >
              Refresh balances
              <span aria-hidden className="text-[15px] leading-none">→</span>
            </a>
          </aside>
        ) : (
          <aside className="flex flex-col justify-center rounded-[20px] border border-border bg-brand-light p-6 lg:rounded-[24px]">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-paper text-brand">
              <Icon name="loyalty" size={22} />
            </span>
            <h2 className="mt-4 font-display text-[20px] font-semibold leading-[1.1] tracking-[-0.01em] text-text">
              Connect your first program
            </h2>
            <p className="mt-2 text-[13.5px] leading-[1.5] text-text2">
              Link a loyalty account and hop fills this in with your real
              balances and where they can take you.
            </p>
            <a
              href="/account"
              className="mt-5 inline-flex w-fit items-center gap-2 rounded-[14px] bg-brand px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-deep"
            >
              Add a program
              <span aria-hidden className="text-[15px] leading-none">→</span>
            </a>
          </aside>
        )}
      </section>

      {/* ── SET HOME AIRPORT (only until they've set one) ────────────────── */}
      {!hasHomeAirport ? <HomeAirportPrompt /> : null}

      {/* ── WHERE YOUR POINTS CAN TAKE YOU ───────────────────────────────── */}
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2 sm:max-w-[54ch]">
            <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brand">
              Where your points can take you
            </span>
            <h2 className="font-display text-[26px] font-semibold leading-[1.08] tracking-[-0.02em] text-text sm:text-[34px]">
              {personalized
                ? 'Within reach right now.'
                : 'Dreams worth saving toward.'}
            </h2>
            <p className="mt-1 text-[15px] leading-[1.55] text-text2">
              {personalized
                ? 'Every city here is bookable with the points you already hold — sorted by the value you get per mile.'
                : 'A few more points and these open up. Sorted by the value you get per mile.'}
            </p>
          </div>
          <a
            href="/ask"
            className="inline-flex flex-shrink-0 items-center gap-1.5 self-start text-[13.5px] font-semibold text-brand transition-colors hover:text-brand-deep sm:self-end"
          >
            Explore more
            <span aria-hidden className="text-[15px] leading-none">→</span>
          </a>
        </div>

        <div className="mt-8">
          <DestinationGrid destinations={picks} origin={seed.from} photos={photos} />
        </div>
      </section>

      {/* ── RUN A SEARCH + CONCIERGE ─────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        {/* Run a real search */}
        <div className="flex flex-col rounded-[20px] border border-border bg-paper p-6 sm:p-8 lg:rounded-[24px]">
          <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brand">
            Got a trip in mind?
          </span>
          <h2 className="mt-2 font-display text-[24px] font-semibold leading-[1.08] tracking-[-0.02em] text-text sm:text-[30px]">
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

        {/* Ask hop / concierge */}
        <aside
          className="flex flex-col justify-between overflow-hidden rounded-[20px] p-6 text-[#eafaf7] sm:p-8 lg:rounded-[24px]"
          style={{ background: 'var(--color-brand)' }}
        >
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#0a5757] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6ff0d2]">
              <Icon name="lightbulb" size={13} />
              Concierge
            </span>
            <h2 className="mt-4 font-display text-[24px] font-semibold leading-[1.08] tracking-[-0.02em] text-white sm:text-[28px]">
              Not sure where to go?
            </h2>
            <p className="mt-2.5 text-[14.5px] leading-[1.55] text-[#c7ece5]">
              Tell hop your vibe and budget in points — beach, big city, cheap
              flight, business class — and it&apos;ll find where your miles win.
            </p>
          </div>
          <a
            href="/ask"
            className="mt-6 inline-flex w-fit items-center gap-2 rounded-[14px] bg-white px-6 py-3.5 text-[15px] font-semibold text-[#073e3e] transition-colors hover:bg-[#fffdf6]"
          >
            Ask hop where to go
            <span aria-hidden className="text-[16px] leading-none">→</span>
          </a>
        </aside>
      </section>

      {/* ── MANAGE PROGRAMS ──────────────────────────────────────────────── */}
      <section className="flex flex-col items-start gap-5 rounded-[20px] border border-border bg-paper p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8 lg:rounded-[24px]">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-brand-light text-brand">
            <Icon name="loyalty" size={24} />
          </span>
          <div>
            <h2 className="font-display text-[19px] font-semibold leading-[1.1] tracking-[-0.01em] text-text">
              Manage your programs
            </h2>
            <p className="mt-1 max-w-[48ch] text-[13.5px] leading-[1.5] text-text2">
              {programs} {programs === 1 ? 'program' : 'programs'} connected.
              Add a loyalty account or refresh your balances anytime.
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <a
            href="/account"
            className="inline-flex items-center gap-2 rounded-[14px] bg-brand px-6 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-deep"
          >
            <Icon name="settings" size={18} />
            Manage programs
          </a>
        </div>
      </section>
    </div>
  )
}
