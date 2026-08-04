import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  renderVerificationEmail,
  renderResetPasswordEmail,
  renderNewsletterConfirmationEmail,
  renderWeeklyDigestEmail,
} from '@/lib/email'
import { isEmailPasswordAuthEnabled, isPasskeyEnabled, isNewsletterEnabled } from '@/lib/env'
import type { LedgerDream } from '@/lib/ledger-dream'

// Pure render functions only — no network, matches how the rest of the suite
// tests render*() rather than live dispatch()/Resend calls (email-subscription.test.ts).

describe('renderVerificationEmail', () => {
  it('has a terse, on-brand subject', () => {
    const { subject } = renderVerificationEmail('https://hop.flights/api/auth/verify-email?token=abc')
    expect(subject).toBe('Verify your hop email')
  })

  it('includes the verification url in both text and html bodies', () => {
    const url = 'https://hop.flights/api/auth/verify-email?token=abc123'
    const { text, html } = renderVerificationEmail(url)
    expect(text).toContain(url)
    expect(html).toContain(`href="${url}"`)
  })

  it('escapes an html-sensitive url', () => {
    const url = 'https://hop.flights/verify?token=a&b="c"'
    const { html } = renderResetPasswordEmail(url)
    expect(html).not.toContain('token=a&b="c"')
    expect(html).toContain('&amp;')
    expect(html).toContain('&quot;')
  })
})

describe('renderResetPasswordEmail', () => {
  it('has a terse, on-brand subject', () => {
    const { subject } = renderResetPasswordEmail('https://hop.flights/reset-password?token=abc')
    expect(subject).toBe('Reset your hop password')
  })

  it('includes the reset url in both text and html bodies, plus the expiry note', () => {
    const url = 'https://hop.flights/reset-password?token=xyz789'
    const { text, html } = renderResetPasswordEmail(url)
    expect(text).toContain(url)
    expect(text).toContain('expires in 1 hour')
    expect(html).toContain(`href="${url}"`)
  })
})

const AUTH_KEYS = [
  'HOP_ENABLE_EMAIL_PASSWORD_AUTH',
  'HOP_ENABLE_PASSKEY_AUTH',
  'HOP_ENABLE_NEWSLETTER',
  'RESEND_API_KEY',
] as const
const ORIGINAL: Record<string, string | undefined> = {}
beforeEach(() => {
  for (const k of AUTH_KEYS) {
    ORIGINAL[k] = process.env[k]
    delete process.env[k]
  }
})
afterEach(() => {
  for (const k of AUTH_KEYS) {
    if (ORIGINAL[k] === undefined) delete process.env[k]
    else process.env[k] = ORIGINAL[k]
  }
})

describe('isEmailPasswordAuthEnabled — the double lock', () => {
  it('is false by default (no flag, no key)', () => {
    expect(isEmailPasswordAuthEnabled()).toBe(false)
  })

  it('flag alone or key alone never enables it', () => {
    process.env.HOP_ENABLE_EMAIL_PASSWORD_AUTH = '1'
    expect(isEmailPasswordAuthEnabled()).toBe(false)

    delete process.env.HOP_ENABLE_EMAIL_PASSWORD_AUTH
    process.env.RESEND_API_KEY = 're_test_fake'
    expect(isEmailPasswordAuthEnabled()).toBe(false)
  })

  it('is true once both the flag and the Resend key are set', () => {
    process.env.HOP_ENABLE_EMAIL_PASSWORD_AUTH = '1'
    process.env.RESEND_API_KEY = 're_test_fake'
    expect(isEmailPasswordAuthEnabled()).toBe(true)
  })
})

describe('isPasskeyEnabled — flag only, no upstream credential needed', () => {
  it('is false by default', () => {
    expect(isPasskeyEnabled()).toBe(false)
  })

  it('is true once the flag is set — no key required', () => {
    process.env.HOP_ENABLE_PASSKEY_AUTH = 'true'
    expect(isPasskeyEnabled()).toBe(true)
  })
})

describe('isNewsletterEnabled — the double lock', () => {
  it('is false by default (no flag, no key)', () => {
    expect(isNewsletterEnabled()).toBe(false)
  })

  it('flag alone or key alone never enables it', () => {
    process.env.HOP_ENABLE_NEWSLETTER = '1'
    expect(isNewsletterEnabled()).toBe(false)

    delete process.env.HOP_ENABLE_NEWSLETTER
    process.env.RESEND_API_KEY = 're_test_fake'
    expect(isNewsletterEnabled()).toBe(false)
  })

  it('is true once both the flag and the Resend key are set', () => {
    process.env.HOP_ENABLE_NEWSLETTER = '1'
    process.env.RESEND_API_KEY = 're_test_fake'
    expect(isNewsletterEnabled()).toBe(true)
  })
})

describe('renderNewsletterConfirmationEmail', () => {
  it('has a terse, on-brand subject and includes the confirm url in both bodies', () => {
    const url = 'https://hop.flights/api/newsletter-signup/confirm?token=abc123'
    const { subject, text, html } = renderNewsletterConfirmationEmail(url)
    expect(subject).toBe('Confirm your hop newsletter signup')
    expect(text).toContain(url)
    expect(html).toContain(`href="${url}"`)
  })
})

// Minimal fixture — every field the renderer reads, nothing more.
function fixtureDream(overrides: Partial<LedgerDream> = {}): LedgerDream {
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
    cpp: 3.14159,
    cashValue: 1200,
    proof: {
      program: 'Alaska Mileage Plan',
      milesNeeded: 60000,
      path: 'Alaska Mileage Plan (held directly)',
    },
    imageQuery: 'tokyo skyline',
    saveToward: false,
    affordableNow: true,
    ...overrides,
  }
}

describe('renderWeeklyDigestEmail', () => {
  it('renders a personalized redemption with the engine-computed cpp, rounded to 1 decimal', () => {
    const unsubscribeUrl = 'https://hop.flights/api/newsletter-signup/unsubscribe?token=xyz'
    const { subject, text, html } = renderWeeklyDigestEmail(fixtureDream(), unsubscribeUrl)
    expect(subject).toContain("This week's best redemption: Tokyo")
    expect(subject).toContain('3.1¢/pt')
    expect(text).toContain('60,000 pts')
    expect(text).toContain('Alaska Mileage Plan (held directly)')
    expect(text).toContain(`Unsubscribe: ${unsubscribeUrl}`)
    expect(html).toContain(`href="${unsubscribeUrl}"`)
  })

  it('renders the save-toward fallback with honest "worth saving toward" copy, no fabricated proof path', () => {
    const dream = fixtureDream({ saveToward: true, affordableNow: false })
    const { subject, text } = renderWeeklyDigestEmail(dream, 'https://hop.flights/unsub')
    expect(subject).toContain('Worth saving toward: Tokyo')
    expect(text).toContain("don’t hold enough toward this one yet")
    expect(text).not.toContain('held directly')
  })

  it('never renders a cpp/rate when the engine has none (undefined, not fabricated)', () => {
    const { subject, text } = renderWeeklyDigestEmail(
      fixtureDream({ cpp: undefined }),
      'https://hop.flights/unsub',
    )
    expect(subject).not.toContain('¢/pt')
    expect(text).not.toContain('¢/pt')
  })
})
