import Link from 'next/link'
import HeroAsk from '@/components/landing/HeroAsk'
import HeroAmbience from '@/components/landing/HeroAmbience'
import ShowcaseRotator, { type ShowcaseEntry } from '@/components/landing/ShowcaseRotator'
import { WALLET_VALUE_CAVEAT } from '@/lib/valuations'

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
}: {
  first?: string
  programs: number
  totalPoints: number
  /** Engine-computed USD wallet value (lib/valuations#walletValue). */
  pointsWorth: number
  /** Personalized showcase — every number computed server-side. */
  entries: ShowcaseEntry[]
}) {
  const showcase = entries.length >= 2

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

          {totalPoints > 0 ? (
            <p
              className="hop-rise mt-4 text-[15px] leading-[1.6] text-text2 sm:text-[17px]"
              style={{ ['--hop-delay' as string]: '140ms' }}
            >
              <span className="hop-price font-semibold text-text">
                {totalPoints.toLocaleString('en-US')}
              </span>{' '}
              points across {programs} {programs === 1 ? 'program' : 'programs'}
              {pointsWorth > 0 ? (
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
                href="/account"
                className="font-semibold text-brand underline-offset-2 transition-colors hover:text-brand-deep hover:underline"
              >
                Manage
              </Link>
            </p>
          ) : programs > 0 ? (
            // Quick-start rows exist (real programs, zero balance) — say so
            // plainly rather than "0 points across N programs", which reads as
            // the points system being "on" when it has nothing to show yet.
            <p
              className="hop-rise mt-4 max-w-[46ch] text-[15px] leading-[1.6] text-text2 sm:text-[17px]"
              style={{ ['--hop-delay' as string]: '140ms' }}
            >
              {programs} {programs === 1 ? 'program' : 'programs'} linked, no
              balances yet.{' '}
              <Link
                href="/account"
                className="font-semibold text-brand underline-offset-2 transition-colors hover:text-brand-deep hover:underline"
              >
                Fill them in
              </Link>
            </p>
          ) : (
            <p
              className="hop-rise mt-4 max-w-[46ch] text-[15px] leading-[1.6] text-text2 sm:text-[17px]"
              style={{ ['--hop-delay' as string]: '140ms' }}
            >
              Link a loyalty program and hop prices every trip against what you
              actually hold.{' '}
              <Link
                href="/account"
                className="font-semibold text-brand underline-offset-2 transition-colors hover:text-brand-deep hover:underline"
              >
                Add a program
              </Link>
            </p>
          )}

          <div className="hop-rise mt-7" style={{ ['--hop-delay' as string]: '200ms' }}>
            <HeroAsk />
          </div>
        </div>

        {showcase ? <ShowcaseRotator entries={entries} /> : null}
      </div>
    </section>
  )
}
