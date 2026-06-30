import 'server-only'
import { Duffel } from '@duffel/api'
import type {
  ApiResult,
  CheckoutOffer,
  CheckoutPassenger,
  CheckoutSegment,
  OrderResult,
} from '@/lib/types'
import { env, hasEnv } from '@/lib/env'
import { farePolicyFromConditions } from '@/lib/booking'

// Native cash booking via the Duffel Orders API. SERVER ONLY (reads the secret
// TEST token). NEVER throws — every function returns ApiResult so the page can
// degrade gracefully. Builds against TEST mode exclusively: the client is keyed
// with DUFFEL_API_KEY_TEST (duffel_test_…), never the live key. The token's
// prefix is what puts Duffel in test vs live mode, so using the test token means
// no real money and no real bookings.
//
// End-to-end flow (per duffel.com/docs/guides/paying-with-customer-cards):
//   1. offers.get(id)                         — re-price a fresh, unexpired offer
//   2. identity.componentClientKeys.create()  — client key for the card form
//   3. <DuffelCardForm> (client)              — collects card → temp card id
//   4. createThreeDSecureSession (client)     — 3DS → three_d_secure_session_id
//   5. orders.create({ type:'instant', payments:[{ type:'balance' }] })
//   6. orders.get(id)                         — confirmation (booking_reference)
//
// PAYMENT SETTLEMENT — why `balance`, not `card`: the v2 Orders API only accepts
// payments[].type of 'balance' | 'arc_bsp_cash' on orders.create. A customer
// card settles via a SEPARATE pay_later order + POST /air/payments with a 3DS
// session — a two-step hold lifecycle. In TEST mode the Duffel balance is
// unlimited, so we run the real hosted card form + 3DS for the genuine UX, then
// book the instant order against the test balance. No live key, no real money.
// To go live on real card capture: switch to a pay_later order and call
// duffel.payments.create({ order_id, payment: { type:'card', three_d_secure_session_id } }).

// Lazy singleton — instantiated at call time so importing this module never
// throws when the token is absent (the page degrades to "not configured").
let _duffel: Duffel | null = null
function duffel(): Duffel | null {
  if (!hasEnv('DUFFEL_API_KEY_TEST')) return null
  if (!_duffel) _duffel = new Duffel({ token: env.duffelTestApiKey() })
  return _duffel
}

// Duffel SDK surfaces failures as thrown DuffelError with an `errors` array
// ({ type, title, message, code }). Pull the most human message out of it.
function reasonFrom(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { errors?: Array<{ message?: string; title?: string }>; message?: string }
    const first = e.errors?.[0]
    if (first?.message) return first.message
    if (first?.title) return first.title
    if (e.message) return e.message
  }
  return 'Duffel request failed'
}

// --- mappers: raw SDK shape -> our flat checkout contract ------------------

interface RawSegment {
  origin?: { iata_code?: string }
  destination?: { iata_code?: string }
  departing_at?: string
  arriving_at?: string
  marketing_carrier?: { name?: string; iata_code?: string }
  marketing_carrier_flight_number?: string
}
interface RawSlice {
  origin?: { iata_code?: string }
  destination?: { iata_code?: string }
  segments?: RawSegment[]
}
interface RawOffer {
  id: string
  total_amount: string
  total_currency: string
  expires_at?: string
  passenger_identity_documents_required?: boolean
  passengers?: Array<{ id: string; type?: string }>
  owner?: { name?: string; iata_code?: string }
  slices?: RawSlice[]
  // Offer-level change/cancel rules. Shape validated in farePolicyFromConditions.
  conditions?: unknown
}

function mapSegments(slices: RawSlice[] | undefined): CheckoutSegment[] {
  const segs: CheckoutSegment[] = []
  for (const slice of slices ?? []) {
    for (const s of slice.segments ?? []) {
      segs.push({
        origin: s.origin?.iata_code,
        destination: s.destination?.iata_code,
        departingAt: s.departing_at,
        arrivingAt: s.arriving_at,
        marketingCarrier: s.marketing_carrier?.name,
        flightNumber: s.marketing_carrier_flight_number
          ? `${s.marketing_carrier?.iata_code ?? ''} ${s.marketing_carrier_flight_number}`.trim()
          : undefined,
      })
    }
  }
  return segs
}

function routeOf(slices: RawSlice[] | undefined): string {
  const first = slices?.[0]
  const origin = first?.origin?.iata_code ?? first?.segments?.[0]?.origin?.iata_code ?? '—'
  const last = slices?.[slices.length - 1]
  const dest =
    last?.destination?.iata_code ??
    last?.segments?.[last.segments.length - 1]?.destination?.iata_code ??
    '—'
  return `${origin} → ${dest}`
}

function toCheckoutOffer(offer: RawOffer): CheckoutOffer {
  const segments = mapSegments(offer.slices)
  const owner = offer.owner
  return {
    id: offer.id,
    totalAmount: offer.total_amount,
    totalCurrency: offer.total_currency,
    expiresAt: offer.expires_at,
    passengerIdentityDocumentsRequired: Boolean(offer.passenger_identity_documents_required),
    passengers: (offer.passengers ?? []).map((p) => ({ id: p.id, type: p.type })),
    airline: owner?.name ?? segments[0]?.marketingCarrier ?? 'Airline',
    airlineCode: owner?.iata_code,
    route: routeOf(offer.slices),
    segments,
    passengerCount: offer.passengers?.length ?? 1,
    farePolicy: farePolicyFromConditions(offer.conditions),
  }
}

// --- public API ------------------------------------------------------------

// Re-fetch a single offer to get a fresh price right before payment. Duffel
// offers expire (`expires_at`); a 404/expired offer surfaces as {ok:false} so
// the page can prompt a re-search.
export async function getCheckoutOffer(offerId: string): Promise<ApiResult<CheckoutOffer>> {
  const client = duffel()
  if (!client) return { ok: false, reason: 'Checkout is not configured' }
  try {
    const res = await client.offers.get(offerId)
    const offer = res.data as unknown as RawOffer
    if (!offer?.id) return { ok: false, reason: 'Offer not found' }
    return { ok: true, data: toCheckoutOffer(offer) }
  } catch (err) {
    return { ok: false, reason: reasonFrom(err) }
  }
}

export interface FreshOfferRoute {
  from: string
  to: string
  depart: string
  return?: string
  adults?: number
}

// Create a FRESH offer for a route by running a new offer request. Duffel offers
// expire within minutes, so the offer id carried from the search page is usually
// dead by checkout. This rebuilds a live offer so the user can actually book.
// Returns the cheapest current offer for the route. NEVER throws.
export async function freshOfferForRoute(route: FreshOfferRoute): Promise<ApiResult<CheckoutOffer>> {
  const client = duffel()
  if (!client) return { ok: false, reason: 'Checkout is not configured' }
  const adults = Math.max(1, route.adults || 1)
  const slices: Array<{ origin: string; destination: string; departure_date: string }> = [
    { origin: route.from, destination: route.to, departure_date: route.depart },
  ]
  if (route.return) {
    slices.push({ origin: route.to, destination: route.from, departure_date: route.return })
  }
  try {
    // The SDK's slice type demands arrival_time/departure_time, but they're
    // optional in the API (and we don't constrain times). Cast to the create arg.
    const res = await client.offerRequests.create({
      slices,
      passengers: Array.from({ length: adults }, () => ({ type: 'adult' as const })),
      cabin_class: 'economy',
      return_offers: true,
    } as unknown as Parameters<typeof client.offerRequests.create>[0])
    const offers = ((res.data as unknown as { offers?: RawOffer[] })?.offers ?? []).filter(
      (o) => o?.id,
    )
    if (!offers.length) return { ok: false, reason: 'No live fares for this route right now' }
    // Cheapest current offer.
    offers.sort((a, b) => parseFloat(a.total_amount) - parseFloat(b.total_amount))
    return { ok: true, data: toCheckoutOffer(offers[0]) }
  } catch (err) {
    return { ok: false, reason: reasonFrom(err) }
  }
}

// A component client key authenticates the Duffel card form / 3DS session on the
// client. Scoped to nothing (or a user) — the card binds to the offer at the
// component level. Never expose the Duffel token client-side; this key is safe.
export async function createComponentClientKey(): Promise<ApiResult<string>> {
  const client = duffel()
  if (!client) return { ok: false, reason: 'Checkout is not configured' }
  try {
    const res = await client.identity.componentClientKeys.create({})
    const key = (res.data as { component_client_key?: string })?.component_client_key
    if (!key) return { ok: false, reason: 'Could not start a secure payment session' }
    return { ok: true, data: key }
  } catch (err) {
    return { ok: false, reason: reasonFrom(err) }
  }
}

export interface CreateCashOrderInput {
  offerId: string
  passengers: CheckoutPassenger[]
  // From the client 3DS session (status must be ready_for_payment). Captured for
  // the real card UX; in TEST mode the order settles against the test balance.
  threeDSecureSessionId?: string
  // Echoed from the re-priced offer so the payment total exactly matches.
  totalAmount: string
  totalCurrency: string
}

// Create an INSTANT cash order. Settles against the Duffel TEST balance
// (unlimited in test mode) — the hosted card form + 3DS run upstream for the
// genuine card-entry UX. See the SETTLEMENT note at the top of this file.
export async function createCashOrder(
  input: CreateCashOrderInput,
): Promise<ApiResult<OrderResult>> {
  const client = duffel()
  if (!client) return { ok: false, reason: 'Checkout is not configured' }

  const passengers = input.passengers.map((p) => ({
    id: p.id,
    title: p.title,
    given_name: p.givenName,
    family_name: p.familyName,
    born_on: p.bornOn,
    gender: p.gender,
    email: p.email,
    phone_number: p.phoneNumber,
  }))

  const payment = {
    type: 'balance' as const,
    amount: input.totalAmount,
    currency: input.totalCurrency,
  }

  try {
    const res = await client.orders.create({
      type: 'instant',
      selected_offers: [input.offerId],
      passengers,
      payments: [payment],
    })

    const order = res.data as unknown as RawOrder
    return { ok: true, data: toOrderResult(order) }
  } catch (err) {
    return { ok: false, reason: reasonFrom(err) }
  }
}

interface RawOrder {
  id: string
  booking_reference?: string
  total_amount?: string
  total_currency?: string
  owner?: { name?: string; iata_code?: string }
  passengers?: Array<{ given_name?: string; family_name?: string }>
  slices?: RawSlice[]
  // Order-level change/cancel rules. Shape validated in farePolicyFromConditions.
  conditions?: unknown
}

function toOrderResult(order: RawOrder): OrderResult {
  const segments = mapSegments(order.slices)
  return {
    id: order.id,
    bookingReference: order.booking_reference,
    totalAmount: order.total_amount,
    totalCurrency: order.total_currency,
    passengerNames: (order.passengers ?? []).map((p) =>
      `${p.given_name ?? ''} ${p.family_name ?? ''}`.trim(),
    ),
    segments,
    route: routeOf(order.slices),
    airline: order.owner?.name ?? segments[0]?.marketingCarrier ?? 'Airline',
    farePolicy: farePolicyFromConditions(order.conditions),
  }
}

// Fetch a completed order for the confirmation page (booking_reference, etc.).
export async function getOrder(orderId: string): Promise<ApiResult<OrderResult>> {
  const client = duffel()
  if (!client) return { ok: false, reason: 'Checkout is not configured' }
  try {
    const res = await client.orders.get(orderId)
    const order = res.data as unknown as RawOrder
    if (!order?.id) return { ok: false, reason: 'Order not found' }
    return { ok: true, data: toOrderResult(order) }
  } catch (err) {
    return { ok: false, reason: reasonFrom(err) }
  }
}
