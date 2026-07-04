// Shared search assembly. Pulls cash, awards, and balances from upstream
// clients (or mock fixtures when MOCK is set), computes per-option economics,
// ranks by cpp, picks the best redemption, and renders a verdict.
//
// ALWAYS resolves — never throws. Upstream failures degrade gracefully.

import type {
  Balance,
  FlightOption,
  OptionAction,
  SearchParams,
  SearchResult,
} from '@/lib/types'
import { cpp, tier, rankOptions } from '@/lib/cpp'
import { applyPrefs, type TravelPrefs } from '@/lib/prefs-model'
import { transfersTo, effectiveBalanceFor } from '@/lib/transfers'
import { cashBookingUrl, pointsBookingUrl } from '@/lib/booking'
import { isCheckoutEnabled } from '@/lib/env'
import { searchCash } from '@/lib/duffel'
import { searchAwards } from '@/lib/seatsaero'
import { getBalances } from '@/lib/awardwallet'
import { mockCash, mockAwards, mockBalances } from '@/lib/mock'
import { recordCppObservations } from '@/lib/valuation-telemetry'
import { recordDegradation } from '@/lib/degradation-telemetry'
import { canonicalizeProgram } from '@/lib/programs'

export const POINTS_THRESHOLD_CPP = 2.5

function isAward(option: FlightOption): boolean {
  return option.kind === 'award' || option.kind === 'transfer'
}

// Does the user hold this award option's OWN program directly? Canonical match
// via lib/programs.ts (not substring) so "Alaska" matches "Alaska Mileage Plan".
// Returns ONLY a direct holding — transfer reachability is handled separately by
// transfersTo() so the UI can distinguish "book points" from "transfer".
function youHaveFor(option: FlightOption, balances: Balance[]): number | undefined {
  if (!option.program) return undefined
  const eff = effectiveBalanceFor(option.program, balances)
  return eff?.via.kind === 'direct' ? eff.amount : undefined
}

// Optionally accepts pre-resolved per-user balances (manual + AwardWallet merged
// by lib/accounts.getUserBalances). When omitted, falls back to the AwardWallet
// env global via getBalances() — preserving the original behavior for callers
// without a session and for the test suite.
export async function assembleSearch(
  params: SearchParams,
  userBalances?: Balance[],
  prefs?: TravelPrefs,
): Promise<SearchResult> {
  let cashOptions: FlightOption[] = []
  let awardOptions: FlightOption[] = []
  let balances: Balance[] = []
  const degraded: string[] = []

  // MOCK is truthy only for "1"/"true"/"yes" — "0"/"false"/"" all mean live.
  const useMock = /^(1|true|yes)$/i.test(process.env.MOCK ?? '')

  // One seat per adult + child; infants ride as lap infants (no seat, no award
  // miles). Duffel's cash total_amount already covers the WHOLE party
  // (buildPassengers in lib/duffel.ts), while Seats.aero miles/taxes are always
  // per-seat — so award economics are scaled to the same party total below,
  // making both legs of every cpp comparison mean "cost to move everyone".
  const seats = Math.max(1, (params.adults || 1) + Math.max(0, params.children ?? 0))
  if (useMock) {
    // Echo the searched route/date into the fixtures so the cards reflect the
    // query (the fixtures are authored for SFO→LAX; rewrite their route fields).
    const route = `${params.from} → ${params.to}`
    const day = (() => {
      const [y, m, d] = params.depart.split('-').map(Number)
      if (!y || !m || !d) return undefined
      return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    })()
    const reroute = (o: FlightOption): FlightOption => ({
      ...o,
      route,
      originCode: params.from,
      destCode: params.to,
      date: day ?? o.date,
      // mockCash() bakes in a fixed sample bookingUrl (lib/mock.ts's own
      // hardcoded SFO→LAX PARAMS) — without this, a cash CTA on a search for
      // any OTHER route silently deep-links to the wrong airports/date/pax.
      // Award options' bookingUrl (pointsBookingUrl) is program-scoped, not
      // route-scoped, so it's correct as-is and left untouched.
      // Cash fixtures are authored per-seat; live Duffel returns party totals
      // (buildPassengers). Scale so mock and live share the same semantics —
      // otherwise the award scaling below would skew mock cpp for parties > 1.
      ...(o.kind === 'cash'
        ? {
            bookingUrl: cashBookingUrl(params),
            cashPrice: o.cashPrice != null ? o.cashPrice * seats : o.cashPrice,
            taxes: o.taxes != null ? o.taxes * seats : o.taxes,
          }
        : {}),
    })
    cashOptions = mockCash().map(reroute)
    awardOptions = mockAwards().map(reroute)
    // Signed-in user's real balances ground the mock fixtures too; else mock.
    balances = userBalances && userBalances.length > 0 ? userBalances : mockBalances()
  } else {
    // When the caller resolved per-user balances, use them and skip the
    // AwardWallet env-global fetch entirely. Otherwise fall back to getBalances().
    const wantBalances = userBalances === undefined
    const [cashRes, awardsRes, balancesRes] = await Promise.all([
      searchCash(params),
      searchAwards(params),
      wantBalances ? getBalances() : Promise.resolve(null),
    ])

    if (cashRes.ok) cashOptions = cashRes.data
    else degraded.push('cash')

    if (awardsRes.ok) awardOptions = awardsRes.data
    else degraded.push('awards')

    if (balancesRes === null) {
      // Caller supplied balances (possibly empty) — trust them, no degrade.
      balances = userBalances ?? []
    } else if (balancesRes.ok) {
      balances = balancesRes.data
    }
    // else: the env-global AwardWallet fallback failed. This path only runs when
    // NO per-user balances were supplied (signed-out / stateless caller), so the
    // viewer has no connected wallet of their own to refresh — empty is the
    // EXPECTED state, not a stale refresh. We deliberately do NOT push 'balances'
    // here: that degradation ("Couldn't refresh your balances…") is only honest
    // for a signed-in user whose own programs failed to refresh, and a signed-in
    // user's balances always arrive pre-resolved above (balancesRes === null).
  }

  // Cheapest cash price is the baseline for award cpp comparison.
  const cashPrices = cashOptions
    .map((o) => o.cashPrice)
    .filter((p): p is number => p != null && p > 0)
  const cheapestCash = cashPrices.length > 0 ? Math.min(...cashPrices) : undefined

  const cashUrl = cashBookingUrl(params)

  // Native in-app checkout when enabled (the flag AND a Duffel test key, via
  // isCheckoutEnabled(), plus a Duffel offer id on the option). /book is only
  // linked when it can actually transact — otherwise cash deep-links out to the
  // affiliate (Kiwi).
  const checkoutEnabled = isCheckoutEnabled()
  const cashBookUrl = (o: FlightOption): string => {
    if (checkoutEnabled && typeof o.id === 'string' && o.id.startsWith('off_')) {
      // Carry the route too: Duffel offers expire within minutes, so /book may
      // need to re-create a fresh offer request rather than rely on this id.
      const p = new URLSearchParams({ offer: o.id })
      const from = o.originCode ?? params.from
      const to = o.destCode ?? params.to
      if (from) p.set('from', from)
      if (to) p.set('to', to)
      if (params.depart) p.set('depart', params.depart)
      if (params.return) p.set('return', params.return)
      p.set('adults', String(Math.max(1, params.adults || 1)))
      return `/book?${p.toString()}`
    }
    return o.bookingUrl || cashUrl
  }

  // Annotate cash options.
  const cash: FlightOption[] = cashOptions.map((o) => ({
    ...o,
    tier: 'muted',
    bookingUrl: cashBookUrl(o),
    action: 'book-cash',
  }))

  // Annotate award/transfer options: compute cpp vs cheapest cash, tier,
  // youHave from balances, transfer sources, booking URL, and action intent.
  const awards: FlightOption[] = awardOptions.map((o) => {
    // Upstream award miles/taxes are per-seat (Seats.aero never scales by party
    // size); cheapestCash is a party total. Scale the award side to the party
    // so cpp compares like-for-like — for a single seat this is a no-op. The
    // per-seat cpp ratio is preserved: both numerator and denominator scale.
    const partyMiles = o.miles != null ? o.miles * seats : undefined
    const partyTaxes = o.taxes != null ? o.taxes * seats : undefined
    const miles = partyMiles ?? 0
    const taxes = partyTaxes ?? 0
    const value =
      cheapestCash != null && miles > 0
        ? cpp(cheapestCash, taxes, miles)
        : o.cpp
    const optionTier = tier(value)

    // Does the user hold this option's OWN program directly? Decide strictly
    // from balances (program match) — never from a pre-baked o.youHave, which on
    // a transfer row carries the transfer SOURCE balance, not a direct holding.
    const directBalance = youHaveFor(o, balances)
    const holdsDirectly = directBalance != null && directBalance > 0
    const ownBalance = directBalance ?? o.youHave

    // Can the user reach this program by transferring from another balance?
    const transferFrom = o.program ? transfersTo(o.program, balances) : undefined
    const canTransfer = transferFrom != null && transferFrom.length > 0

    // Kind: holding the program directly is an award booking; otherwise, if it's
    // only reachable via a transfer partner, it's a transfer play.
    const kind: FlightOption['kind'] = holdsDirectly
      ? 'award'
      : canTransfer
        ? 'transfer'
        : o.kind

    // Weak value: points aren't worth it. Either the tier is muted (cpp < 1.5),
    // or the cpp is below the 2.0 "not worth points" line and there's a cheaper
    // cash option to fall back to.
    const weakValue =
      optionTier === 'muted' ||
      (value != null && value < 2.0 && cheapestCash != null)

    // Action intent:
    // - weak value → steer to cash (ghost)
    // - hold the program → book points directly
    // - only reachable via partner → transfer
    // - otherwise book points
    let action: OptionAction
    let bookingUrl = o.bookingUrl
    if (weakValue) {
      action = 'pay-cash'
      bookingUrl = cashUrl
    } else if (holdsDirectly) {
      action = 'book-points'
    } else if (canTransfer) {
      action = 'transfer'
    } else {
      action = 'book-points'
    }

    return {
      ...o,
      miles: partyMiles,
      taxes: partyTaxes,
      cpp: value,
      tier: optionTier,
      youHave: ownBalance,
      kind,
      transferFrom: canTransfer ? transferFrom : o.transferFrom,
      action,
      bookingUrl:
        bookingUrl ||
        pointsBookingUrl({ airlineCode: o.airlineCode, program: o.program }),
    }
  })

  recordCppObservations(
    awards
      .filter((o) => o.program && typeof o.cpp === 'number' && o.cpp > 0)
      .map((o) => ({
        programId: canonicalizeProgram(o.program!)?.id ?? '',
        cpp: o.cpp!,
        cashCents: cheapestCash != null ? Math.round(cheapestCash * 100) : undefined,
        miles: o.miles,
      }))
      .filter((s) => s.programId !== ''),
  )

  // Collapse the raw API dump to ONE best option per program/airline, then cap.
  // Live sources return hundreds of near-duplicate offers (every fare/time);
  // a useful tool shows the best of each, not the firehose.
  const bestPer = <T extends FlightOption>(
    items: T[],
    keyOf: (o: T) => string,
    better: (a: T, b: T) => T,
  ): T[] => {
    const m = new Map<string, T>()
    for (const o of items) {
      const k = keyOf(o)
      const cur = m.get(k)
      m.set(k, cur ? better(cur, o) : o)
    }
    return [...m.values()]
  }

  // Award: best CPP per loyalty program (fall back to fewest miles when cpp ties/missing).
  const bestAwards = bestPer(
    awards,
    (o) => o.program ?? o.airline,
    (a, b) => {
      const ca = a.cpp ?? -1
      const cb = b.cpp ?? -1
      if (cb !== ca) return cb > ca ? b : a
      return (b.miles ?? Infinity) < (a.miles ?? Infinity) ? b : a
    },
  )
  // Cash: cheapest per airline.
  const bestCash = bestPer(
    cash,
    (o) => o.airline,
    (a, b) => ((b.cashPrice ?? Infinity) < (a.cashPrice ?? Infinity) ? b : a),
  )

  const MAX_AWARDS = 6 // top award/transfer redemptions by value
  const MAX_CASH = 2 // cheapest cash baselines
  // Full best-per-program awards ranked by cpp; `options` shows only the top
  // MAX_AWARDS, but `allAwards` (below) carries the whole set for tool consumers.
  const rankedAwards = rankOptions(bestAwards)
  const trimmedAwards = rankedAwards.slice(0, MAX_AWARDS)
  const trimmedCash = bestCash
    .sort((a, b) => (a.cashPrice ?? Infinity) - (b.cashPrice ?? Infinity))
    .slice(0, MAX_CASH)

  // cpp ranking first (rankOptions), THEN the user's natural-language prefs as a
  // filter + tiebreaker ON TOP (lib/prefs-model.applyPrefs). Default (no prefs)
  // = today's behavior: applyPrefs is a no-op on empty prefs. The pick is read
  // off this list below, so the verdict respects prefs too.
  const options = applyPrefs(rankOptions([...trimmedAwards, ...trimmedCash]), prefs)

  // pick = best redemption (highest cpp award/transfer); else cheapest cash.
  const bestAward = options.find(isAward)
  let pick: FlightOption | undefined
  if (bestAward) {
    pick = bestAward
  } else if (cash.length > 0) {
    pick = cash.reduce((cheapest, o) =>
      (o.cashPrice ?? Infinity) < (cheapest.cashPrice ?? Infinity) ? o : cheapest,
    )
  }

  // verdict
  let verdict: SearchResult['verdict']
  if (!pick) {
    verdict = 'none'
  } else if (isAward(pick) && (pick.cpp ?? 0) >= POINTS_THRESHOLD_CPP) {
    verdict = 'use-points'
  } else {
    verdict = 'pay-cash'
  }

  const usingPoints = pick != null && isAward(pick)
  const summary: SearchResult['summary'] = {
    cheapestCash,
    bestMiles: usingPoints ? pick?.miles : undefined,
    bestCpp: usingPoints ? pick?.cpp : undefined,
    saveVsCash:
      usingPoints && cheapestCash != null
        ? Math.round(cheapestCash - (pick?.taxes ?? 0))
        : 0,
  }

  // Cheapest cash option (with its real bookingUrl) — the "Book cash" CTA needs
  // this on a pay-cash verdict, since `pick` may be a weak award row.
  const cashOption =
    cash.length > 0
      ? cash.reduce((cheapest, o) =>
          (o.cashPrice ?? Infinity) < (cheapest.cashPrice ?? Infinity) ? o : cheapest,
        )
      : undefined

  // Self-improvement telemetry (ADR 0007): record which sources degraded this
  // LIVE search — fire-and-forget (void, gated, never throws), so it cannot
  // alter degraded[], the verdict, or anything else in the result. Mirrors
  // the recordCppObservations hook above; mock runs never record.
  if (!useMock && degraded.length > 0) {
    recordDegradation(degraded, { from: params.from, to: params.to })
  }

  return {
    params,
    options,
    allAwards: rankedAwards,
    pick,
    cashOption,
    verdict,
    summary,
    balances,
    degraded,
  }
}

// A compact, LLM/tool-friendly trim of a SearchResult: the decision-relevant
// fields only (verdict, summary, the pick, up to 6 options), dropping internal
// booking URLs and tiers a caller can't act on. This is the SAME assembleSearch
// call the app itself makes for /search — the single verdict shape shared by
// every non-UI caller (the MCP "Add to Claude" tools in lib/mcp-tools.ts and the
// in-app /ask concierge tool in lib/concierge-tools.ts), so a live, date-specific
// verdict never diverges between surfaces.
export interface VerdictSummary {
  route: string
  depart: string
  return: string | undefined
  adults: number
  verdict: SearchResult['verdict']
  summary: SearchResult['summary']
  pick: {
    kind: FlightOption['kind']
    airline: string
    program: string | undefined
    cabin: string | undefined
    miles: number | undefined
    taxes: number | undefined
    cashPrice: number | undefined
    cpp: number | undefined
    youHave: number | undefined
  } | null
  options: Array<{
    kind: FlightOption['kind']
    airline: string
    program: string | undefined
    cabin: string | undefined
    miles: number | undefined
    taxes: number | undefined
    cashPrice: number | undefined
    cpp: number | undefined
    action: OptionAction | undefined
  }>
  degraded: string[]
}

export async function verdictSummary(
  params: SearchParams,
  balances: Balance[] = [],
): Promise<VerdictSummary> {
  const result = await assembleSearch(params, balances)
  return {
    route: `${result.params.from} → ${result.params.to}`,
    depart: result.params.depart,
    return: result.params.return,
    adults: result.params.adults,
    verdict: result.verdict,
    summary: result.summary,
    pick: result.pick
      ? {
          kind: result.pick.kind,
          airline: result.pick.airline,
          program: result.pick.program,
          cabin: result.pick.cabin,
          miles: result.pick.miles,
          taxes: result.pick.taxes,
          cashPrice: result.pick.cashPrice,
          cpp: result.pick.cpp,
          youHave: result.pick.youHave,
        }
      : null,
    options: result.options.slice(0, 6).map((o) => ({
      kind: o.kind,
      airline: o.airline,
      program: o.program,
      cabin: o.cabin,
      miles: o.miles,
      taxes: o.taxes,
      cashPrice: o.cashPrice,
      cpp: o.cpp,
      action: o.action,
    })),
    degraded: result.degraded,
  }
}
