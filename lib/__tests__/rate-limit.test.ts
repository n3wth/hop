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

  // The crux of the spoofable-IP fix: a client fully controls x-forwarded-for
  // (they can set it to anything before it reaches an intermediate proxy),
  // but not x-vercel-forwarded-for, which Vercel's edge computes itself. The
  // platform header must win whenever it's present.
  it('prefers x-vercel-forwarded-for over a spoofed x-forwarded-for', () => {
    expect(
      clientIp(req({ 'x-vercel-forwarded-for': '9.9.9.9', 'x-forwarded-for': '1.2.3.4' })),
    ).toBe('9.9.9.9')
  })

  it('rotating the spoofed x-forwarded-for value does not change the resolved IP', () => {
    const real = '9.9.9.9'
    for (const fake of ['1.1.1.1', '2.2.2.2', '3.3.3.3']) {
      expect(clientIp(req({ 'x-vercel-forwarded-for': real, 'x-forwarded-for': fake }))).toBe(real)
    }
  })

  it('prevents a spoofed-XFF rotation attack from resetting the rate-limit bucket', () => {
    // Before the fix, an attacker could rotate x-forwarded-for on every
    // request to get a fresh in-memory bucket each time, bypassing the
    // limiter entirely. With x-vercel-forwarded-for present (the real
    // Vercel case), every request keys to the SAME bucket regardless of
    // what x-forwarded-for claims, so the second request is still limited.
    const cfg = { capacity: 1, refillPerSec: 0 }
    const bucketKey = (fakeXff: string) =>
      `test:${clientIp(req({ 'x-vercel-forwarded-for': '9.9.9.9', 'x-forwarded-for': fakeXff }))}`
    expect(rateLimit(bucketKey('1.1.1.1'), cfg).ok).toBe(true)
    expect(rateLimit(bucketKey('2.2.2.2'), cfg).ok).toBe(false)
  })

  it('falls through to x-real-ip when x-vercel-forwarded-for is absent', () => {
    expect(clientIp(req({ 'x-real-ip': '8.8.8.8', 'x-forwarded-for': '1.2.3.4' }))).toBe('8.8.8.8')
  })

  // Only reachable off-Vercel (local dev/tests/CI) — a real Vercel request
  // always carries x-vercel-forwarded-for, so this path never runs in
  // production and isn't a spoofing surface there.
  it('falls through to parsing x-forwarded-for only when no platform header is present', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4')
  })

  it('falls through to "unknown" when nothing usable is present', () => {
    expect(clientIp(req({ 'x-forwarded-for': '   ' }))).toBe('unknown')
    expect(clientIp(req({}))).toBe('unknown')
  })
})
