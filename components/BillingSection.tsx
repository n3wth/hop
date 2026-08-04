import Card from '@/components/ui/Card'
import Link from 'next/link'
import { isBillingEnabled } from '@/lib/env'
import { ALERT_LIMITS, MCP_DAILY_LIMITS, type Tier } from '@/lib/subscription'
import { PRO_PRICE_YEARLY_USD } from '@/lib/pricing'

interface BillingSectionProps {
  /** Whether the viewer has a session at all — drives the Pro card's CTA
      (sign up vs. upgrade vs. manage billing). */
  isSignedIn: boolean
  /** Defaults to 'free' for a signed-out viewer, who has no real tier. */
  tier?: Tier
  /** Active standing orders against the free cap — only meaningful when
      isSignedIn && tier === 'free'. */
  activeCount?: number
}

const CTA =
  'hop-press inline-flex items-center justify-center gap-1.5 rounded-[var(--radius)] px-5 py-2.5 text-[14px] font-semibold transition-colors'

// The Free/Pro plan-comparison pair — hop's only checkout surface, rendered
// at /pricing (signed-out pitch and signed-in status share this one
// component; /account shows a one-line status instead, see
// app/account/page.tsx). Every cap and price is engine/config-sourced
// (ALERT_LIMITS, MCP_DAILY_LIMITS, PRO_PRICE_YEARLY_USD) — never hand-typed
// here, so this can never drift from what checkout/getUserTier actually
// enforce. Flat editorial: no shadows/gradients, hover is color-only.
export function BillingSection({ isSignedIn, tier = 'free', activeCount = 0 }: BillingSectionProps) {
  if (!isBillingEnabled()) return null
  const isPro = tier === 'premium'

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Card surface="surface" className="p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[18px] font-semibold text-text">Free</h2>
          {isSignedIn && !isPro ? (
            <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold text-text2">
              Your plan
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-[30px] font-semibold leading-none text-text">
          $0<span className="text-[14px] font-normal text-text3">/forever</span>
        </p>
        <ul className="mt-4 space-y-2 text-[13.5px] leading-[1.5] text-text2">
          <li>Full search &amp; verdict</li>
          <li>
            {ALERT_LIMITS.free} active alerts
            {isSignedIn && !isPro ? ` (${activeCount} used)` : ''}
          </li>
          <li>{MCP_DAILY_LIMITS.free} MCP calls/day</li>
        </ul>
      </Card>

      <div className="rounded-[var(--radius)] border border-brand bg-brand-tint p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[18px] font-semibold text-text">Pro</h2>
          {isPro ? (
            <span className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-semibold text-white">
              Your plan
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-[30px] font-semibold leading-none text-text">
          ${PRO_PRICE_YEARLY_USD}
          <span className="text-[14px] font-normal text-text3">/yr</span>
        </p>
        <p className="mt-1 text-[13px] font-medium text-brand-deep">
          Early price — grandfathered for life
        </p>
        <ul className="mt-4 space-y-2 text-[13.5px] leading-[1.5] text-text">
          <li>Unlimited alerts</li>
          <li>{MCP_DAILY_LIMITS.premium.toLocaleString()} MCP calls/day</li>
          <li>Weekly best-redemption digest</li>
        </ul>
        <div className="mt-5">
          {!isSignedIn ? (
            <Link href="/login?returnTo=%2Fpricing" className={`${CTA} bg-brand text-white hover:bg-brand-deep`}>
              Sign up to upgrade
            </Link>
          ) : isPro ? (
            <form action="/api/billing/portal" method="POST">
              <button
                type="submit"
                className={`${CTA} border border-border bg-surface text-text hover:border-brand hover:text-brand`}
              >
                Manage billing
              </button>
            </form>
          ) : (
            <form action="/api/billing/checkout" method="POST">
              <input type="hidden" name="interval" value="yearly" />
              <button type="submit" className={`${CTA} bg-brand text-white hover:bg-brand-deep`}>
                Upgrade to Pro — ${PRO_PRICE_YEARLY_USD}/yr
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
