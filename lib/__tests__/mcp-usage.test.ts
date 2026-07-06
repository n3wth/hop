import { describe, it, expect } from 'vitest'
import { mcpCallsToday, mcpQuotaExceeded } from '@/lib/mcp-usage'

// mcpCallsToday backs the B2 day-quota (business plan §3.1/§7): free 25/day,
// Pro 1,000/day, enforced in app/api/[transport]/route.ts. Without
// DATABASE_URL every withDb call resolves its fallback — the same
// degrade-open contract as every other money-adjacent read in this codebase
// (never block on a DB hiccup).
describe('mcpCallsToday — durable day-quota count, degrades open', () => {
  it('returns null (never blocks) when the DB is unavailable', async () => {
    expect(await mcpCallsToday('token_123')).toBeNull()
  })

  it('short-circuits to null for an empty/missing tokenId without querying', async () => {
    expect(await mcpCallsToday('')).toBeNull()
    expect(await mcpCallsToday(null)).toBeNull()
    expect(await mcpCallsToday(undefined)).toBeNull()
  })
})

// The pure boundary check, isolated from the DB so "blocked at exactly the
// limit" is a plain assertion — this is the actual enforcement decision
// app/api/[transport]/route.ts#meteredCall makes.
describe('mcpQuotaExceeded — boundary at exactly the tier cap', () => {
  it('blocks at exactly the free limit (25)', () => {
    expect(mcpQuotaExceeded(25, 25)).toBe(true)
  })

  it('allows one call under the limit', () => {
    expect(mcpQuotaExceeded(24, 25)).toBe(false)
  })

  it('blocks at exactly the Pro limit (1,000)', () => {
    expect(mcpQuotaExceeded(1000, 1000)).toBe(true)
    expect(mcpQuotaExceeded(999, 1000)).toBe(false)
  })

  it('a degraded (null) count never blocks', () => {
    expect(mcpQuotaExceeded(null, 25)).toBe(false)
  })
})
