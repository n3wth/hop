import { describe, expect, it } from 'vitest'
import {
  mrrFromSubscriptionRows,
  PRO_PRICE_MONTHLY_USD,
  PRO_PRICE_YEARLY_USD,
  readInfraCostMonthlyUsd,
  readLlmCostMonthlyUsd,
} from '@/lib/unit-economics'
import * as pricing from '@/lib/pricing'

// The prices used to estimate MRR here must be the SAME numbers the
// checkout/pricing UI displays — they used to be a second hand-typed pair
// ($99/yr) that drifted from the real $49/yr launch price (business plan
// §3.1, addendum). lib/unit-economics.ts now re-exports lib/pricing.ts's
// constants instead of declaring its own; this pins that they stay identical.
describe('unit-economics prices — sourced from lib/pricing.ts, not a second number', () => {
  it('re-exports the single source of truth verbatim', () => {
    expect(PRO_PRICE_YEARLY_USD).toBe(pricing.PRO_PRICE_YEARLY_USD)
    expect(PRO_PRICE_MONTHLY_USD).toBe(pricing.PRO_PRICE_MONTHLY_USD)
  })

  it('the launch price is $49/yr, not the category-floor $99 it was mistakenly reading', () => {
    expect(PRO_PRICE_YEARLY_USD).toBe(49)
  })
})

describe('mrrFromSubscriptionRows', () => {
  it('sums monthly and yearly subs at list prices', () => {
    const { mrrUsd, count } = mrrFromSubscriptionRows(
      [
        { stripePriceId: 'price_monthly' },
        { stripePriceId: 'price_monthly' },
        { stripePriceId: 'price_yearly' },
      ],
      'price_monthly',
      'price_yearly',
    )
    expect(count).toBe(3)
    expect(mrrUsd).toBe(
      Math.round((PRO_PRICE_MONTHLY_USD * 2 + PRO_PRICE_YEARLY_USD / 12) * 100) / 100,
    )
  })

  it('ignores unknown price ids', () => {
    const { mrrUsd, count } = mrrFromSubscriptionRows(
      [{ stripePriceId: 'price_unknown' }],
      'price_monthly',
      'price_yearly',
    )
    expect(count).toBe(0)
    expect(mrrUsd).toBe(0)
  })
})

describe('readInfraCostMonthlyUsd', () => {
  it('falls back to default when env unset', () => {
    const prev = process.env.HOP_INFRA_COST_MONTHLY_USD
    delete process.env.HOP_INFRA_COST_MONTHLY_USD
    expect(readInfraCostMonthlyUsd()).toBe(75)
    if (prev) process.env.HOP_INFRA_COST_MONTHLY_USD = prev
  })
})

describe('readLlmCostMonthlyUsd', () => {
  it('returns null when env unset', () => {
    const prev = process.env.HOP_LLM_COST_MONTHLY_USD
    delete process.env.HOP_LLM_COST_MONTHLY_USD
    expect(readLlmCostMonthlyUsd()).toBeNull()
    if (prev) process.env.HOP_LLM_COST_MONTHLY_USD = prev
  })

  it('parses valid numeric env override', () => {
    const prev = process.env.HOP_LLM_COST_MONTHLY_USD
    process.env.HOP_LLM_COST_MONTHLY_USD = '42.50'
    expect(readLlmCostMonthlyUsd()).toBe(42.5)
    if (prev) process.env.HOP_LLM_COST_MONTHLY_USD = prev
    else delete process.env.HOP_LLM_COST_MONTHLY_USD
  })
})
