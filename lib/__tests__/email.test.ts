import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderVerificationEmail, renderResetPasswordEmail } from '@/lib/email'
import { isEmailPasswordAuthEnabled, isPasskeyEnabled } from '@/lib/env'

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

const AUTH_KEYS = ['HOP_ENABLE_EMAIL_PASSWORD_AUTH', 'HOP_ENABLE_PASSKEY_AUTH', 'RESEND_API_KEY'] as const
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
