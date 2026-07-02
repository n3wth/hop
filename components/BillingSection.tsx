'use client'

import { useState, useTransition } from 'react'
import type { Tier } from '@/lib/subscription'

export interface BillingSectionProps {
  /** Webhook-written tier truth (lib/subscription.getUserTier). */
  tier: Tier
  /** Engine-computed active-alert count (countActiveStandingOrders). */
  activeCount: number
  /** The free cap, interpolated from ALERT_LIMITS.free — never hardcoded here. */
  freeLimit: number
  /** ?upgraded=1 — the Stripe return flag. DISPLAY ONLY: tier truth still comes
      from the webhook-written row, never from this forgeable redirect param. */
  upgraded: boolean
  /** Whether a yearly price is configured (STRIPE_PRICE_ID_PRO_YEARLY). */
  yearlyAvailable: boolean
}

// The /account "Plan" section — the paywall's missing door. Flat editorial:
// hairline border, no shadows, no bunny (money surface). Every number here is
// computed upstream and passed down: the alert count from the engine, the cap
// from ALERT_LIMITS. The prices are configuration paired to the Stripe Price
// objects (roadmap WS3: $9.99/mo · $99/yr), displayed verbatim, never derived.
// The parent renders this ONLY when isBillingEnabled() — off means no section.
export default function BillingSection({
  tier,
  activeCount,
  freeLimit,
  upgraded,
  yearlyAvailable,
}: BillingSectionProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function upgrade(interval: 'monthly' | 'yearly') {
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ interval }),
        })
        const data = (await res.json()) as { ok?: boolean; url?: string }
        if (data.ok && data.url) {
          // Stripe-hosted Checkout is the money gate — hand the user to it.
          window.location.href = data.url
          return
        }
        setError('Couldn’t reach billing — try again in a minute.')
      } catch {
        setError('Couldn’t reach billing — try again in a minute.')
      }
    })
  }

  const premium = tier === 'premium'

  return (
    <section id="billing" className="mt-10 scroll-mt-24">
      <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-text">
        Plan
      </h2>
      {upgraded ? (
        <p className="mt-3 rounded-[12px] border border-brand-light bg-brand-light px-4 py-2.5 text-[13px] font-medium text-brand-deep">
          You’re on Premium.
        </p>
      ) : null}
      <div className="mt-4 rounded-[var(--radius)] border border-border bg-surface px-5 py-4">
        {premium ? (
          <p className="text-[14px] font-medium text-text">Premium — unlimited alerts.</p>
        ) : (
          <>
            <p className="text-[14px] font-medium text-text">
              Free — {activeCount} of {freeLimit} alerts used.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => upgrade('monthly')}
                disabled={pending}
                className="inline-flex items-center rounded-[12px] bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-70"
              >
                {pending ? 'Opening checkout…' : 'Upgrade — $9.99/mo'}
              </button>
              {yearlyAvailable ? (
                <button
                  type="button"
                  onClick={() => upgrade('yearly')}
                  disabled={pending}
                  className="inline-flex items-center rounded-[12px] border border-border px-5 py-2.5 text-[13.5px] font-semibold text-text transition-colors hover:border-brand hover:text-brand disabled:opacity-70"
                >
                  $99/yr
                </button>
              ) : null}
            </div>
          </>
        )}
        {error ? (
          <p role="alert" className="mt-3 text-[13px] text-text2">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  )
}
