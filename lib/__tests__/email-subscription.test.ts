import { describe, it, expect, afterEach } from 'vitest'
import { sendAlertEmail, renderAlertEmail, isEmailEnabled } from '@/lib/email'
import { getUserTier, getAlertLimit, ALERT_LIMITS } from '@/lib/subscription'
import type { StandingOrderAlert } from '@/lib/standing-order-alerts'

// Two seams, both GATED + graceful:
//  - lib/email: NO-OPS when RESEND_API_KEY is absent (never throws, never sends);
//    renders subject/body straight from engine-computed alert fields.
//  - lib/subscription: tier read defaults to 'free' (no billing yet), and
//    ALERT_LIMITS encodes the cap the create action enforces.
// Both must run in the test env with no real keys / no Supabase configured.

function alert(over: Partial<StandingOrderAlert> = {}): StandingOrderAlert {
  return {
    id: 'al_1',
    standingOrderId: 'so_1',
    route: 'SFO → TYO',
    pick: {
      id: 'a1',
      kind: 'award',
      airline: 'ANA',
      program: 'ANA Mileage Club',
      route: 'SFO → TYO',
      date: 'Mar 25',
      miles: 75000,
      taxes: 50,
      cpp: 3.1,
      tier: 'green',
      bookingUrl: 'https://example.com/book',
    },
    cpp: 3.1,
    fingerprint: 'fp',
    delivered: false,
    seen: false,
    ...over,
  }
}

// Keep the env clean — these tests assert the UNCONFIGURED path. Restore after.
const ORIGINAL_KEY = process.env.RESEND_API_KEY
afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.RESEND_API_KEY
  else process.env.RESEND_API_KEY = ORIGINAL_KEY
})

describe('lib/email — gated on RESEND_API_KEY', () => {
  it('isEmailEnabled() is false when the key is absent', () => {
    delete process.env.RESEND_API_KEY
    expect(isEmailEnabled()).toBe(false)
  })

  it('sendAlertEmail() no-ops with reason "unconfigured" when the key is absent — never throws, never sends', async () => {
    delete process.env.RESEND_API_KEY
    const res = await sendAlertEmail('user@example.com', alert())
    expect(res).toEqual({ ok: false, reason: 'unconfigured' })
  })

  it('still no-ops (unconfigured) before validating the recipient', async () => {
    delete process.env.RESEND_API_KEY
    // Even with a bad recipient, the config gate is checked first.
    const res = await sendAlertEmail('', alert())
    expect(res).toEqual({ ok: false, reason: 'unconfigured' })
  })

  it('rejects an invalid recipient when configured (without sending real mail)', async () => {
    process.env.RESEND_API_KEY = 're_test_fake_key'
    const res = await sendAlertEmail('not-an-email', alert())
    expect(res).toEqual({ ok: false, reason: 'invalid-recipient' })
  })
})

describe('renderAlertEmail — facts only, from engine fields', () => {
  it('renders an on-brand subject with route, rate, and program', () => {
    const { subject } = renderAlertEmail(alert())
    expect(subject).toBe('Award space opened: SFO → TYO at 3.1¢/pt via ANA Mileage Club')
  })

  it('puts the computed cpp + miles in the body and links the booking url', () => {
    const { text, html } = renderAlertEmail(alert())
    expect(text).toContain('3.1¢/pt')
    expect(text).toContain('75,000 pts')
    expect(text).toContain('https://example.com/book')
    expect(html).toContain('SFO')
    expect(html).toContain('href="https://example.com/book"')
  })

  it('never fabricates a number: omits the rate when cpp is missing', () => {
    const a = alert({ cpp: undefined, pick: { ...alert().pick, cpp: undefined } })
    const { subject, text } = renderAlertEmail(a)
    expect(subject).not.toContain('¢/pt')
    expect(text).not.toContain('¢/pt')
    // Route still present.
    expect(subject).toContain('SFO → TYO')
  })

  it('escapes html-sensitive characters from engine strings', () => {
    const a = alert({ route: 'A<b> & "c"' , pick: { ...alert().pick, route: 'A<b> & "c"' } })
    const { html } = renderAlertEmail(a)
    expect(html).not.toContain('<b>')
    expect(html).toContain('&lt;b&gt;')
  })
})

describe('lib/subscription — tier read + cap', () => {
  it('ALERT_LIMITS caps free at 3 and leaves premium unbounded', () => {
    expect(ALERT_LIMITS.free).toBe(3)
    expect(ALERT_LIMITS.premium).toBe(Infinity)
  })

  it('getUserTier defaults to "free" when no subscription row / DB is configured', async () => {
    await expect(getUserTier('auth0|nobody')).resolves.toBe('free')
  })

  it('getUserTier returns "free" for an empty user id (never throws)', async () => {
    await expect(getUserTier('')).resolves.toBe('free')
  })

  it('getAlertLimit resolves the free cap (3) by default', async () => {
    await expect(getAlertLimit('auth0|nobody')).resolves.toBe(3)
  })
})

// Mirror the create-action's cap arithmetic so the boundary is regression-locked
// independent of Auth0/Supabase wiring: at/above the limit blocks; below allows.
describe('free-tier alert cap arithmetic (mirrors the create action)', () => {
  function atCap(activeCount: number, limit: number): boolean {
    if (!Number.isFinite(limit)) return false
    return activeCount >= limit
  }

  it('blocks the 4th active watch on free (limit 3)', () => {
    expect(atCap(3, ALERT_LIMITS.free)).toBe(true)
    expect(atCap(4, ALERT_LIMITS.free)).toBe(true)
  })

  it('allows up to the 3rd active watch on free', () => {
    expect(atCap(0, ALERT_LIMITS.free)).toBe(false)
    expect(atCap(2, ALERT_LIMITS.free)).toBe(false)
  })

  it('never blocks premium (unbounded)', () => {
    expect(atCap(1000, ALERT_LIMITS.premium)).toBe(false)
  })
})
