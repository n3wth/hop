import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { gatherOpsPreflight, countPreflightIssues } from '@/lib/admin-ops'

// gatherOpsPreflight is a pure read over process.env (lazy, at call time) —
// drive it with env mutations and assert the row semantics: drift = flag on
// with missing keys, warn = a seam launch needs attention on, off = dark.

const TOUCHED = [
  'HOP_ENABLE_BILLING',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID_PRO_MONTHLY',
  'CRON_SECRET',
  'BETTER_AUTH_SECRET',
  'AUTH_SECRET',
  'DATABASE_URL',
  'MOCK',
] as const

const saved: Record<string, string | undefined> = {}
for (const k of TOUCHED) saved[k] = process.env[k]

beforeEach(() => {
  for (const k of TOUCHED) delete process.env[k]
})

afterAll(() => {
  for (const k of TOUCHED) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

function row(seam: string) {
  const r = gatherOpsPreflight().find((r) => r.seam === seam)
  if (!r) throw new Error(`missing preflight row: ${seam}`)
  return r
}

describe('gatherOpsPreflight', () => {
  it('flags drift when a flag is on but its keys are missing', () => {
    process.env.HOP_ENABLE_BILLING = '1'
    const r = row('Billing (Stripe)')
    expect(r.status).toBe('drift')
    expect(r.detail).toContain('STRIPE_SECRET_KEY')
  })

  it('reads on when a flag is on with all keys present', () => {
    process.env.HOP_ENABLE_BILLING = '1'
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x'
    process.env.STRIPE_PRICE_ID_PRO_MONTHLY = 'price_x'
    expect(row('Billing (Stripe)').status).toBe('on')
  })

  it('warns on missing CRON_SECRET (crons fail closed in production)', () => {
    expect(row('Cron auth').status).toBe('warn')
    process.env.CRON_SECRET = 's3cret'
    expect(row('Cron auth').status).toBe('on')
  })

  it('auth secret: explicit → on, derived-from-DATABASE_URL → warn, neither → drift', () => {
    expect(row('Auth secret').status).toBe('drift')
    process.env.DATABASE_URL = 'postgres://x'
    expect(row('Auth secret').status).toBe('warn')
    process.env.BETTER_AUTH_SECRET = 'explicit'
    expect(row('Auth secret').status).toBe('on')
  })

  it('MOCK on reads as warn, off as on (live upstreams)', () => {
    expect(row('Mock fixtures').status).toBe('on')
    process.env.MOCK = '1'
    expect(row('Mock fixtures').status).toBe('warn')
  })

  it('countPreflightIssues counts drift + warn only', () => {
    expect(
      countPreflightIssues([
        { seam: 'a', status: 'on', detail: '' },
        { seam: 'b', status: 'off', detail: '' },
        { seam: 'c', status: 'drift', detail: '' },
        { seam: 'd', status: 'warn', detail: '' },
      ]),
    ).toBe(2)
  })

  it('never throws and returns a stable seam set', () => {
    const rows = gatherOpsPreflight()
    expect(rows.length).toBeGreaterThanOrEqual(10)
    for (const r of rows) {
      expect(['on', 'off', 'drift', 'warn']).toContain(r.status)
      expect(r.detail.length).toBeGreaterThan(0)
    }
  })
})
