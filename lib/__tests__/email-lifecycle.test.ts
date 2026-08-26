import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// dispatch()-level behavior needs BOTH seams mocked: the Resend SDK (so no
// real mail can ever leave a test run) and the suppression read (so the gate
// is deterministic without a database). Kept in its own file — vi.mock is
// file-wide, and lib/__tests__/email.test.ts deliberately tests the pure
// renderers with no mocks at all.

const sendMock = vi.hoisted(() => vi.fn())
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

const isSuppressedMock = vi.hoisted(() => vi.fn(async () => false))
vi.mock('@/lib/email-suppressions', () => ({
  isSuppressed: isSuppressedMock,
  recordSuppression: vi.fn(),
}))

import {
  sendWelcomeEmail,
  sendWelcomeEmailFromSignup,
  sendWeeklyDigestEmail,
  sendAlertEmail,
  renderWelcomeEmail,
  renderProWelcomeEmail,
  renderCancellationEmail,
} from '@/lib/email'
import type { LedgerDream } from '@/lib/ledger-dream'
import type { StandingOrderAlert } from '@/lib/standing-order-alerts'

const ORIGINAL_KEY = process.env.RESEND_API_KEY
beforeEach(() => {
  process.env.RESEND_API_KEY = 're_test_fake_key'
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'em_1' }, error: null })
  isSuppressedMock.mockReset()
  isSuppressedMock.mockResolvedValue(false)
})
afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.RESEND_API_KEY
  else process.env.RESEND_API_KEY = ORIGINAL_KEY
})

function dream(): LedgerDream {
  return {
    destination: {
      code: 'NRT',
      city: 'Tokyo',
      country: 'Japan',
      countryCode: 'jp',
      region: 'Asia',
      vibe: 'neon nights',
      tags: [],
      typicalAwardMiles: 60000,
      typicalCashUSD: 1200,
      typicalTaxesUSD: 80,
      bestProgram: 'Alaska Mileage Plan',
      imageHint: 'tokyo skyline',
    },
    milesNeeded: 60000,
    cpp: 3.1,
    cashValue: 1200,
    proof: {
      program: 'Alaska Mileage Plan',
      milesNeeded: 60000,
      path: 'Alaska Mileage Plan (held directly)',
    },
    imageQuery: 'tokyo skyline',
    saveToward: false,
    affordableNow: true,
  }
}

function alert(): StandingOrderAlert {
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
  }
}

describe('dispatch — suppression short-circuit inherited by EVERY sender', () => {
  it('refuses a suppressed recipient with {ok:false, reason:"suppressed"} and never touches Resend', async () => {
    isSuppressedMock.mockResolvedValue(true)
    const res = await sendWelcomeEmail('bounced@example.com')
    expect(res).toEqual({ ok: false, reason: 'suppressed' })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('sends normally when the recipient is not suppressed', async () => {
    const res = await sendWelcomeEmail('user@example.com')
    expect(res).toEqual({ ok: true, id: 'em_1' })
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('fails OPEN: config and recipient gates still run before the suppression read', async () => {
    delete process.env.RESEND_API_KEY
    const res = await sendWelcomeEmail('user@example.com')
    expect(res).toEqual({ ok: false, reason: 'unconfigured' })
    expect(isSuppressedMock).not.toHaveBeenCalled()
  })
})

describe('List-Unsubscribe headers', () => {
  it('digest sends carry the real one-click unsubscribe URL (RFC 8058)', async () => {
    const url = 'https://hop.flights/api/newsletter-signup/unsubscribe?token=xyz'
    await sendWeeklyDigestEmail('user@example.com', dream(), url)
    expect(sendMock).toHaveBeenCalledTimes(1)
    const args = sendMock.mock.calls[0][0]
    expect(args.headers['List-Unsubscribe']).toBe(`<${url}>`)
    expect(args.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('alert sends carry the mailto/account-manage fallback, without the one-click Post header', async () => {
    await sendAlertEmail('user@example.com', alert())
    const args = sendMock.mock.calls[0][0]
    expect(args.headers['List-Unsubscribe']).toContain('mailto:support@hop.flights')
    expect(args.headers['List-Unsubscribe']).toContain('/account')
    expect(args.headers['List-Unsubscribe-Post']).toBeUndefined()
    // The body also states how to stop the alerts, in plain text.
    expect(args.text).toContain('Unsubscribe from these alerts:')
  })
})

describe('sendWelcomeEmailFromSignup — the auth-hook contract (never rejects)', () => {
  it('resolves cleanly when the provider send fails — a broken email seam must not fail signup', async () => {
    sendMock.mockRejectedValue(new Error('resend is down'))
    await expect(sendWelcomeEmailFromSignup('user@example.com')).resolves.toBeUndefined()
  })

  it('resolves cleanly for a missing email (nothing to send)', async () => {
    await expect(sendWelcomeEmailFromSignup(undefined)).resolves.toBeUndefined()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('actually sends when everything works', async () => {
    await sendWelcomeEmailFromSignup('user@example.com')
    expect(sendMock).toHaveBeenCalledTimes(1)
  })
})

describe('lifecycle templates — design system + copy voice', () => {
  it('welcome: search CTA, balances secondary, canonical sample numbers, bunny mark, plain-text alternative', () => {
    const { subject, text, html } = renderWelcomeEmail()
    expect(subject).toBe('Your points have a cash value')
    expect(text).toContain('/search')
    expect(text).toContain('/account')
    expect(text).toContain('2.6¢/pt')
    expect(html).toContain('https://hop.flights/bunny.svg')
    expect(html).toContain('Run a search')
    // Sample economics are labeled as such — never presented as the user's own.
    expect(html).toContain('Sample verdict')
  })

  it('pro welcome: unlimited watches, the grandfathered $49 line, add-a-watch CTA', () => {
    const { subject, text, html } = renderProWelcomeEmail()
    expect(subject).toBe('hop Pro is on')
    expect(text).toContain('$49/yr')
    expect(text).toContain('grandfathered')
    expect(text).toContain('/search')
    expect(html).toContain('Unlimited')
    expect(html).toContain('Set a watch')
  })

  it('cancellation: what stays free (search + verdict, 3 watches) and the come-back link', () => {
    const { subject, text, html } = renderCancellationEmail()
    expect(subject).toBe('hop Pro is canceled')
    expect(text).toContain('3 watches')
    expect(text).toContain('/pricing')
    expect(html).toContain('Search + verdict')
    expect(html).toContain('hop.flights/pricing')
  })

  it('no fake warmth, no all-caps kickers, no monospace in any lifecycle template', () => {
    for (const t of [renderWelcomeEmail(), renderProWelcomeEmail(), renderCancellationEmail()]) {
      const all = `${t.subject}\n${t.text}\n${t.html}`
      expect(all).not.toMatch(/a real person reads this|we.re here for you/i)
      expect(all).not.toMatch(/monospace|Courier/i)
      // White ground, not the cream wash.
      expect(t.html).toContain('background:#ffffff')
    }
  })
})
