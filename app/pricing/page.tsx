import { getUserId } from '@/lib/session'
import { getSessionNavUser } from '@/lib/nav-user'
import { getUserTier } from '@/lib/subscription'
import { countActiveStandingOrders } from '@/lib/standing-orders'
import { isBillingEnabled } from '@/lib/env'
import { PRO_PRICE_YEARLY_USD } from '@/lib/pricing'
import { BillingSection } from '@/components/BillingSection'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import { pageMeta } from '@/lib/seo'

export const metadata = pageMeta({
  title: 'Pricing',
  description: `hop's verdict is free, always. Pro adds unlimited alerts and a bigger agent quota for $${PRO_PRICE_YEARLY_USD}/yr — early price, grandfathered for life.`,
  path: '/pricing',
})

const BILLING_ERROR_COPY: Record<string, string> = {
  bot: 'That didn’t look like a real request — try again from the page.',
  unavailable: 'Billing isn’t available yet.',
  'rate-limited': 'One moment — try again shortly.',
  stripe: 'Couldn’t reach billing — try again in a minute.',
  'no-customer': 'Upgrade first — there’s no billing account to manage yet.',
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

  return (
    <AppShell user={navUser} hideSearch>
      <div className="mx-auto max-w-[var(--container-shell)] pb-16 pt-8 sm:pt-12">
        <div className="max-w-[560px]">
          <p className="text-[11px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-text3">
            Pricing
          </p>
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
          <p className="mt-6 max-w-[560px] rounded-[12px] border border-border bg-sunk px-4 py-2.5 text-[13px] font-medium text-text2">
            {errorNote}
          </p>
        ) : null}

        <div className="mt-8">
          {billingEnabled ? (
            <BillingSection isSignedIn={!!userId} tier={tier} activeCount={activeCount} />
          ) : (
            <p className="rounded-[var(--radius)] border border-border bg-sunk px-5 py-4 text-[13.5px] text-text2">
              hop is free for everyone right now — a paid plan isn&apos;t live yet.
            </p>
          )}
        </div>

        <SiteFooter />
      </div>
    </AppShell>
  )
}
