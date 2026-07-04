import type { FlightOption, SearchResult } from '@/lib/types'
import { POINTS_THRESHOLD_CPP, seatsFor } from '@/lib/search'
import { formatValue } from '@/lib/cpp'
import { cityForCode } from '@/lib/airports'
import { googleCalendarUrl } from '@/lib/calendar-link'
import Icon from './Icon'
import Logo from './Logo'
import BrandIcon from './BrandIcon'
import SeeTheMath from './SeeTheMath'
import CountUp from './CountUp'
import CardAffiliateCTA from './CardAffiliateCTA'
import WatchThisRoute from './WatchThisRoute'

export interface VerdictRailProps {
  result: SearchResult
  /** Destination photo (server-fetched from the pick's destCode). When present
      it fills the hero behind the boarding pass instead of the bunny mark. */
  destPhoto?: { url: string; alt: string } | null
  /** True only when these balances are the SIGNED-IN user's own (real). Drives
      the ownership voice: "You have the miles" + "Book with X miles" are only
      honest when hop is reading this visitor's connected programs. Signed-out
      (or no real balances) → a value-demonstration framing + sign-in CTA, never
      a claim that the stranger owns the points. */
  hasRealBalances?: boolean
  /** True when the visitor has a resolved Auth0 session (app/search/page.tsx).
      Gates "Watch this route" on the pay-cash path: signed-out visitors see a
      sign-in link instead, since a watch has to belong to someone. */
  isSignedIn?: boolean
  /** The search was filtered to nonstop-only (not part of SearchParams — a
      prefs-model filter applied alongside it). Carried through the sign-in
      returnTo so the filter survives auth, same as cabin/children/infants. */
  nonstop?: boolean
  /** Whether the standing-orders runner is live (lib/env.ts#
      isStandingOrdersCronLive, resolved server-side). Drives WatchThisRoute's
      promise copy: off → "alerts go live soon", never a ping we can't send.
      Defaults false — fail honest when a caller forgets. */
  watchLive?: boolean
}

function fmt(n: number | undefined): string {
  return n != null ? n.toLocaleString() : '—'
}

function milesUnit(pick: FlightOption | undefined): string {
  if (!pick) return 'miles'
  return pick.program?.toLowerCase().includes('southwest') ? 'points' : 'miles'
}

// Rebuild the canonical /search URL from the result's params so a cold visitor
// who hits a points-winning verdict keeps their exact route through sign-in.
function searchUrlFrom(params: SearchResult['params'], nonstop?: boolean): string {
  const q = new URLSearchParams({
    from: params.from,
    to: params.to,
    depart: params.depart,
    adults: String(params.adults),
  })
  if (params.return) q.set('return', params.return)
  // Every filter the visitor actually chose must round-trip through sign-in —
  // dropping cabin silently reset a business-cabin search back to economy
  // after auth.
  if (params.cabin) q.set('cabin', params.cabin)
  if (params.children) q.set('children', String(params.children))
  if (params.infants) q.set('infants', String(params.infants))
  if (nonstop) q.set('nonstop', '1')
  return `/search?${q.toString()}`
}

// Editorial verdict hero — the magazine cover. Teal plane: headline + factual
// subline + stat strip on the left; bunny + boarding-pass pick card on the right.
export default function VerdictRail({
  result,
  destPhoto,
  hasRealBalances = false,
  isSignedIn = false,
  nonstop,
  watchLive = false,
}: VerdictRailProps) {
  const { pick, summary, verdict, cashOption } = result
  const usingPoints = verdict === 'use-points'
  const unit = milesUnit(pick)
  // The ownership voice ("You have the miles", "Book with X miles") is honest
  // ONLY when these balances are the signed-in user's own AND the balance
  // actually covers the pick's (party-scaled) miles. For a signed-out visitor
  // the points belong to no one we know — so a points-winning verdict is
  // framed as a value demonstration ("Alaska miles are worth X¢ here") with a
  // sign-in CTA, never a claim that the stranger holds the miles. A signed-in
  // user holding SOME points but fewer than the trip needs gets the same
  // value framing — "You have the miles" must never be arithmetically false.
  const covers =
    pick?.miles != null && pick?.youHave != null ? pick.youHave >= pick.miles : false
  const owns = usingPoints && hasRealBalances && covers
  // "Book cash" must link to the actual cheapest CASH option — on a pay-cash
  // verdict `pick` may still be a weak award row, so don't use pick.bookingUrl.
  // When points win but we can't claim ownership, the primary CTA routes to
  // sign-in instead of a book deep-link.
  // When points win but we can't claim ownership, route the CTA to sign-in with
  // a returnTo so the visitor lands back on this exact search after auth.
  const returnTo = encodeURIComponent(searchUrlFrom(result.params, nonstop))
  const signInHref = `/auth/login?returnTo=${returnTo}`
  // A SIGNED-IN user who can't claim ownership (no/insufficient balance in the
  // pick's program) must never be told to "Sign in" — route them to /account to
  // add programs instead, carrying returnTo so R1.1's bridge can bring them
  // back to this exact search.
  const addProgramsHref = `/account?returnTo=${returnTo}`
  const ctaHref = !usingPoints
    ? (cashOption?.bookingUrl ?? pick?.bookingUrl ?? '#')
    : owns
      ? (pick?.bookingUrl ?? '#')
      : isSignedIn
        ? addProgramsHref
        : signInHref

  // M6 — first ACTION: turn this trip into a calendar event in one tap (Google
  // Calendar template, all-day, no OAuth). Carries route + dates + city + cabin
  // ONLY — never the engine's live cpp/miles/price (those would go stale). null
  // (→ the affordance hides) when the dates are unusable.
  const calUrl = googleCalendarUrl({
    fromCode: result.params.from,
    toCode: result.params.to,
    fromCity: cityForCode(result.params.from),
    toCity: cityForCode(result.params.to),
    depart: result.params.depart,
    return: result.params.return,
    cabin: result.params.cabin,
  })

  const save = summary.saveVsCash ?? 0
  const cpp = summary.bestCpp
  const miles = summary.bestMiles
  const cash = summary.cheapestCash

  // Seat-occupying travelers — MUST be the engine's own seatsFor (the exact
  // multiplier applied to the figures above), never a re-derivation here.
  const seats = seatsFor(result.params)

  // Pay-cash path: summary.bestCpp/bestMiles are only set when points win, so
  // pull the closest award from the ranked options to SHOW the math that failed
  // the bar — a specific "here's what we checked" reads like an agent's reasoning,
  // not a shrug. Engine numbers only.
  const bestAward = !usingPoints
    ? result.options.find((o) => o.kind !== 'cash' && o.cpp != null && o.miles != null)
    : undefined

  const airlineShort = pick?.airline.split(' ')[0] ?? 'points'

  return (
    <section
      className="hop-appear mt-[26px] grid grid-cols-1 overflow-hidden rounded-[20px] text-hero-cream lg:grid-cols-[1fr_392px] lg:rounded-[28px]"
      style={{ background: 'var(--color-brand)' }}
    >
      {/* LEFT — the verdict */}
      <div className="px-6 pb-9 pt-8 sm:px-10 lg:px-[52px] lg:pb-[46px] lg:pt-12">
        <span className="mb-[26px] inline-flex items-center border-b border-white/15 pb-4 text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-hero-eyebrow">
          Best value
        </span>

        {usingPoints ? (
          <>
            {/* The visual headline splits the sentence across the h1 and the
                oversized count-up below it, so the h1 carries the FULL verdict
                sentence as an aria-label and the count-up row is aria-hidden —
                a screen reader hears one complete sentence, not a fragment
                followed by an animating number. */}
            <h1
              aria-label={
                owns
                  ? `Use your ${airlineShort} ${unit} and save $${fmt(save)} vs cash.`
                  : `${airlineShort} ${unit} win here — by $${fmt(save)} vs cash.`
              }
              className="hop-rise text-balance font-display text-[24px] font-semibold leading-[1.05] tracking-[-0.02em] text-white sm:text-[34px] lg:text-[40px]"
              style={{ ['--hop-delay' as string]: '60ms' }}
            >
              {owns ? (
                <>
                  Use your <span className="text-gold-soft">{airlineShort}&nbsp;{unit}</span> and save
                </>
              ) : (
                <>
                  <span className="text-gold-soft">{airlineShort}&nbsp;{unit}</span> win here — by
                </>
              )}
            </h1>

            {/* The hero moment — the dollar value, oversized and confident. The
                count-up lands here. Tight tracking, tabular for a clean tick.
                aria-hidden: the h1's aria-label already speaks this figure. */}
            <div
              aria-hidden
              className="hop-rise mt-[10px] flex items-baseline gap-3 sm:mt-3"
              style={{ ['--hop-delay' as string]: '110ms' }}
            >
              <CountUp
                className="font-display text-[52px] font-semibold leading-[0.9] tracking-[-0.04em] text-mint-bright tabular-nums sm:text-[88px] lg:text-[128px]"
                value={save}
                format="usd"
                delayMs={420}
              />
              <span className="font-display text-[20px] font-semibold leading-tight tracking-[-0.01em] text-hero-eyebrow sm:text-[24px]">
                vs&nbsp;cash
              </span>
            </div>
          </>
        ) : (
          <h1
            className="hop-rise text-balance font-display text-[34px] font-semibold leading-[1.02] tracking-[-0.025em] text-white sm:text-[48px] sm:leading-[1.0] lg:text-[64px] lg:leading-[0.98]"
            style={{ ['--hop-delay' as string]: '60ms' }}
          >
            Pay <span className="text-gold-soft">cash.</span>
            <br />
            Points don&apos;t pay off here.
          </h1>
        )}

        {usingPoints && owns ? (
          <p className="hop-rise mt-6 max-w-[46ch] text-[17px] leading-[1.55] text-hero-body" style={{ ['--hop-delay' as string]: '140ms' }}>
            <b className="font-semibold text-white">
              {fmt(miles)} {unit}
            </b>{' '}
            at{' '}
            <b className="font-semibold text-white">{cpp != null ? formatValue(cpp) : '—'}</b>{' '}
            — the best redemption across your {result.balances.length} programs. Cash is{' '}
            <b className="font-semibold text-white">${fmt(cash)}</b>. You have the {unit}.
          </p>
        ) : usingPoints ? (
          <p className="hop-rise mt-6 max-w-[46ch] text-[17px] leading-[1.55] text-hero-body" style={{ ['--hop-delay' as string]: '140ms' }}>
            On this route, {airlineShort} {unit} are worth{' '}
            <b className="font-semibold text-white">{cpp != null ? formatValue(cpp) : '—'}</b>{' '}
            — <b className="font-semibold text-white">{fmt(miles)} {unit}</b> instead of{' '}
            <b className="font-semibold text-white">${fmt(cash)}</b> cash.{' '}
            {isSignedIn
              ? `Add your programs and hop checks if your ${unit} cover it.`
              : `Sign in to check your balances and see if your ${unit} cover it.`}
          </p>
        ) : bestAward ? (
          <p className="hop-rise mt-6 max-w-[46ch] text-[17px] leading-[1.55] text-hero-body" style={{ ['--hop-delay' as string]: '140ms' }}>
            The closest award is{' '}
            <b className="font-semibold text-white">
              {fmt(bestAward.miles)} {milesUnit(bestAward)}
            </b>{' '}
            on {bestAward.program ?? bestAward.airline} — worth just{' '}
            <b className="font-semibold text-white">{formatValue(bestAward.cpp!)}</b>, under the{' '}
            {formatValue(POINTS_THRESHOLD_CPP)} bar where points beat cash. The{' '}
            <b className="font-semibold text-white">${fmt(cash)}</b> fare is the better buy — your{' '}
            {milesUnit(bestAward)} will go further somewhere else.
          </p>
        ) : (
          <p className="hop-rise mt-6 max-w-[46ch] text-[17px] leading-[1.55] text-hero-body" style={{ ['--hop-delay' as string]: '140ms' }}>
            No award seats came back for this route and date, so there was nothing to weigh your
            points against. Cash is <b className="font-semibold text-white">${fmt(cash)}</b> —
            book it and your points stay put.
          </p>
        )}

        {/* Mobile: CTAs stack full-width (a wrapped pill + ragged widths read as
            clutter at 375px); sm+ returns to the inline row. "See the math" is
            the LAST control on purpose — its hop-collapse panel (basis-full,
            immediately after its trigger inside this same flex-wrap container)
            expands directly below the row, so nothing sits between the trigger
            and its panel to visually detach them. */}
        <div className="mt-7 flex flex-col items-stretch gap-3 sm:mt-[34px] sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <a
            href={ctaHref}
            className="inline-flex items-center justify-center gap-[10px] rounded-[14px] bg-white px-7 py-4 text-[16px] font-semibold text-brand-ink transition-colors hover:bg-hero-white-hover"
          >
            <Icon name="check_circle" size={20} weight="fill" />
            {!usingPoints
              ? 'Book cash'
              : owns
                ? `Book with ${airlineShort} ${unit}`
                : isSignedIn
                  ? 'Add your programs'
                  : `Sign in to see if your ${unit} win`}
          </a>
          {/* Add to calendar — the first hop ACTION. Route + dates only; no economics. */}
          {calUrl ? (
            <a
              href={calUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-[8px] rounded-[14px] border-[1.5px] border-white/20 px-7 py-4 text-[15px] font-medium text-hero-body transition-colors hover:border-white/45 hover:text-white"
            >
              <Icon name="calendar" size={16} />
              Add to calendar
            </a>
          ) : null}
          {/* See the math — last; its panel expands below the whole row. */}
          {pick ? (
            <SeeTheMath
              pick={pick}
              cheapestCash={cash}
              threshold={POINTS_THRESHOLD_CPP}
              unit={unit}
              travelers={seats}
            />
          ) : null}
        </div>

        {/* Stat strip — a 2×2 grid on phones so the four figures read as a
            table (flex-wrap gave a ragged 3+1 line); sm+ returns to the flex row. */}
        <div className="hop-rise mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/15 pt-6 sm:mt-8 sm:flex sm:flex-wrap sm:gap-10 sm:pt-7 lg:mt-[42px] lg:pt-[30px]" style={{ ['--hop-delay' as string]: '220ms' }}>
          <HStat label="You pay" value={fmt(miles)} unit={unit} />
          <HStat label="Value" value={cpp != null ? formatValue(cpp) : '—'} />
          <HStat label="Cash price" value={`$${fmt(cash)}`} />
          {/* The accent stat ticks in LOCKSTEP with the headline (same value,
              same delay/duration) — one figure moving in two places reads as
              one system. Only this stat counts; four counters is a slot machine. */}
          <HStat
            label="You save"
            value={usingPoints ? <CountUp value={save} format="usd" delayMs={420} /> : `$${fmt(save)}`}
            accent
          />
        </div>

        {seats > 1 ? (
          <p className="mt-3 text-[12px] font-medium text-hero-label">
            Totals for {seats} travelers.
          </p>
        ) : null}

        {/* Affiliate CTA — only on a points-winning verdict, never on cash. Maps
            the winning award's program to the card that earns its currency; renders
            nothing if no card maps. Clearly labelled "Sponsored". */}
        {usingPoints ? <CardAffiliateCTA program={pick?.program} unit={unit} /> : null}

        {/* Watch this route — only on the pay-cash path ("Points don't pay off
            here"): the clearest, unambiguous use case for a standing order. hop
            re-runs THIS exact route/date/cabin and pings the day it crosses
            POINTS_THRESHOLD_CPP. */}
        {!usingPoints ? (
          <WatchThisRoute
            params={result.params}
            threshold={POINTS_THRESHOLD_CPP}
            isSignedIn={isSignedIn}
            signInHref={signInHref}
            live={watchLive}
          />
        ) : null}
      </div>

      {/* RIGHT — destination photo filling the panel, boarding-pass pick over it */}
      <aside
        className="relative flex flex-col justify-between overflow-hidden border-t border-dashed border-white/20 lg:border-l lg:border-t-0"
        style={{ background: 'var(--color-brand-deep)' }}
      >
        {/* destination photo — the place you're heading — fills the WHOLE panel,
            including behind the pass. A scrim sits ONLY at the bottom (under the
            pass) for legibility; the open upper area stays vivid, not faded.
            Falls back to the bunny mark when no photo is available. */}
        {destPhoto ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={destPhoto.url}
              alt={destPhoto.alt}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            />
            {/* top scrim — a whisper of brand-ink at the very top edge so the
                photo settles into the teal field instead of reading as a pasted
                rectangle. Integration, not decoration; the upper photo stays vivid. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[22%]"
              style={{
                background:
                  'linear-gradient(to bottom, rgba(7,62,62,0.42) 0%, rgba(7,62,62,0) 100%)',
              }}
            />
            {/* bottom scrim — sits under the boarding pass for legibility. Anchored
                deep enough that the pass reads with authority against the photo. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[56%]"
              style={{
                background:
                  'linear-gradient(to bottom, rgba(7,62,62,0) 0%, rgba(7,62,62,0.58) 52%, rgba(7,62,62,0.9) 100%)',
              }}
            />
          </>
        ) : (
          <div className="hidden flex-1 place-items-center pt-9 lg:grid">
            <Logo size={172} carve="var(--color-brand-deep)" className="text-white" />
          </div>
        )}

        {pick ? (
          <div className="relative z-10 mt-auto">
            <PickPass pick={pick} />
          </div>
        ) : null}
      </aside>
    </section>
  )
}

function HStat({
  label,
  value,
  unit,
  accent,
}: {
  label: string
  value: React.ReactNode
  unit?: string
  accent?: boolean
}) {
  return (
    <div>
      <div className="mb-[6px] text-[11px] font-semibold uppercase tracking-[var(--track-label)] text-hero-label">
        {label}
      </div>
      <div className={`hop-price text-[27px] ${accent ? 'text-mint-bright' : 'text-white'}`}>
        {value}
        {unit ? <small className="text-[14px] font-medium text-hero-eyebrow"> {unit}</small> : null}
      </div>
    </div>
  )
}

// Boarding-pass card for the pick — a real ticket: airline + flight no, the
// itinerary as origin/time — dur nonstop — dest/time, and a cabin/aircraft/fare
// detail row. Notched ticket edge. Airline name appears once.
function PickPass({ pick }: { pick: FlightOption }) {
  const [routeFrom, routeTo] = pick.route.split('→').map((s) => s.trim())
  const origin = pick.originCode ?? routeFrom
  const dest = pick.destCode ?? routeTo
  const dur =
    pick.durationMin != null
      ? `${Math.floor(pick.durationMin / 60)}h ${pick.durationMin % 60}m`
      : ''
  const stopLabel =
    pick.stops === 0 || pick.direct
      ? 'nonstop'
      : pick.stops != null
        ? `${pick.stops} stop${pick.stops > 1 ? 's' : ''}`
        : ''

  // Compact detail row: cabin · aircraft · fare brand (only present ones).
  const details = [pick.cabin, pick.aircraft, pick.fareBrand].filter(Boolean)

  return (
    <div
      className="relative mx-4 mb-5 mt-5 rounded-[18px] bg-paper text-text sm:mx-[26px] sm:mb-[26px] sm:mt-6 lg:mt-0"
      style={{
        // True perforation: punch two semicircle notches out of the LEFT and
        // RIGHT edges at the dashed line (~50% down) so whatever is behind the
        // pass — the destination photo — shows through the holes. Radial-gradient
        // masks subtract the circles; transparent inside the 9px radius, opaque
        // (the pass) everywhere else.
        WebkitMaskImage:
          'radial-gradient(circle 9px at 0% 50%, transparent 9px, #000 10px), radial-gradient(circle 9px at 100% 50%, transparent 9px, #000 10px)',
        maskImage:
          'radial-gradient(circle 9px at 0% 50%, transparent 9px, #000 10px), radial-gradient(circle 9px at 100% 50%, transparent 9px, #000 10px)',
        WebkitMaskComposite: 'source-in',
        maskComposite: 'intersect',
      }}
    >
      {/* header band: airline + flight no + Direct tag */}
      <div className="flex items-center justify-between px-[22px] pb-[14px] pt-[18px]">
        <div className="flex min-w-0 items-center gap-[11px]">
          <BrandIcon code={pick.airlineCode} name={pick.airline} size={40} />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-tight">{pick.airline}</div>
            <div className="text-[11.5px] text-text3">
              {pick.flightNo}
              {pick.operatedBy ? ` · ${pick.operatedBy}` : ''}
            </div>
          </div>
        </div>
        {stopLabel === 'nonstop' ? (
          <span className="flex-shrink-0 rounded-lg bg-brand-light px-[10px] py-[5px] text-[11px] font-semibold uppercase tracking-[var(--track-tag)] text-brand">
            Direct
          </span>
        ) : null}
      </div>

      {/* dashed tear line between the notches (the notches themselves are masked
          out of the card edges above, so the photo shows through them) */}
      <div className="mx-[22px] border-t-[1.5px] border-dashed border-border" />

      {/* itinerary */}
      <div className="flex items-center justify-between gap-3 px-[22px] pb-[16px] pt-[16px]">
        <div className="flex-shrink-0">
          <div className="font-display text-[22px] font-semibold leading-none">{origin}</div>
          {pick.departTime ? (
            <div className="mt-[3px] text-[12px] text-text3">{pick.departTime}</div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col items-center gap-[2px]">
          <div className="flex w-full items-center gap-[6px] text-brand">
            <span className="h-px flex-1 bg-border" />
            <span aria-hidden className="text-[15px] font-semibold leading-none">→</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="text-[11px] text-text3">
            {dur}
            {dur && stopLabel ? ' · ' : ''}
            {stopLabel}
          </div>
        </div>

        <div className="flex-shrink-0 text-right">
          <div className="font-display text-[22px] font-semibold leading-none">{dest}</div>
          {pick.arriveTime ? (
            <div className="mt-[3px] text-[12px] text-text3">{pick.arriveTime}</div>
          ) : null}
        </div>
      </div>

      {/* detail row: cabin · aircraft · fare */}
      {details.length > 0 ? (
        <div className="border-t border-border px-[22px] py-[11px] text-[11.5px] text-text2">
          {details.join(' · ')}
        </div>
      ) : null}
    </div>
  )
}
