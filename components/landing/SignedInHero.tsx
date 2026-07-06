import Link from 'next/link'
import HeroAsk from '@/components/landing/HeroAsk'
import HeroAmbience from '@/components/landing/HeroAmbience'
import ShowcaseRotator, { type ShowcaseEntry } from '@/components/landing/ShowcaseRotator'
import { WALLET_VALUE_CAVEAT } from '@/lib/valuations'
import type { Balance } from '@/lib/types'

// Below this total (or with only a single program held), hop can't yet see
// "the whole hand" — one card's balance rarely clears a real award on its
// own, so the line pushes toward connecting more programs rather than
// quoting a redemption teaser. Matches the affordableWith() floor most
// short-haul economy awards need (lib/destinations).
const LOW_BALANCE_THRESHOLD = 25_000

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

// The signed-in front door — the SAME split-hero language as the signed-out
// page (confident display type left, one composed showcase right, the blurred
// photo ambience washing the whole section), personalized: the greeting is the
// member's, the status line is their engine-computed wallet, and the showcase
// rotates through trips THEIR balances actually reach. Imagery is structural
// (a grid column), never absolutely-positioned ornament — see
// docs/design/experience-heuristics.md.
export default function SignedInHero({
  first,
  programs,
  totalPoints,
  pointsWorth,
  entries,
  personalized,
  balances = [],
}: {
  first?: string
  programs: number
  totalPoints: number
  /** Engine-computed USD wallet value (lib/valuations#walletValue). */
  pointsWorth: number
  /** Personalized showcase — every number computed server-side. */
  entries: ShowcaseEntry[]
  /** Whether `entries` was actually confirmed reachable against the member's
      real per-program balances (lib/ledger-dream#reachableDestinations),
      versus a generic best-cpp-in-the-world fallback (lib/destinations#topValue)
      used when they don't clear that bar. Only when true is entries[0] safe to
      present as an affordability verdict ("enough for X, skipping $Y") —
      otherwise it's an unrelated pick that may need far more of either
      currency than the member holds. */
  personalized: boolean
  /** Real per-program balances (lib/accounts#getUserBalances) — only the
      single-program display name in the low-balance line needs this. */
  balances?: Balance[]
}) {
  const showcase = entries.length >= 2
  // The best reachable redemption for the healthy-balance teaser below — only
  // trustworthy when `personalized` confirms entries came from
  // reachableDestinations(), not the generic topValue() fallback (see the
  // `personalized` prop doc). The rotator itself needs >=2 entries but this
  // line only needs one.
  const bestReach = personalized ? entries[0] : undefined
  const isLowBalance = programs === 1 || totalPoints < LOW_BALANCE_THRESHOLD

  return (
    // isolate: HeroAmbience sits at -z inside THIS stacking context, above the
    // page canvas but under every piece of hero content.
    <section className="relative isolate pt-2 sm:pt-6 lg:pt-8">
      {showcase ? <HeroAmbience entries={entries} /> : null}

      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-16 xl:gap-20">
        <div>
          <h1
            className="hop-rise max-w-[14ch] text-balance font-display text-[40px] font-semibold leading-[1.02] tracking-[-0.03em] text-text sm:text-[54px] lg:text-[64px]"
            style={{ ['--hop-delay' as string]: '90ms' }}
          >
            {first ? `Where to next, ${first}?` : 'Where to next?'}
          </h1>

          {programs === 0 ? (
            <p
              className="hop-rise mt-4 max-w-[46ch] text-[15px] leading-[1.6] text-text2 sm:text-[17px]"
              style={{ ['--hop-delay' as string]: '140ms' }}
            >
              Link a loyalty program and hop prices every trip against what you
              actually hold.{' '}
              <Link
                href="/account#programs"
                className="font-semibold text-brand underline-offset-2 transition-colors hover:text-brand-deep hover:underline"
              >
                Add a program
              </Link>
            </p>
          ) : isLowBalance ? (
            // The engine can't yet see "the whole hand" — one program (or a
            // small stack) rarely clears a real award alone, so this pushes
            // toward connecting more rather than teasing a redemption.
            <p
              className="hop-rise mt-4 max-w-[46ch] text-[15px] leading-[1.6] text-text2 sm:text-[17px]"
              style={{ ['--hop-delay' as string]: '140ms' }}
            >
              <span className="hop-price font-semibold text-text">
                {totalPoints.toLocaleString('en-US')}
              </span>{' '}
              {programs === 1 ? (
                <>{balances[0]?.program ?? 'points'} points</>
              ) : (
                <>points across {programs} programs</>
              )}
              . Add your other programs and hop sees your whole hand.{' '}
              <Link
                href="/account#programs"
                className="font-semibold text-brand underline-offset-2 transition-colors hover:text-brand-deep hover:underline"
              >
                Add a program
              </Link>
            </p>
          ) : (
            <p
              className="hop-rise mt-4 text-[15px] leading-[1.6] text-text2 sm:text-[17px]"
              style={{ ['--hop-delay' as string]: '140ms' }}
            >
              <span className="hop-price font-semibold text-text">
                {totalPoints.toLocaleString('en-US')}
              </span>{' '}
              across {programs} programs
              {bestReach ? (
                // Only set when `personalized` confirmed entries[0] against
                // the member's real balances (see the prop doc above) —
                // cashValue is the route's typical one-way cash
                // (lib/destinations#typicalCashUSD), the same "cash you skip"
                // figure the Ledger Dream card uses.
                <>
                  {' '}
                  — enough for{' '}
                  <span className="font-semibold text-text">
                    {bestReach.city}
                    {bestReach.cabin ? ` in ${bestReach.cabin}` : ''}
                  </span>
                  {bestReach.cashValue ? (
                    // "Skipping $X" — the trip's typical one-way cash price
                    // (lib/destinations#typicalCashUSD), the exact figure the
                    // Ledger Dream card labels "Cash you skip". Deliberately
                    // NOT "$X to spare" — cashValue isn't leftover budget,
                    // it's the cash outlay the points redemption avoids.
                    <>
                      {', skipping '}
                      <span className="font-semibold text-text">{money(bestReach.cashValue)}</span>
                      {' in cash'}
                    </>
                  ) : null}
                </>
              ) : pointsWorth > 0 ? (
                <span title={WALLET_VALUE_CAVEAT}>
                  {' '}
                  — worth ~
                  <span className="font-semibold text-text">
                    ${pointsWorth.toLocaleString('en-US')}
                  </span>{' '}
                  at typical value
                </span>
              ) : null}
              .{' '}
              <Link
                href="/account#programs"
                className="font-semibold text-brand underline-offset-2 transition-colors hover:text-brand-deep hover:underline"
              >
                Manage
              </Link>
            </p>
          )}

          {/* Tightened from mt-7 — the composer is the headline's direct
              continuation ("say where"), not a separate block; it should read
              coupled to the greeting + balance line above it. */}
          <div className="hop-rise mt-5" style={{ ['--hop-delay' as string]: '200ms' }}>
            <HeroAsk />
          </div>
        </div>

        {showcase ? <ShowcaseRotator entries={entries} /> : null}
      </div>
    </section>
  )
}
