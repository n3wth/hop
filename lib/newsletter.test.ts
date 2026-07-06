import { describe, it, expect } from 'vitest'
import { createNewsletterSignup, listRecentNewsletterSignups } from '@/lib/newsletter'

// Mirrors lib/escalation.test.ts: no NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// under vitest, so withDb short-circuits to its fallback without a network call.
// We only need to cover the degrade-gracefully contract here — normalizeEmail's
// own validation cases already live in lib/escalation.test.ts (reused, not duplicated).

describe('createNewsletterSignup (graceful, no db)', () => {
  it('returns false when the email is unusable, without attempting a db call', async () => {
    await expect(createNewsletterSignup({ email: 'garbage' })).resolves.toBe(false)
    await expect(createNewsletterSignup({ email: undefined })).resolves.toBe(false)
  })

  it('returns false when no db is configured, even for a valid email', async () => {
    await expect(
      createNewsletterSignup({ userId: 'user_abc', email: 'Traveler@Example.com' }),
    ).resolves.toBe(false)
  })
})

describe('listRecentNewsletterSignups (graceful, no db)', () => {
  it('returns null when no db is configured (never throws)', async () => {
    await expect(listRecentNewsletterSignups()).resolves.toBeNull()
  })
})
