import { describe, it, expect } from 'vitest'
import { isAuthorized } from '@/app/api/support-ingest/route'
import { createSupportTicket } from '@/lib/support-tickets'

// The support-ingest endpoint is the ONE write route reachable from the public
// internet (the Cloudflare support@ Worker posts to it), so its constant-time
// Bearer check is the security boundary. lib/support-tickets degrades like every
// other owner lib — never throws.

describe('isAuthorized() — constant-time Bearer check', () => {
  const secret = 's3cret-token-value-1234567890'

  it('accepts the exact Bearer token', () => {
    expect(isAuthorized(`Bearer ${secret}`, secret)).toBe(true)
  })

  it('rejects a wrong or off-by-one token', () => {
    expect(isAuthorized('Bearer nope', secret)).toBe(false)
    expect(isAuthorized(`Bearer ${secret}x`, secret)).toBe(false)
    expect(isAuthorized(`Bearer ${secret.slice(0, -1)}`, secret)).toBe(false)
  })

  it('rejects missing / malformed authorization headers', () => {
    expect(isAuthorized(null, secret)).toBe(false)
    expect(isAuthorized(secret, secret)).toBe(false) // no "Bearer " prefix
    expect(isAuthorized('Bearer ', secret)).toBe(false)
    expect(isAuthorized('Basic abc', secret)).toBe(false)
  })

  it('rejects everything when no secret is configured (endpoint closed)', () => {
    expect(isAuthorized('Bearer anything', '')).toBe(false)
  })
})

describe('createSupportTicket() — graceful', () => {
  it('returns null (never throws) when the db is unconfigured', async () => {
    await expect(
      createSupportTicket({ from: 'sender@example.com', subject: 'hi', text: 'help' }),
    ).resolves.toBeNull()
  })

  it('never throws on junk input', async () => {
    // @ts-expect-error — exercising a non-string sender at runtime
    await expect(createSupportTicket({ from: 123 })).resolves.toBeNull()
  })
})
