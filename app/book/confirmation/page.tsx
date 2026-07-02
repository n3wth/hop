import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth0 } from '@/lib/auth0'
import { getOrder } from '@/lib/duffel-orders'
import { getBookingByOrderId } from '@/lib/bookings'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import Icon from '@/components/Icon'
import FarePolicyCard from '@/components/checkout/FarePolicyCard'

// Private, per-user confirmation — keep it out of the index. (template adds "· hop".)
export const metadata: Metadata = {
  title: 'Booking confirmed',
  robots: { index: false, follow: false },
}

// Booking confirmation — shows the PNR / booking reference, itinerary, total.
// searchParams is a Promise in Next 16.
export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await auth0.getSession()
  if (!session) redirect('/login')

  const su = session.user
  const user = {
    initial: (su.name ?? su.email ?? 'U').trim().charAt(0).toUpperCase(),
    name: su.name ?? undefined,
    email: su.email ?? undefined,
    picture: su.picture ?? undefined,
  }

  const q = await searchParams
  const orderId = Array.isArray(q.order) ? q.order[0] : q.order
  // Ownership gate: only load the order if it belongs to THIS user (verified
  // against hop_bookings, scoped by sub). Prevents IDOR — substituting another
  // user's Duffel order id must not reveal their passenger PII.
  const owned = orderId ? await getBookingByOrderId(su.sub, orderId) : null
  const res =
    orderId && owned
      ? await getOrder(orderId)
      : { ok: false as const, reason: 'No order' }

  return (
    <AppShell user={user} hideSearch>
      <div className="mx-auto max-w-[var(--container-xs)] pb-4 pt-8 sm:pt-12">
        {!res.ok ? (
          <div className="mt-2 flex items-start gap-4 rounded-[16px] border border-border bg-surface px-6 py-7">
            <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-[12px] bg-brand-light text-brand">
              <Icon name="info" size={24} weight="fill" />
            </span>
            <div>
              <div className="font-display text-[17px] font-semibold text-text">
                We couldn’t load that booking
              </div>
              <p className="mt-1 text-[14px] text-text2">
                If you just booked, your confirmation is on the way by email. You can also find this
                trip on your account page.
              </p>
              <Link
                href="/account"
                className="mt-4 inline-flex items-center gap-2 rounded-[11px] border-[1.5px] border-text px-4 py-[9px] text-[14px] font-semibold text-text transition-colors hover:bg-text hover:text-white"
              >
                Go to account
              </Link>
            </div>
          </div>
        ) : (
          <Confirmed order={res.data} />
        )}
        <SiteFooter />
      </div>
    </AppShell>
  )
}

function money(amount?: string, currency?: string): string {
  if (!amount) return '—'
  const n = Number(amount)
  if (isNaN(n)) return `${amount} ${currency ?? ''}`.trim()
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency ?? 'USD',
    }).format(n)
  } catch {
    return `${n.toFixed(2)} ${currency ?? ''}`.trim()
  }
}

function timeOf(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

function Confirmed({
  order,
}: {
  order: import('@/lib/types').OrderResult
}) {
  return (
    <>
      {/* hero — teal, matches the verdict system */}
      <section
        className="overflow-hidden rounded-[20px] text-hero-cream lg:rounded-[var(--radius-hero)]"
        style={{ background: 'var(--color-brand)' }}
      >
        <div className="px-6 py-9 sm:px-10">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/20">
            <Icon name="check" size={24} />
          </span>
          <h1 className="mt-5 font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-[34px]">
            You&apos;re booked
          </h1>
          <p className="mt-2 text-[15px] text-hero-body">
            {order.airline} · {order.route}
          </p>

          {order.bookingReference ? (
            <div className="mt-6 inline-flex flex-col rounded-[14px] bg-white/10 px-5 py-3 ring-1 ring-white/15">
              <span className="text-[11px] font-semibold uppercase tracking-[var(--track-label)] text-hero-eyebrow">
                Booking reference
              </span>
              <span className="font-display text-[24px] font-semibold tracking-[var(--track-label)] text-white">
                {order.bookingReference}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      {/* itinerary */}
      <section className="mt-6 rounded-[16px] border border-border bg-surface p-5 sm:p-6">
        <h2 className="font-display text-[15px] font-semibold text-text">Itinerary</h2>
        <div className="mt-4 space-y-4">
          {order.segments.map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-[13.5px]">
              <div>
                <div className="font-display text-[17px] font-semibold leading-none text-text">
                  {s.origin ?? '—'}
                </div>
                <div className="mt-1 text-[11.5px] text-text3">{timeOf(s.departingAt)}</div>
              </div>
              <div className="flex flex-1 flex-col items-center text-brand">
                <Icon name="flight" size={16} className="rotate-90" />
                {s.flightNumber ? (
                  <span className="mt-0.5 text-[10.5px] text-text3">{s.flightNumber}</span>
                ) : null}
              </div>
              <div className="text-right">
                <div className="font-display text-[17px] font-semibold leading-none text-text">
                  {s.destination ?? '—'}
                </div>
                <div className="mt-1 text-[11.5px] text-text3">{timeOf(s.arrivingAt)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* passengers + total */}
      <section className="mt-4 rounded-[16px] border border-border bg-surface p-5 sm:p-6">
        {order.passengerNames.length ? (
          <div className="mb-4">
            <div className="text-[12.5px] font-semibold text-text2">Travelers</div>
            <div className="mt-1 text-[14px] text-text">{order.passengerNames.join(', ')}</div>
          </div>
        ) : null}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-[13.5px] text-text2">Total paid</span>
          <span className="font-display text-[22px] font-semibold tracking-[-0.01em] text-text">
            {money(order.totalAmount, order.totalCurrency)}
          </span>
        </div>
      </section>

      {/* change/cancel policy */}
      <FarePolicyCard policy={order.farePolicy} airline={order.airline} className="mt-4" />

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/account#trips"
          className="inline-flex items-center gap-2 rounded-[12px] bg-brand px-5 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-brand-deep"
        >
          View my trips
        </Link>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 rounded-[12px] border-[1.5px] border-text px-5 py-3 text-[14px] font-semibold text-text transition-colors hover:bg-text hover:text-white"
        >
          Book another flight
        </Link>
      </div>
    </>
  )
}
