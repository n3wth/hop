import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth0 } from '@/lib/auth0'
import { isCheckoutEnabled } from '@/lib/env'
import { getCheckoutOffer, freshOfferForRoute } from '@/lib/duffel-orders'
import { pointsBookingUrl } from '@/lib/booking'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import Icon, { type IconName } from '@/components/Icon'
import CheckoutForm from '@/components/checkout/CheckoutForm'

// Private, transactional page — keep it out of the index. (template adds "· hop".)
export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
}

// Rebuild the results URL from the route params we carried into checkout, so the
// user can step back to the search they came from without losing their trip.
function resultsHref(route: {
  from?: string
  to?: string
  depart?: string
  return?: string
  adults?: number
}): string | null {
  if (!route.from || !route.to || !route.depart) return null
  const p = new URLSearchParams({ from: route.from, to: route.to, depart: route.depart })
  if (route.return) p.set('return', route.return)
  if (route.adults && route.adults > 1) p.set('adults', String(route.adults))
  return `/search?${p.toString()}`
}

// Native cash checkout. Gated: when checkout is off, the search CTA never links
// here, but a direct visit still degrades to a calm "coming soon" notice rather
// than crashing. searchParams is a Promise in Next 16 — awaited here.
export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await auth0.getSession()
  if (!session) redirect('/auth/login?returnTo=/book')

  const su = session.user
  const user = {
    initial: (su.name ?? su.email ?? 'U').trim().charAt(0).toUpperCase(),
    name: su.name ?? undefined,
    email: su.email ?? undefined,
    picture: su.picture ?? undefined,
  }

  const q = await searchParams
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const offerId = str(q.offer)
  const route = {
    from: str(q.from),
    to: str(q.to),
    depart: str(q.depart),
    return: str(q.return),
    adults: q.adults ? parseInt(str(q.adults) ?? '1', 10) : 1,
  }
  const hasRoute = !!(route.from && route.to && route.depart)
  const backHref = resultsHref(route)

  return (
    <AppShell user={user} hideSearch>
      <div className="mx-auto max-w-[1040px] pb-4 pt-8 sm:pt-12">
        {backHref ? (
          <a
            href={backHref}
            className="mb-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text2 transition-colors hover:text-text"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 -960 960 960"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="m313-440 196 196q12 12 11.5 28T508-188q-12 11-28 11.5T452-188L188-452q-6-6-8.5-13t-2.5-15q0-8 2.5-15t8.5-13l264-264q12-12 28.5-11.5T508-771q11 12 11.5 28T508-715L313-520h447q17 0 28.5 11.5T800-480q0 17-11.5 28.5T760-440H313Z" />
            </svg>
            Back to results
          </a>
        ) : null}
        {!isCheckoutEnabled() ? (
          <Notice
            icon="schedule"
            title="Checkout coming soon"
            body="Booking flights right here in hop is almost ready. For now, use the cash deep-link from the results page."
          />
        ) : !offerId ? (
          <Notice
            icon="error"
            title="No flight selected"
            body="Start from a search and choose a cash fare to book it here."
            cta={{ href: '/search', label: 'Find a flight' }}
          />
        ) : (
          <OfferGate
            offerId={offerId}
            route={hasRoute ? (route as { from: string; to: string; depart: string; return?: string; adults?: number }) : undefined}
            email={su.email ?? undefined}
            name={su.name ?? undefined}
          />
        )}
        <SiteFooter />
      </div>
    </AppShell>
  )
}

// Re-fetch the offer server-side (fresh price) before showing the form. Duffel
// offers expire within minutes, so the id from the results page is usually dead
// by checkout — when it is, we transparently create a FRESH offer for the same
// route so the user can still book, instead of bouncing them back to search.
async function OfferGate({
  offerId,
  route,
  email,
  name,
}: {
  offerId: string
  route?: { from: string; to: string; depart: string; return?: string; adults?: number }
  email?: string
  name?: string
}) {
  let res = await getCheckoutOffer(offerId)
  // Stale/expired id → rebuild a live offer from the route (if we have it).
  if (!res.ok && route) {
    res = await freshOfferForRoute(route)
  }
  if (!res.ok) {
    return (
      <Notice
        icon="schedule"
        title="This fare just moved"
        body="Prices change minute to minute. Run the search again to grab a fresh price."
        cta={{ href: route ? resultsHref(route) ?? '/search' : '/search', label: 'Search again' }}
      />
    )
  }

  // International gate: some routes require passport / identity documents per
  // passenger before Duffel will book. We can't collect those yet, so don't send
  // the user down a guaranteed-fail path — point them to the airline instead.
  // (Full per-passenger passport UI is a followup.)
  if (res.data.passengerIdentityDocumentsRequired) {
    return (
      <Notice
        icon="info"
        title="Book this route with the airline"
        body="This route needs passport details we can't collect yet. Book it directly with the airline to finish."
        cta={{
          href: pointsBookingUrl({ airlineCode: res.data.airlineCode, program: res.data.airline }),
          label: `Continue on ${res.data.airline}`,
        }}
      />
    )
  }

  return <CheckoutForm offer={res.data} defaultEmail={email} defaultName={name} />
}

function Notice({
  icon,
  title,
  body,
  cta,
}: {
  icon: IconName
  title: string
  body: string
  cta?: { href: string; label: string }
}) {
  return (
    <div className="mx-auto mt-2 max-w-[560px]">
      <div className="flex items-start gap-4 rounded-[18px] border border-border bg-surface px-6 py-7 sm:px-7">
        <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-[12px] bg-brand-light text-brand">
          <Icon name={icon} size={22} />
        </span>
        <div className="min-w-0">
          <div className="font-display text-[18px] font-semibold tracking-[-0.01em] text-text">
            {title}
          </div>
          <p className="mt-1.5 max-w-[54ch] text-[14px] leading-[1.55] text-text2">{body}</p>
          {cta ? (
            <a
              href={cta.href}
              {...(/^https?:/.test(cta.href)
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
              className="mt-5 inline-flex items-center gap-2 rounded-[11px] border-[1.5px] border-text bg-transparent px-4 py-[9px] text-[14px] font-semibold text-text transition-colors hover:bg-text hover:text-white"
            >
              {cta.label}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
