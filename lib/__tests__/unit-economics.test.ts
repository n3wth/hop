import { describe, expect, it } from 'vitest'
import {
  mrrFromSubscriptionRows,
  PRO_PRICE_MONTHLY_USD,
  PRO_PRICE_YEARLY_USD,
  readInfraCostMonthlyUsd,
} from '@/lib/unit-economics'

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
