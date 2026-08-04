import { withDb } from '@/lib/supabase-helpers'
import type { Booking, CheckoutOffer, OrderResult } from '@/lib/types'

// Booking persistence via withDb to Neon (lib/supabase-helpers.ts, server-only).
// Identity is Better Auth's user.id, so every query is scoped by user_id in
// code. All functions degrade gracefully — never throw to the page.

const TABLE = 'hop_bookings'

// Snapshot of the offer/order kept on the row so /account renders a trip card
// without re-fetching Duffel. Stored as jsonb in offer_snapshot.
interface OfferSnapshot {
  route?: string
  airline?: string
  date?: string
}

function snapshotDate(offer: CheckoutOffer): string | undefined {
  const dep = offer.segments[0]?.departingAt
  if (!dep) return undefined
  const d = new Date(dep)
  if (isNaN(d.getTime())) return undefined
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// Persist a successful order, keyed by the Better Auth user.id. Returns the new row
// id, or null on any failure (the confirmation page still renders from the
// order result — persistence is best-effort).
export async function saveBooking(
  userId: string,
  order: OrderResult,
  offer: CheckoutOffer,
): Promise<string | null> {
  return withDb<string | null>(null, async (db) => {
    const snapshot: OfferSnapshot = {
      route: order.route || offer.route,
      airline: order.airline || offer.airline,
      date: snapshotDate(offer),
    }
    const { data, error } = await db
      .from(TABLE)
      .insert({
        user_id: userId,
        duffel_order_id: order.id,
        booking_reference: order.bookingReference ?? null,
        offer_snapshot: snapshot as unknown as Record<string, unknown>,
        total_amount: order.totalAmount ?? offer.totalAmount,
        total_currency: order.totalCurrency ?? offer.totalCurrency,
        status: 'confirmed',
      })
      .select('id')
      .maybeSingle()
    if (error || !data) return null
    return data.id as string
  })
}

// Ownership check for the confirmation page: returns the user's booking row for
// a given Duffel order id, or null when it isn't theirs (or doesn't exist). The
// query is scoped by user_id so an attacker-supplied order id belonging to
// another user never matches. Never throws.
export async function getBookingByOrderId(
  userId: string,
  orderId: string,
): Promise<Booking | null> {
  return withDb<Booking | null>(null, async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select(
        'id, duffel_order_id, booking_reference, offer_snapshot, total_amount, total_currency, status, created_at',
      )
      .eq('user_id', userId)
      .eq('duffel_order_id', orderId)
      .maybeSingle()
    if (error || !data) return null
    const snap = (data.offer_snapshot ?? {}) as OfferSnapshot
    return {
      id: data.id as string,
      duffelOrderId: (data.duffel_order_id as string) ?? undefined,
      bookingReference: (data.booking_reference as string) ?? undefined,
      totalAmount: (data.total_amount as string) ?? undefined,
      totalCurrency: (data.total_currency as string) ?? undefined,
      status: (data.status as string) ?? undefined,
      createdAt: (data.created_at as string) ?? undefined,
      route: snap.route,
      airline: snap.airline,
      date: snap.date,
    }
  })
}
