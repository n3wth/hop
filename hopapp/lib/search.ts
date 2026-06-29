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
import { transfersTo } from '@/lib/transfers'
import { cashBookingUrl, pointsBookingUrl } from '@/lib/booking'
import { searchCash } from '@/lib/duffel'
import { searchAwards } from '@/lib/seatsaero'
import { getBalances } from '@/lib/awardwallet'
import { mockCash, mockAwards, mockBalances } from '@/lib/mock'

const POINTS_THRESHOLD_CPP = 2.5

function isAward(option: FlightOption): boolean {
  return option.kind === 'award' || option.kind === 'transfer'
}

// Match a user's balance to an award option's program (tolerant substring match).
function youHaveFor(option: FlightOption, balances: Balance[]): number | undefined {
  const program = option.program?.toLowerCase().trim()
  if (!program) return undefined
  const hit = balances.find((b) => {
    const p = b.program.toLowerCase()
    return p.includes(program) || program.includes(p)
  })
  return hit?.balance
}

export async function assembleSearch(params: SearchParams): Promise<SearchResult> {
  let cashOptions: FlightOption[] = []
  let awardOptions: FlightOption[] = []
  let balances: Balance[] = []
  const degraded: string[] = []

  // MOCK is truthy only for "1"/"true"/"yes" — "0"/"false"/"" all mean live.
  const useMock = /^(1|true|yes)$/i.test(process.env.MOCK ?? '')
  if (useMock) {
    cashOptions = mockCash()
    awardOptions = mockAwards()
    balances = mockBalances()
  } else {
    const [cashRes, awardsRes, balancesRes] = await Promise.all([
      searchCash(params),
      searchAwards(params),
      getBalances(),
    ])

    if (cashRes.ok) cashOptions = cashRes.data
    else degraded.push('cash')

    if (awardsRes.ok) awardOptions = awardsRes.data
    else degraded.push('awards')

    if (balancesRes.ok) balances = balancesRes.data
    else degraded.push('balances')
  }

  // Cheapest cash price is the baseline for award cpp comparison.
  const cashPrices = cashOptions
    .map((o) => o.cashPrice)
    .filter((p): p is number => p != null && p > 0)
  const cheapestCash = cashPrices.length > 0 ? Math.min(...cashPrices) : undefined

  const cashUrl = cashBookingUrl(params)

  // Annotate cash options.
  const cash: FlightOption[] = cashOptions.map((o) => ({
    ...o,
    tier: 'muted',
    bookingUrl: o.bookingUrl || cashUrl,
    action: 'book-cash',
  }))

  // Annotate award/transfer options: compute cpp vs cheapest cash, tier,
  // youHave from balances, transfer sources, booking URL, and action intent.
  const awards: FlightOption[] = awardOptions.map((o) => {
    const miles = o.miles ?? 0
    const taxes = o.taxes ?? 0
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
  const trimmedAwards = rankOptions(bestAwards).slice(0, MAX_AWARDS)
  const trimmedCash = bestCash
    .sort((a, b) => (a.cashPrice ?? Infinity) - (b.cashPrice ?? Infinity))
    .slice(0, MAX_CASH)

  const options = rankOptions([...trimmedAwards, ...trimmedCash])

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

  return {
    params,
    options,
    pick,
    verdict,
    summary,
    balances,
    degraded,
  }
}
