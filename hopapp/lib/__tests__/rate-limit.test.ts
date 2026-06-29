import { describe, it, expect, beforeEach } from 'vitest'
import { rateLimit, _resetRateLimitForTest } from '@/lib/rate-limit'

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
