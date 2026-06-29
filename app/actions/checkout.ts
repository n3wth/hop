'use server'

import { auth0 } from '@/lib/auth0'
import { isCheckoutEnabled } from '@/lib/env'
import {
  createCashOrder,
  createComponentClientKey,
  getCheckoutOffer,
} from '@/lib/duffel-orders'
import { saveBooking } from '@/lib/bookings'
import type { ApiResult, CheckoutOffer, CheckoutPassenger, OrderResult } from '@/lib/types'

// Re-fetch a fresh, re-priced offer when the held price expires mid-checkout, so
// the client can update the total in place instead of bouncing the user back to
// search. Auth + gate checked here too (never trust the client).
export async function refreshOffer(offerId: string): Promise<ApiResult<CheckoutOffer>> {
  if (!isCheckoutEnabled()) return { ok: false, reason: 'Checkout is not enabled' }
  const session = await auth0.getSession()
  if (!session?.user) return { ok: false, reason: 'Please sign in to book' }
  if (!offerId) return { ok: false, reason: 'Missing offer' }
  return getCheckoutOffer(offerId)
}

// Server actions for native cash checkout. Each re-verifies auth + the checkout
// gate (never trust the client). All return ApiResult — the client renders the
// reason on failure. Gated OFF → every action returns {ok:false} so the UI
// falls back to its "coming soon" state.

// Mint a Duffel component client key so the client can render the hosted card
// form. Auth-gated; returns the JWT-style key (safe to expose, scoped to UI).
export async function startPaymentSession(): Promise<ApiResult<string>> {
  if (!isCheckoutEnabled()) return { ok: false, reason: 'Checkout is not enabled' }
  const session = await auth0.getSession()
  if (!session?.user) return { ok: false, reason: 'Please sign in to book' }
  return createComponentClientKey()
}

export interface PlaceOrderInput {
  offerId: string
  passengers: CheckoutPassenger[]
  threeDSecureSessionId?: string
}

// Create the order, persist it for the user, and return the order result. The
// price is re-fetched from Duffel here (server-side, authoritative) so the
// client can't tamper with the amount we settle. Expired offers surface a clear
// reason prompting a re-search.
export async function placeOrder(input: PlaceOrderInput): Promise<ApiResult<OrderResult>> {
  if (!isCheckoutEnabled()) return { ok: false, reason: 'Checkout is not enabled' }

  const session = await auth0.getSession()
  const sub = session?.user?.sub
  if (!sub) return { ok: false, reason: 'Please sign in to book' }

  if (!input.offerId) return { ok: false, reason: 'Missing offer' }
  if (!input.passengers?.length) return { ok: false, reason: 'Passenger details are required' }

  // Re-price: authoritative amount + currency from a fresh offer fetch.
  const offerRes = await getCheckoutOffer(input.offerId)
  if (!offerRes.ok) return { ok: false, reason: offerRes.reason }
  const offer = offerRes.data

  // Bind each passenger to the offer's passenger ids in order. The form collects
  // N passengers matching the offer's passenger count.
  const passengers: CheckoutPassenger[] = input.passengers.map((p, i) => ({
    ...p,
    id: offer.passengers[i]?.id ?? p.id,
  }))

  const orderRes = await createCashOrder({
    offerId: offer.id,
    passengers,
    threeDSecureSessionId: input.threeDSecureSessionId,
    totalAmount: offer.totalAmount,
    totalCurrency: offer.totalCurrency,
  })
  if (!orderRes.ok) return { ok: false, reason: orderRes.reason }

  // Best-effort persistence — the confirmation still renders if this fails.
  await saveBooking(sub, orderRes.data, offer)

  return { ok: true, data: orderRes.data }
}
