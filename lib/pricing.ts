// Canonical hop Pro pricing — the SINGLE source every billing surface reads
// from (components/BillingSection.tsx, app/pricing/page.tsx,
// lib/unit-economics.ts's MRR estimate). Before this file existed, the price
// was hand-typed in two places and had drifted ($49/yr displayed vs $99/yr
// assumed for MRR) — see docs/plans/2026-07-04-business-plan.md §3.1 for the
// decision record.
//
// Launch price is $49/yr, annual-only, grandfathered for life; monthly stays
// configured in Stripe (STRIPE_PRICE_ID_PRO_MONTHLY) but hidden from the UI
// until the plan's "raise to $99/yr" gate is met (60+ days of reliable
// alerts, ≥8 programs past the live-valuation sample gate, receipts +
// newsletter shipped). Update this file, not a second hand-typed number, when
// that gate is hit or the Stripe Price objects change.
export const PRO_PRICE_YEARLY_USD = 49
export const PRO_PRICE_MONTHLY_USD = 9.99
