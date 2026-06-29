import { supabaseAdmin } from '@/utils/supabase/admin'
import type { Booking, CheckoutOffer, OrderResult } from '@/lib/types'

// Booking persistence in Supabase via the service-role client (server-only).
// Identity is Auth0, so every query is scoped by user_id in code. All functions
// degrade gracefully — never throw to the page.

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

// Persist a successful order, keyed by the Auth0 user sub. Returns the new row
// id, or null on any failure (the confirmation page still renders from the
// order result — persistence is best-effort).
export async function saveBooking(
  userId: string,
  order: OrderResult,
  offer: CheckoutOffer,
): Promise<string | null> {
  try {
    const db = supabaseAdmin()
    if (!db) return null
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
  } catch {
    return null
  }
}

// All bookings for a user, newest first — rendered under "Trips" on /account.
export async function getBookings(userId: string): Promise<Booking[]> {
  try {
    const db = supabaseAdmin()
    if (!db) return []
    const { data, error } = await db
      .from(TABLE)
      .select(
        'id, duffel_order_id, booking_reference, offer_snapshot, total_amount, total_currency, status, created_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error || !data) return []
    return data.map((row) => {
      const snap = (row.offer_snapshot ?? {}) as OfferSnapshot
      return {
        id: row.id as string,
        duffelOrderId: (row.duffel_order_id as string) ?? undefined,
        bookingReference: (row.booking_reference as string) ?? undefined,
        totalAmount: (row.total_amount as string) ?? undefined,
        totalCurrency: (row.total_currency as string) ?? undefined,
        status: (row.status as string) ?? undefined,
        createdAt: (row.created_at as string) ?? undefined,
        route: snap.route,
        airline: snap.airline,
        date: snap.date,
      }
    })
  } catch {
    return []
  }
}
