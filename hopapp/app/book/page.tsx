import { redirect } from 'next/navigation'
import { auth0 } from '@/lib/auth0'
import { isCheckoutEnabled } from '@/lib/env'
import { getCheckoutOffer } from '@/lib/duffel-orders'
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
  const offerId = Array.isArray(q.offer) ? q.offer[0] : q.offer

  return (
    <AppShell user={user} hideSearch>
      <div className="mx-auto max-w-[860px] pb-4 pt-8 sm:pt-12">
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
          <OfferGate offerId={offerId} email={su.email ?? undefined} />
        )}
        <SiteFooter />
      </div>
    </AppShell>
  )
}

// Re-fetch the offer server-side (fresh price) before showing the form. An
// expired/invalid offer degrades to a re-search prompt — Duffel offers expire.
async function OfferGate({ offerId, email }: { offerId: string; email?: string }) {
  const res = await getCheckoutOffer(offerId)
  if (!res.ok) {
    return (
      <Notice
        icon="schedule"
        title="This fare expired"
        body={`${res.reason}. Fares move fast — run the search again to grab a fresh price.`}
        cta={{ href: '/search', label: 'Search again' }}
      />
    )
  }
  return <CheckoutForm offer={res.data} defaultEmail={email} />
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
    <div className="mt-2 flex items-start gap-4 rounded-[16px] border border-border bg-surface px-6 py-7">
      <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-[12px] bg-brand-light text-brand">
        <Icon name={icon} size={22} />
      </span>
      <div className="min-w-0">
        <div className="font-display text-[17px] font-semibold text-text">{title}</div>
        <p className="mt-1 max-w-[54ch] text-[14px] leading-[1.55] text-text2">{body}</p>
        {cta ? (
          <a
            href={cta.href}
            className="mt-4 inline-flex items-center gap-2 rounded-[11px] border-[1.5px] border-text bg-transparent px-4 py-[9px] text-[14px] font-semibold text-text transition-colors hover:bg-text hover:text-white"
          >
            {cta.label}
          </a>
        ) : null}
      </div>
    </div>
  )
}
