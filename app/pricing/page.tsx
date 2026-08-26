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
import { pageMeta, absoluteUrl } from '@/lib/seo'

// Billing is flag-gated (isBillingEnabled()) — the page body already branches on it
// (BillingSection vs. the "not live yet" note). Metadata must branch the same way:
// a static `export const metadata` would advertise $PRO_PRICE_YEARLY_USD/yr in the
// <head>/social preview even while billing is off, regardless of what the body renders.
export async function generateMetadata() {
  const description = isBillingEnabled()
    ? `hop's verdict is free, always. Pro adds unlimited alerts and a bigger agent quota for $${PRO_PRICE_YEARLY_USD}/yr — early price, grandfathered for life.`
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
      a: `Yes — hop's points-vs-cash verdict is free for everyone, always, with no signup required. The Free plan includes full search, the computed verdict, and ${ALERT_LIMITS.free} active route alerts.`,
    },
    {
      q: 'What does hop Pro cost?',
      a: billingEnabled
        ? `Pro is $${PRO_PRICE_YEARLY_USD}/yr — an early-adopter price that's grandfathered for life. It's billed annually with no monthly option yet.`
        : `Pro isn't live yet — hop's paid plan hasn't launched, so there's nothing to buy right now. Search and the verdict stay free either way.`,
    },
    {
      q: "What's the difference between Free and Pro?",
      a: `Free includes ${ALERT_LIMITS.free} active alerts and ${MCP_DAILY_LIMITS.free} MCP calls/day for agents. Pro adds unlimited alerts, ${MCP_DAILY_LIMITS.premium.toLocaleString()} MCP calls/day, and a weekly best-redemption digest.`,
    },
    {
      q: 'What is an MCP call?',
      a: `hop exposes its verdict engine as an MCP server, so AI agents like Claude can price trips and check your balances directly. Each tool call an agent makes counts against your daily MCP quota.`,
    },
  ]
}

// FAQPage JSON-LD — same posture as lib/seo.ts#buildJsonLd and
// app/guides/point-value/page.tsx#buildPointValueJsonLd: no user input flows
// in, so JSON.stringify alone keeps it XSS-safe.
function buildPricingJsonLd(billingEnabled: boolean) {
  const url = absoluteUrl('/pricing')
  const faq = {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: pricingFaq(billingEnabled).map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }
  return { '@context': 'https://schema.org', '@graph': [faq] }
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
            {userId ? 'Your plan' : 'Free to search. Pay to watch.'}
          </h1>
          <p className="mt-3 text-[14.5px] leading-[1.6] text-text2">
            hop&apos;s points-vs-cash verdict is free for everyone, always — computed, never
            behind a paywall. Pro adds unlimited route watches and a bigger MCP quota for
            agents.
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
        <section className="mt-14 max-w-[560px]">
          <h2 className="font-display text-[20px] font-semibold leading-tight tracking-[-0.01em] text-text">
            Questions
          </h2>
          <div className="mt-4 divide-y divide-hair border-y border-border">
            {faq.map((item) => (
              <details key={item.q} className="group py-3.5">
                <summary className="cursor-pointer list-none text-[14.5px] font-semibold text-text marker:content-none">
                  {item.q}
                </summary>
                <p className="mt-2 text-[13.5px] leading-[1.6] text-text2">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <SiteFooter />
      </div>
    </AppShell>
  )
}
