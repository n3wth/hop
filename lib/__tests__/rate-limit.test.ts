import { describe, it, expect, beforeEach } from 'vitest'
import { rateLimit, checkRateLimit, clientIp, _resetRateLimitForTest } from '@/lib/rate-limit'

// The token-bucket limiter that guards the agentic concierge from repetition
// abuse. Pure aside from a module-level bucket map; reset between cases.

describe('rateLimit() — token bucket', () => {
  beforeEach(() => _resetRateLimitForTest())

  it('allows up to capacity in a burst, then limits', () => {
    const cfg = { capacity: 3, refillPerSec: 0 }
    expect(rateLimit('k', cfg).ok).toBe(true)
    expect(rateLimit('k', cfg).ok).toBe(true)
    expect(rateLimit('k', cfg).ok).toBe(true)
    const limited = rateLimit('k', cfg)
    expect(limited.ok).toBe(false)
    expect(limited.retryAfterSec).toBeGreaterThan(0)
  })

  it('keys are isolated — one key being empty does not limit another', () => {
    const cfg = { capacity: 1, refillPerSec: 0 }
    expect(rateLimit('a', cfg).ok).toBe(true)
    expect(rateLimit('a', cfg).ok).toBe(false)
    // Different key still has its full bucket.
    expect(rateLimit('b', cfg).ok).toBe(true)
  })

  it('never throws and clamps degenerate config', () => {
    expect(() => rateLimit('x', { capacity: 0, refillPerSec: 0 })).not.toThrow()
    // capacity clamps to >=1, so the first call succeeds.
    _resetRateLimitForTest()
    expect(rateLimit('x', { capacity: 0, refillPerSec: 0 }).ok).toBe(true)
  })
})

describe('checkRateLimit() — durable wrapper', () => {
  beforeEach(() => _resetRateLimitForTest())

  // With no Upstash/KV env (the test environment), it must transparently fall
  // back to the in-memory bucket — same behavior as rateLimit().
  it('falls back to the in-memory bucket when no Redis is configured', async () => {
    const cfg = { capacity: 2, refillPerSec: 0 }
    expect((await checkRateLimit('fb', cfg)).ok).toBe(true)
    expect((await checkRateLimit('fb', cfg)).ok).toBe(true)
    const limited = await checkRateLimit('fb', cfg)
    expect(limited.ok).toBe(false)
    expect(limited.retryAfterSec).toBeGreaterThan(0)
  })
})

describe('clientIp() — proxy header parsing', () => {
  const req = (headers: Record<string, string>) => new Request('https://hop.test', { headers })

  it('takes the first x-forwarded-for entry', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4')
  })

  it('falls through to x-real-ip when the leading XFF entry is empty', () => {
    // A malformed chain like ", 9.9.9.9" must not bucket callers under "".
    expect(clientIp(req({ 'x-forwarded-for': ', 9.9.9.9', 'x-real-ip': '8.8.8.8' }))).toBe('8.8.8.8')
  })

  it('falls through to "unknown" when nothing usable is present', () => {
    expect(clientIp(req({ 'x-forwarded-for': '   ' }))).toBe('unknown')
    expect(clientIp(req({}))).toBe('unknown')
  })
})
