import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the withDb seam so the insert body is observable without Supabase.
// recordOutclick's contract (fire-and-forget, never throws) is what's under test.
vi.mock('@/lib/supabase-helpers', () => ({
  withDb: vi.fn(async (fallback: unknown) => fallback),
}))

import { withDb } from '@/lib/supabase-helpers'
import { recordOutclick, type Outclick } from '@/lib/outclicks'

const mockWithDb = vi.mocked(withDb)

const CLICK: Outclick = {
  kind: 'card',
  target: 'chase-ur',
  url: 'https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred?ref=hop-card',
  program: 'Chase Ultimate Rewards',
  userAgent: 'test-agent/1.0',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockWithDb.mockImplementation(async (fallback: unknown) => fallback)
})

describe('recordOutclick', () => {
  it('maps the click onto a hop_outclicks insert (snake_case columns)', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    const from = vi.fn(() => ({ insert }))
    mockWithDb.mockImplementation(async (_fallback, fn) =>
      (fn as (db: unknown) => Promise<unknown>)({ from }),
    )

    recordOutclick(CLICK)

    await vi.waitFor(() => expect(insert).toHaveBeenCalled())
    expect(from).toHaveBeenCalledWith('hop_outclicks')
    expect(insert).toHaveBeenCalledWith({
      kind: 'card',
      target: 'chase-ur',
      url: CLICK.url,
      program: 'Chase Ultimate Rewards',
      user_agent: 'test-agent/1.0',
    })
  })

  it('stores null (not undefined) for absent program/user-agent context', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    mockWithDb.mockImplementation(async (_fallback, fn) =>
      (fn as (db: unknown) => Promise<unknown>)({ from: () => ({ insert }) }),
    )

    recordOutclick({ kind: 'card', target: 'united', url: 'https://example.com' })

    await vi.waitFor(() => expect(insert).toHaveBeenCalled())
    expect(insert).toHaveBeenCalledWith({
      kind: 'card',
      target: 'united',
      url: 'https://example.com',
      program: null,
      user_agent: null,
    })
  })

  it('returns a promise that resolves — so after() can track the write to completion', async () => {
    await expect(recordOutclick(CLICK)).resolves.toBeUndefined()
  })

  it('never throws or rejects, even if the withDb seam itself throws synchronously', async () => {
    mockWithDb.mockImplementation(() => {
      throw new Error('boom')
    })
    await expect(recordOutclick(CLICK)).resolves.toBeUndefined()
  })

  it('no-ops silently when the DB is unconfigured (withDb falls back)', () => {
    // Default mock: withDb resolves straight to the fallback (no client).
    expect(() => recordOutclick(CLICK)).not.toThrow()
    expect(mockWithDb).toHaveBeenCalledTimes(1)
  })
})
