import { redirect } from 'next/navigation'
import { auth0 } from '@/lib/auth0'
import { isCheckoutEnabled } from '@/lib/env'
import { getCheckoutOffer, freshOfferForRoute } from '@/lib/duffel-orders'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import Icon, { type IconName } from '@/components/Icon'
import CheckoutForm from '@/components/checkout/CheckoutForm'

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

  return (
    <AppShell user={user} hideSearch>
      <div className="mx-auto max-w-[1040px] pb-4 pt-8 sm:pt-12">
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
        body={`${res.reason}. Run the search again to grab a fresh price.`}
        cta={{ href: '/search', label: 'Search again' }}
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
