// Shared domain contract for hop. The API layer produces these; the UI renders them.
// The UI never branches on data source — every option (cash or award) is one FlightOption.

export type OptionKind = 'cash' | 'award' | 'transfer'
export type CppTier = 'green' | 'amber' | 'muted'
// Explicit action intent, decided in lib/search.ts so the UI renders, not decides.
export type OptionAction = 'book-points' | 'transfer' | 'book-cash' | 'pay-cash'

export interface SearchParams {
  from: string // IATA, e.g. SFO
  to: string // IATA, e.g. LAX
  depart: string // ISO date
  return?: string // ISO date (round trip)
  adults: number
}

// One bookable option, normalized across every upstream source.
export interface FlightOption {
  id: string
  kind: OptionKind
  airline: string // display name, e.g. "Alaska Atmos"
  airlineCode?: string // IATA, e.g. "AS" — drives the monogram tile
  program?: string // loyalty program for award/transfer, e.g. "Alaska Atmos Rewards"
  route: string // "SFO → LAX"
  date: string // display, e.g. "Jul 9"
  durationMin?: number
  direct?: boolean
  // richer flight detail for the pick / boarding-pass card
  originCode?: string // "SFO"
  destCode?: string // "LAX"
  originCity?: string // "San Francisco"
  destCity?: string // "Los Angeles"
  departTime?: string // display, e.g. "7:05a"
  arriveTime?: string // display, e.g. "8:37a"
  stops?: number // 0 = nonstop
  cabin?: string // "Economy", "Main", "First"
  aircraft?: string // "Boeing 737-900"
  flightNo?: string // "AS 1284"
  operatedBy?: string // "Alaska / American"
  fareBrand?: string // "Saver", "Main", award fare label
  // award economics
  miles?: number
  taxes?: number // cash taxes/fees paid on an award redemption, in dollars
  // cash economics
  cashPrice?: number // round-trip cash price in dollars
  roundTrip?: boolean
  earn?: number // estimated affiliate commission for cash bookings
  // computed
  cpp?: number // cents per point
  tier: CppTier
  youHave?: number // user's balance in the relevant program
  action?: OptionAction // explicit action intent decided at assembly time
  // transfer
  transferFrom?: TransferSource[]
  bookingUrl: string
  note?: string // e.g. "Dynamic pricing · weak value here"
}

export interface TransferSource {
  source: string // program you transfer FROM, e.g. "Amex MR"
  ratio?: string // e.g. "1:1"
}

export interface Balance {
  program: string // "Amex Membership Rewards"
  code: string // monogram, "AX"
  balance: number
  status?: string // "Transferable", "Silver", etc.
}

// Per-source result wrapper — clients never throw; failures become typed partials.
export type ApiResult<T> = { ok: true; data: T } | { ok: false; reason: string }

// The assembled contract /api/search returns and the page renders.
export interface SearchResult {
  params: SearchParams
  options: FlightOption[] // sorted by cpp desc, pick is options[0] when present
  pick?: FlightOption
  verdict: 'use-points' | 'pay-cash' | 'none'
  summary: {
    cheapestCash?: number
    bestMiles?: number
    bestCpp?: number
    saveVsCash?: number
  }
  balances: Balance[]
  degraded: string[] // sources that failed: e.g. ['awards']
}
