import { describe, it, expect } from 'vitest'
import {
  TOKEN_PREFIX,
  generateToken,
  hashToken,
  looksLikeToken,
  mintToken,
  listTokens,
  revokeToken,
  userIdForToken,
} from '@/lib/api-tokens'

// Token hashing + shape are PURE and must be deterministic/safe. The DB-backed
// functions degrade gracefully when Supabase isn't configured (test env) — they
// must never throw, so the MCP route + token API stay resilient.

describe('hashToken()', () => {
  it('is a stable 64-char hex SHA-256', () => {
    const h = hashToken('hop_example')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken('hop_example')).toBe(h) // deterministic
  })

  it('differs for different inputs', () => {
    expect(hashToken('hop_a')).not.toBe(hashToken('hop_b'))
  })
})

describe('generateToken()', () => {
  it('is prefixed and high-entropy', () => {
    const t = generateToken()
    expect(t.startsWith(TOKEN_PREFIX)).toBe(true)
    expect(t.length).toBeGreaterThan(TOKEN_PREFIX.length + 20)
  })

  it('is unique across calls', () => {
    const seen = new Set(Array.from({ length: 100 }, () => generateToken()))
    expect(seen.size).toBe(100)
  })
})

describe('looksLikeToken()', () => {
  it('accepts a freshly generated token', () => {
    expect(looksLikeToken(generateToken())).toBe(true)
  })

  it('rejects garbage and wrong prefixes', () => {
    expect(looksLikeToken('')).toBe(false)
    expect(looksLikeToken('nope')).toBe(false)
    expect(looksLikeToken('hop_')).toBe(false) // prefix only
    expect(looksLikeToken('sk_live_xxxxxxxxxxxxxxxxxxxxxx')).toBe(false)
    expect(looksLikeToken(undefined)).toBe(false)
    expect(looksLikeToken(123)).toBe(false)
  })
})

describe('DB-backed token fns degrade gracefully without Supabase', () => {
  it('mintToken -> null, never throws', async () => {
    await expect(mintToken('auth0|test')).resolves.toBeNull()
  })

  it('listTokens -> [], never throws', async () => {
    await expect(listTokens('auth0|test')).resolves.toEqual([])
  })

  it('revokeToken -> false, never throws', async () => {
    await expect(revokeToken('auth0|test', 'some-id')).resolves.toBe(false)
  })

  it('userIdForToken short-circuits invalid tokens before any DB call', async () => {
    await expect(userIdForToken('not-a-token')).resolves.toBeNull()
  })

  it('userIdForToken -> null for a well-formed but unknown token', async () => {
    await expect(userIdForToken(generateToken())).resolves.toBeNull()
  })
})
