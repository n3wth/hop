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

// --- Native cash checkout (Duffel Orders) ----------------------------------

// A passenger as collected by the checkout form, mapped to Duffel's required
// fields. `id` matches the offer's passenger id (echoed back at order creation).
export interface CheckoutPassenger {
  id: string // Duffel offer passenger id, e.g. "pas_..."
  title: 'mr' | 'ms' | 'mrs' | 'miss'
  givenName: string
  familyName: string
  bornOn: string // ISO date "YYYY-MM-DD"
  gender: 'm' | 'f'
  email: string
  phoneNumber: string // E.164, e.g. "+14155550100"
}

// A re-priced, fresh offer — what the checkout page renders before payment.
// Mapped from Duffel's offers.get so the UI never touches the raw SDK shape.
export interface CheckoutOffer {
  id: string
  totalAmount: string // e.g. "254.30"
  totalCurrency: string // ISO 4217, e.g. "USD" / "GBP"
  expiresAt?: string // ISO 8601 — offers expire; re-search past this
  passengerIdentityDocumentsRequired: boolean
  passengers: Array<{ id: string; type?: string }>
  airline: string
  airlineCode?: string
  route: string // "SFO → LAX"
  segments: CheckoutSegment[]
  passengerCount: number
  farePolicy?: FarePolicy // change/cancel rules; absent when the airline gave none
}

export interface CheckoutSegment {
  origin?: string
  destination?: string
  departingAt?: string
  arrivingAt?: string
  marketingCarrier?: string
  flightNumber?: string
}

// Whether a fare can be refunded / changed before departure, and the penalty if
// any — mapped from Duffel's offer/order `conditions`. `allowed` is tri-state:
// the airline may give no info, in which case it stays undefined (we never
// guess). When allowed with a fee, `penaltyAmount` carries it in `penaltyCurrency`.
export interface FareRule {
  allowed?: boolean // undefined = airline gave no info
  penaltyAmount?: string // e.g. "100.00" — only meaningful when allowed
  penaltyCurrency?: string // ISO 4217, e.g. "USD"
}

export interface FarePolicy {
  refundable: FareRule
  changeable: FareRule
}

// A persisted booking — what /account renders under "Trips".
export interface Booking {
  id: string
  duffelOrderId?: string
  bookingReference?: string // PNR
  totalAmount?: string
  totalCurrency?: string
  status?: string
  createdAt?: string
  // From offer_snapshot — enough to render a trip card without re-fetching.
  route?: string
  airline?: string
  date?: string
}

// The order result returned to the confirmation page after orders.create.
export interface OrderResult {
  id: string
  bookingReference?: string
  totalAmount?: string
  totalCurrency?: string
  passengerNames: string[]
  segments: CheckoutSegment[]
  route: string
  airline: string
  farePolicy?: FarePolicy // change/cancel rules; absent when the airline gave none
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
  // Cheapest cash option (with its real bookingUrl) — the "Book cash" CTA target
  // when the verdict is pay-cash, since `pick` may still be a weak award option.
  cashOption?: FlightOption
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
