import Link from 'next/link'
import { getUserId } from '@/lib/session'
import { getSessionNavUser } from '@/lib/nav-user'
import { getUserTier, ALERT_LIMITS, MCP_DAILY_LIMITS } from '@/lib/subscription'
import { countActiveStandingOrders } from '@/lib/standing-orders'
import { isBillingEnabled } from '@/lib/env'
import { PRO_PRICE_YEARLY_USD } from '@/lib/pricing'
import { BillingSection } from '@/components/BillingSection'
import Card from '@/components/ui/Card'
import Eyebrow from '@/components/ui/Eyebrow'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import { pageMeta, absoluteUrl, buildWebPageJsonLd, SITE_URL } from '@/lib/seo'

// Billing is flag-gated (isBillingEnabled()) — the page body already branches on it
// (BillingSection vs. the "not live yet" note). Metadata must branch the same way:
// a static `export const metadata` would advertise $PRO_PRICE_YEARLY_USD/yr in the
// <head>/social preview even while billing is off, regardless of what the body renders.
export async function generateMetadata() {
  const description = isBillingEnabled()
    ? `Search and the verdict stay free. Pro is $${PRO_PRICE_YEARLY_USD}/yr for unlimited route alerts — early price, grandfathered.`
    : "hop's verdict is free, always. A paid plan isn't live yet."
  return pageMeta({ title: 'Pricing', description, path: '/pricing' })
}

const BILLING_ERROR_COPY: Record<string, string> = {
  bot: 'That didn’t look like a real request — try again from the page.',
  unavailable: 'Billing isn’t available yet.',
  'rate-limited': 'One moment — try again shortly.',
  stripe: 'Couldn’t reach billing — try again in a minute.',
  'no-customer': 'Upgrade first — there’s no billing account to manage yet.',
}

// FAQ copy, built entirely from lib/pricing.ts + lib/subscription.ts values —
// the single source for both the FAQPage JSON-LD and the visible FAQ section,
// so the two can never drift. The Pro-cost answer branches on
// isBillingEnabled() so the FAQ never claims a plan is purchasable while
// checkout is flag-gated off.
function pricingFaq(billingEnabled: boolean): { q: string; a: string }[] {
  return [
    {
      q: 'Is hop free to use?',
      a: `Yes. Search and the points-vs-cash verdict are free, no signup required. Free includes ${ALERT_LIMITS.free} active route alerts.`,
    },
    {
      q: 'Why pay if search is free?',
      a: `You don't, unless you want more than ${ALERT_LIMITS.free} watches. Pro is the watchlist: hop re-checks your routes and emails you when the miles get cheaper. One missed drop usually costs more than a year of Pro.`,
    },
    {
      q: 'What does hop Pro cost?',
      a: billingEnabled
        ? `Pro is $${PRO_PRICE_YEARLY_USD}/yr, billed once a year. That's the early price, grandfathered for life. No monthly option yet.`
        : `Pro isn't live yet — hop's paid plan hasn't launched, so there's nothing to buy right now. Search and the verdict stay free either way.`,
    },
    {
      q: "What's the difference between Free and Pro?",
      a: `Free: full search, the verdict, and ${ALERT_LIMITS.free} active alerts. Pro: unlimited alerts, a weekly best-redemption digest, and ${MCP_DAILY_LIMITS.premium.toLocaleString()} MCP calls/day if you search from an agent.`,
    },
    {
      q: 'What is an MCP call?',
      a: `hop exposes its verdict engine as an MCP server, so agents like Claude can price trips and check balances. Each tool call counts against the daily quota. Humans on the site don't use this quota.`,
    },
  ]
}

// FAQPage + WebPage JSON-LD — same posture as lib/seo.ts#buildJsonLd and
// app/guides/point-value/page.tsx#buildPointValueJsonLd: no user input flows
// in, so JSON.stringify alone keeps it XSS-safe.
function buildPricingJsonLd(billingEnabled: boolean) {
  const url = absoluteUrl('/pricing')
  const description = billingEnabled
    ? `Search and the verdict stay free. Pro is $${PRO_PRICE_YEARLY_USD}/yr for unlimited route alerts.`
    : "hop's verdict is free, always. A paid plan isn't live yet."
  const faq = {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: pricingFaq(billingEnabled).map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }
  const webPage = {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: 'Pricing · hop',
    description,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: { '@id': `${SITE_URL}/#organization` },
    inLanguage: 'en-US',
  }
  return { '@context': 'https://schema.org', '@graph': [webPage, faq] }
}

// Public pricing surface (business plan §7 B1). Signed-out visitors get the
// pitch + a signup CTA; signed-in visitors get their actual plan and usage.
// New code resolves identity via lib/session.ts#getUserId (CLAUDE.md's
// convention) — only the nav chrome (name/email/picture) still goes through
// the shared auth0-backed getSessionNavUser() helper, since that's existing
// infra every page reuses, not new billing logic.
export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ billingError?: string }>
}) {
  const sp = await searchParams
  const billingEnabled = isBillingEnabled()

  const [userId, navUser] = await Promise.all([getUserId(), getSessionNavUser()])

  const [tier, activeCount] =
    billingEnabled && userId
      ? await Promise.all([getUserTier(userId), countActiveStandingOrders(userId)])
      : (['free', 0] as const)

  const errorNote = sp.billingError ? BILLING_ERROR_COPY[sp.billingError] : undefined
  const faq = pricingFaq(billingEnabled)
  const jsonLd = buildPricingJsonLd(billingEnabled)

  return (
    <AppShell user={navUser} hideSearch>
      <script
        type="application/ld+json"
        // Static, config-sourced JSON-LD only — no user input is interpolated.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-[var(--container-shell)] pb-16 pt-8 sm:pt-12">
        <div className="max-w-[560px]">
          <Eyebrow>Pricing</Eyebrow>
          <h1 className="mt-2 font-display text-[30px] font-semibold tracking-[-0.02em] text-text sm:text-[36px]">
            {userId ? 'Your plan' : `${ALERT_LIMITS.free} watches are free.`}
          </h1>
          <p className="mt-3 text-[14.5px] leading-[1.6] text-text2">
            Search and the points-vs-cash verdict stay free. Pro is the watchlist — hop
            re-checks your routes and emails you when the miles get cheaper.{' '}
            ${PRO_PRICE_YEARLY_USD}/yr, grandfathered.
          </p>
        </div>

        {errorNote ? (
          <Card surface="sunk" radius="md" className="mt-6 max-w-[560px] px-4 py-2.5 text-[13px] font-medium text-text2">
            {errorNote}
          </Card>
        ) : null}

        <div className="mt-8">
          {billingEnabled ? (
            <BillingSection isSignedIn={!!userId} tier={tier} activeCount={activeCount} />
          ) : (
            <Card surface="sunk" className="px-5 py-4 text-[13.5px] text-text2">
              hop is free for everyone right now — a paid plan isn&apos;t live yet.
            </Card>
          )}
        </div>

        {/* Left-aligned on the h1's axis — one editorial axis down the page. */}
        <section className="mt-14 max-w-[560px]" aria-labelledby="faq-heading">
          <h2
            id="faq-heading"
            className="font-display text-[20px] font-semibold leading-tight tracking-[-0.01em] text-text"
          >
            Questions
          </h2>
          <div className="mt-4 divide-y divide-hair border-y border-border">
            {faq.map((item, i) => (
              <details key={item.q} className="group py-3.5">
                <summary
                  className="cursor-pointer list-none text-[14.5px] font-semibold text-text marker:content-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  id={`faq-q-${i}`}
                  aria-controls={`faq-a-${i}`}
                >
                  {item.q}
                </summary>
                <p
                  id={`faq-a-${i}`}
                  className="mt-2 text-[13.5px] leading-[1.6] text-text2"
                  aria-labelledby={`faq-q-${i}`}
                >
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Contact link for questions not covered by the FAQ */}
        <p className="mt-8 max-w-[560px] text-[14px] text-text3">
          Still have questions?{' '}
          <Link
            href="/support"
            className="font-medium text-brand underline decoration-border underline-offset-2 hover:text-brand-deep hover:decoration-brand-deep"
          >
            Visit support
          </Link>{' '}
          or email{' '}
          <a
            href="mailto:hop@n3wth.com"
            className="font-medium text-brand underline decoration-border underline-offset-2 hover:text-brand-deep hover:decoration-brand-deep"
          >
            hop@n3wth.com
          </a>
          .
        </p>

        <SiteFooter />
      </div>
    </AppShell>
  )
}
