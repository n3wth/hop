import { describe, it, expect } from 'vitest'
import {
  getUserTier,
  recordSubscription,
  stripeCustomerIdFor,
  saveStripeCustomer,
} from '@/lib/subscription'

// Without DATABASE_URL every withDb call resolves its fallback — the graceful-
// degradation contract for the money path: reads say 'free'/null, writes say
// they failed, and NOTHING throws. (The happy-path write mapping is covered by
// lib/__tests__/billing.test.ts's pure extractor + the webhook route's shape.)
describe('subscription write path — degrades, never throws, without a DB', () => {
  const record = {
    subscriptionId: 'sub_123',
    priceId: 'price_pro_monthly',
    status: 'active',
    currentPeriodStart: '2026-07-01T00:00:00.000Z',
    currentPeriodEnd: '2026-08-01T00:00:00.000Z',
    cancelAtPeriodEnd: false,
  }

  it('recordSubscription → db-error (retryable) when storage is unavailable', async () => {
    const outcome = await recordSubscription({
      userId: 'user_1',
      stripeCustomerId: 'cus_123',
      record,
    })
    expect(outcome).toBe('db-error')
  })

  it('recordSubscription → no-attribution on missing ids (permanent, no retry)', async () => {
    expect(
      await recordSubscription({ userId: null, stripeCustomerId: '', record }),
    ).toBe('no-attribution')
    expect(
      await recordSubscription({
        userId: 'user_1',
        stripeCustomerId: 'cus_123',
        record: { ...record, subscriptionId: '' },
      }),
    ).toBe('no-attribution')
  })

  it('reads fall back cleanly: getUserTier → free, stripeCustomerIdFor → null', async () => {
    expect(await getUserTier('user_1')).toBe('free')
    expect(await getUserTier('')).toBe('free')
    expect(await stripeCustomerIdFor('user_1')).toBeNull()
    expect(await stripeCustomerIdFor('')).toBeNull()
  })

  it('saveStripeCustomer reports failure (never throws) without a DB', async () => {
    expect(await saveStripeCustomer('user_1', 'cus_123')).toBe(false)
    expect(await saveStripeCustomer('', 'cus_123')).toBe(false)
  })
})
