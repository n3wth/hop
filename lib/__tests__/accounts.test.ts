// Unit tests for lib/accounts.ts — getUserBalances merge semantics.
//
// getUserBalances() is the SINGLE balance resolver every surface trusts (home,
// deals, ask, search). It merges manual programs (Neon hop_manual_balances)
// with an optional AwardWallet live link (hop_user_accounts), de-duped by
// program code (uppercase). AwardWallet wins for programs it covers; manual
// fills the rest. Never throws; returns [] when the user has nothing.
//
// These tests lock the merge/de-dupe/precedence/empty/degraded paths.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Balance, ApiResult } from '@/lib/types'

// --- Mocks -------------------------------------------------------------------

// Mock withDb to control database responses
const { withDbMock } = vi.hoisted(() => ({
  withDbMock: vi.fn(),
}))

vi.mock('@/lib/supabase-helpers', () => ({
  withDb: withDbMock,
}))

// Mock getBalances from awardwallet.ts
const { getBalancesMock, deriveCodeMock } = vi.hoisted(() => ({
  getBalancesMock: vi.fn(),
  deriveCodeMock: vi.fn(),
}))

vi.mock('@/lib/awardwallet', () => ({
  getBalances: getBalancesMock,
  deriveCode: deriveCodeMock,
}))

// Mock canonicalizeProgram - not needed for getUserBalances but imported by accounts.ts
vi.mock('@/lib/programs', () => ({
  canonicalizeProgram: vi.fn(),
}))

// Import the module under test AFTER mocks are set up
const { getUserBalances } = await import('@/lib/accounts')

beforeEach(() => {
  vi.clearAllMocks()
  // Default deriveCode behavior: return first 2 chars uppercase
  deriveCodeMock.mockImplementation((program: string) => {
    const lower = program.toLowerCase().trim()
    // Match known overrides
    if (lower.includes('amex') || lower.includes('membership rewards')) return 'AX'
    if (lower.includes('chase') || lower.includes('ultimate rewards')) return 'UR'
    if (lower.includes('delta') || lower.includes('skymiles')) return 'DL'
    if (lower.includes('united') || lower.includes('mileageplus')) return 'UA'
    if (lower.includes('alaska')) return 'AS'
    if (lower.includes('bilt')) return 'BR'
    if (lower.includes('southwest') || lower.includes('rapid rewards')) return 'WN'
    if (lower.includes('marriott')) return 'MR'
    if (lower.includes('hilton')) return 'HH'
    // Fallback to first 2 chars
    return program.slice(0, 2).toUpperCase()
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

// --- Test Helpers ------------------------------------------------------------

// Configure withDb to return specific data for getManualBalances and getUserAwId calls.
// The implementation tracks call order to return appropriate values.
function setupDbMocks(opts: {
  manualBalances: Array<{ id: string; program: string; code: string | null; balance: number; kind?: string }>
  awUserId: string | null
}) {
  let callIndex = 0

  withDbMock.mockImplementation(async <T>(fallback: T, fn: (db: MockDb) => Promise<T>): Promise<T> => {
    const mockDb = createMockDb(callIndex, opts)
    callIndex++
    try {
      return await fn(mockDb)
    } catch {
      return fallback
    }
  })
}

interface MockDb {
  from: (table: string) => MockQueryBuilder
}

interface MockQueryBuilder {
  select: (columns: string) => MockQueryBuilder
  eq: (col: string, val: unknown) => MockQueryBuilder
  order: (col: string, opts?: { ascending?: boolean }) => MockQueryBuilder
  maybeSingle: () => Promise<{ data: unknown; error: null }>
  then: (onfulfilled?: (v: unknown) => unknown, onrejected?: (e: unknown) => unknown) => Promise<unknown>
}

function createMockDb(
  callIndex: number,
  opts: {
    manualBalances: Array<{ id: string; program: string; code: string | null; balance: number; kind?: string }>
    awUserId: string | null
  }
): MockDb {
  return {
    from: (table: string) => {
      const builder: MockQueryBuilder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        maybeSingle: async () => {
          // getUserAwId query
          if (table === 'hop_user_accounts') {
            return {
              data: opts.awUserId ? { aw_user_id: opts.awUserId } : null,
              error: null,
            }
          }
          return { data: null, error: null }
        },
        then: async (onfulfilled) => {
          // getManualBalances query
          if (table === 'hop_manual_balances') {
            const result = {
              data: opts.manualBalances.map((b) => ({
                id: b.id,
                program: b.program,
                code: b.code,
                balance: b.balance,
                kind: b.kind ?? null,
                updated_at: new Date().toISOString(),
              })),
              error: null,
            }
            return onfulfilled ? onfulfilled(result) : result
          }
          // getUserAwId query (when used with then instead of maybeSingle)
          if (table === 'hop_user_accounts') {
            const result = {
              data: opts.awUserId ? { aw_user_id: opts.awUserId } : null,
              error: null,
            }
            return onfulfilled ? onfulfilled(result) : result
          }
          return onfulfilled ? onfulfilled({ data: null, error: null }) : { data: null, error: null }
        },
      }
      return builder
    },
  }
}

function awBalance(program: string, balance: number, code: string, status?: string): Balance {
  return { program, code, balance, status }
}

// --- Tests -------------------------------------------------------------------

describe('getUserBalances() — merge semantics', () => {
  describe('manual balances only (no AwardWallet connected)', () => {
    it('returns manual balances when user has no AwardWallet link', async () => {
      setupDbMocks({
        manualBalances: [
          { id: '1', program: 'Amex MR', code: 'AX', balance: 50000 },
          { id: '2', program: 'Chase UR', code: 'UR', balance: 30000 },
        ],
        awUserId: null,
      })

      const balances = await getUserBalances('user-1')

      expect(balances).toHaveLength(2)
      expect(balances[0].program).toBe('Amex MR')
      expect(balances[0].balance).toBe(50000)
      expect(balances[1].program).toBe('Chase UR')
      expect(balances[1].balance).toBe(30000)
    })

    it('returns empty array when user has no manual balances and no AwardWallet', async () => {
      setupDbMocks({ manualBalances: [], awUserId: null })

      const balances = await getUserBalances('user-1')

      expect(balances).toEqual([])
    })
  })

  describe('AwardWallet only (no manual balances)', () => {
    it('returns AwardWallet balances when user has no manual programs', async () => {
      setupDbMocks({ manualBalances: [], awUserId: 'aw-123' })
      getBalancesMock.mockResolvedValue({
        ok: true,
        data: [
          awBalance('Delta SkyMiles', 75000, 'DL', 'Gold'),
          awBalance('United MileagePlus', 45000, 'UA'),
        ],
      } as ApiResult<Balance[]>)

      const balances = await getUserBalances('user-1')

      expect(balances).toHaveLength(2)
      expect(balances[0].program).toBe('Delta SkyMiles')
      expect(balances[0].balance).toBe(75000)
      expect(balances[0].status).toBe('Gold')
      expect(balances[1].program).toBe('United MileagePlus')
      expect(balances[1].balance).toBe(45000)
    })
  })

  describe('merge: AwardWallet wins for overlapping programs', () => {
    it('AwardWallet takes precedence when both sources have the same program code', async () => {
      setupDbMocks({
        manualBalances: [{ id: '1', program: 'Amex MR', code: 'AX', balance: 50000 }],
        awUserId: 'aw-123',
      })
      getBalancesMock.mockResolvedValue({
        ok: true,
        data: [awBalance('Amex Membership Rewards', 80000, 'AX', 'Platinum')],
      } as ApiResult<Balance[]>)

      const balances = await getUserBalances('user-1')

      expect(balances).toHaveLength(1)
      // AwardWallet version wins (80000, not 50000)
      expect(balances[0].balance).toBe(80000)
      expect(balances[0].program).toBe('Amex Membership Rewards')
      expect(balances[0].status).toBe('Platinum')
    })

    it('manual fills gaps for programs not in AwardWallet', async () => {
      setupDbMocks({
        manualBalances: [
          { id: '1', program: 'Amex MR', code: 'AX', balance: 50000 },
          { id: '2', program: 'Bilt Rewards', code: 'BR', balance: 25000 },
        ],
        awUserId: 'aw-123',
      })
      getBalancesMock.mockResolvedValue({
        ok: true,
        data: [awBalance('Amex Membership Rewards', 80000, 'AX')],
      } as ApiResult<Balance[]>)

      const balances = await getUserBalances('user-1')

      expect(balances).toHaveLength(2)
      // AX is from AwardWallet, BR is from manual
      const axBalance = balances.find((b) => b.code === 'AX')
      const brBalance = balances.find((b) => b.code === 'BR')
      expect(axBalance?.balance).toBe(80000) // AwardWallet wins
      expect(brBalance?.balance).toBe(25000) // Manual fills gap
    })
  })

  describe('de-dupe by program code (uppercase mergeKey)', () => {
    it('de-dupes on uppercase code regardless of case in source', async () => {
      setupDbMocks({
        manualBalances: [{ id: '1', program: 'delta skymiles', code: 'dl', balance: 10000 }],
        awUserId: 'aw-123',
      })
      getBalancesMock.mockResolvedValue({
        ok: true,
        data: [awBalance('Delta SkyMiles', 75000, 'DL')],
      } as ApiResult<Balance[]>)

      const balances = await getUserBalances('user-1')

      // Should be de-duped to 1 entry (AwardWallet wins)
      expect(balances).toHaveLength(1)
      expect(balances[0].balance).toBe(75000)
    })

    it('treats different codes as separate programs', async () => {
      setupDbMocks({
        manualBalances: [{ id: '1', program: 'Hilton Honors', code: 'HH', balance: 200000 }],
        awUserId: 'aw-123',
      })
      getBalancesMock.mockResolvedValue({
        ok: true,
        data: [awBalance('Marriott Bonvoy', 150000, 'MR')],
      } as ApiResult<Balance[]>)

      const balances = await getUserBalances('user-1')

      expect(balances).toHaveLength(2)
      expect(balances.map((b) => b.code).sort()).toEqual(['HH', 'MR'])
    })
  })

  describe('sorting', () => {
    it('returns balances sorted by balance descending', async () => {
      setupDbMocks({
        manualBalances: [{ id: '1', program: 'Small Balance', code: 'SB', balance: 1000 }],
        awUserId: 'aw-123',
      })
      getBalancesMock.mockResolvedValue({
        ok: true,
        data: [
          awBalance('Medium Balance', 50000, 'MB'),
          awBalance('Large Balance', 100000, 'LB'),
        ],
      } as ApiResult<Balance[]>)

      const balances = await getUserBalances('user-1')

      expect(balances).toHaveLength(3)
      expect(balances[0].balance).toBe(100000)
      expect(balances[1].balance).toBe(50000)
      expect(balances[2].balance).toBe(1000)
    })
  })

  describe('degradation: AwardWallet fails', () => {
    it('returns manual balances when AwardWallet returns ok:false', async () => {
      setupDbMocks({
        manualBalances: [{ id: '1', program: 'Amex MR', code: 'AX', balance: 50000 }],
        awUserId: 'aw-123',
      })
      getBalancesMock.mockResolvedValue({
        ok: false,
        reason: 'AwardWallet request timed out',
      } as ApiResult<Balance[]>)

      const balances = await getUserBalances('user-1')

      expect(balances).toHaveLength(1)
      expect(balances[0].program).toBe('Amex MR')
      expect(balances[0].balance).toBe(50000)
    })

    it('returns manual balances when AwardWallet throws', async () => {
      setupDbMocks({
        manualBalances: [{ id: '1', program: 'Chase UR', code: 'UR', balance: 75000 }],
        awUserId: 'aw-123',
      })
      getBalancesMock.mockRejectedValue(new Error('Network error'))

      const balances = await getUserBalances('user-1')

      expect(balances).toHaveLength(1)
      expect(balances[0].program).toBe('Chase UR')
    })

    it('returns empty when both sources fail/empty', async () => {
      setupDbMocks({ manualBalances: [], awUserId: 'aw-123' })
      getBalancesMock.mockResolvedValue({ ok: false, reason: 'timeout' })

      const balances = await getUserBalances('user-1')

      expect(balances).toEqual([])
    })
  })

  describe('empty / edge cases', () => {
    it('never throws — returns [] on any internal failure', async () => {
      // withDb returns fallback on any error
      withDbMock.mockImplementation(async <T>(fallback: T) => fallback)

      const balances = await getUserBalances('user-1')

      expect(balances).toEqual([])
    })

    it('handles user with awUserId but AwardWallet returns empty data', async () => {
      setupDbMocks({
        manualBalances: [{ id: '1', program: 'Southwest', code: 'WN', balance: 40000 }],
        awUserId: 'aw-123',
      })
      getBalancesMock.mockResolvedValue({ ok: true, data: [] })

      const balances = await getUserBalances('user-1')

      expect(balances).toHaveLength(1)
      expect(balances[0].code).toBe('WN')
    })
  })
})

describe('mergeKey — code derivation and case normalization', () => {
  it('uses uppercase code when present', async () => {
    setupDbMocks({
      manualBalances: [
        { id: '1', program: 'Alaska Mileage Plan', code: 'as', balance: 30000 },
        { id: '2', program: 'Alaska Airlines', code: 'AS', balance: 20000 },
      ],
      awUserId: null,
    })

    const balances = await getUserBalances('user-1')

    // Should be de-duped: 'as' and 'AS' both normalize to 'AS'
    expect(balances).toHaveLength(1)
    // First one in manual list wins (sorted by balance desc, 30000 > 20000)
    expect(balances[0].balance).toBe(30000)
  })

  it('derives code from program name when code is empty', async () => {
    setupDbMocks({
      manualBalances: [{ id: '1', program: 'Some Custom Program', code: null, balance: 10000 }],
      awUserId: null,
    })

    const balances = await getUserBalances('user-1')

    expect(balances).toHaveLength(1)
    // deriveCode fallback should derive a code from the program name
    expect(balances[0].code).toBeDefined()
    expect(balances[0].code.length).toBeGreaterThan(0)
  })
})

describe('status field preservation', () => {
  it('preserves status from AwardWallet balances', async () => {
    setupDbMocks({ manualBalances: [], awUserId: 'aw-123' })
    getBalancesMock.mockResolvedValue({
      ok: true,
      data: [awBalance('Delta SkyMiles', 100000, 'DL', 'Diamond Medallion')],
    })

    const balances = await getUserBalances('user-1')

    expect(balances[0].status).toBe('Diamond Medallion')
  })

  it('preserves kind as status from manual balances', async () => {
    setupDbMocks({
      manualBalances: [{ id: '1', program: 'Hyatt', code: 'HY', balance: 50000, kind: 'Globalist' }],
      awUserId: null,
    })

    const balances = await getUserBalances('user-1')

    expect(balances[0].status).toBe('Globalist')
  })
})
