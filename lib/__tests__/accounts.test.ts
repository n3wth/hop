// Unit tests for lib/accounts.ts — getUserBalances merge semantics, plus the
// AwardWallet balance CACHE (refreshAwCache / getCachedAwBalances /
// listConnectedAwUsers).
//
// getUserBalances() is the SINGLE balance resolver every surface trusts (home,
// deals, ask, search). It merges manual programs (Neon hop_manual_balances)
// with the AwardWallet cache (hop_user_accounts.cached_balances) — a plain db
// read, NEVER a live AwardWallet call (see the refreshAwCache suite below for
// the only code paths that call AwardWallet live). AwardWallet wins for
// programs it covers; manual fills the rest. Never throws; returns [] when
// the user has nothing.
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

// Mock getBalances from awardwallet.ts — the ONLY live call, used exclusively
// by refreshAwCache's own tests below. getUserBalances no longer calls this.
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
const { getUserBalances, refreshAwCache, getCachedAwBalances, listConnectedAwUsers } =
  await import('@/lib/accounts')

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

// Configure withDb to return specific data for getManualBalances and the
// hop_user_accounts cache read (getCachedAwBalances). `awRow` models the
// user's hop_user_accounts row: null = no row at all (not connected);
// otherwise its cached_balances/last_synced_at/last_sync_ok.
function setupDbMocks(opts: {
  manualBalances: Array<{ id: string; program: string; code: string | null; balance: number; kind?: string }>
  awRow: { cachedBalances?: Balance[] | null; syncedAt?: string | null; syncOk?: boolean } | null
}) {
  withDbMock.mockImplementation(async <T>(fallback: T, fn: (db: MockDb) => Promise<T>): Promise<T> => {
    const mockDb = createMockDb(opts)
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

function createMockDb(opts: {
  manualBalances: Array<{ id: string; program: string; code: string | null; balance: number; kind?: string }>
  awRow: { cachedBalances?: Balance[] | null; syncedAt?: string | null; syncOk?: boolean } | null
}): MockDb {
  return {
    from: (table: string) => {
      const builder: MockQueryBuilder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        maybeSingle: async () => {
          if (table === 'hop_user_accounts') {
            if (!opts.awRow) return { data: null, error: null }
            return {
              data: {
                cached_balances: opts.awRow.cachedBalances ?? null,
                last_synced_at: opts.awRow.syncedAt ?? null,
                last_sync_ok: opts.awRow.syncOk ?? false,
              },
              error: null,
            }
          }
          return { data: null, error: null }
        },
        then: async (onfulfilled) => {
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

const SYNCED_AT = '2026-07-05T12:00:00.000Z'

// --- Tests -------------------------------------------------------------------

describe('getUserBalances() — merge semantics', () => {
  describe('manual balances only (no AwardWallet connected)', () => {
    it('returns manual balances when user has no AwardWallet link', async () => {
      setupDbMocks({
        manualBalances: [
          { id: '1', program: 'Amex MR', code: 'AX', balance: 50000 },
          { id: '2', program: 'Chase UR', code: 'UR', balance: 30000 },
        ],
        awRow: null,
      })

      const balances = await getUserBalances('user-1')

      expect(balances).toHaveLength(2)
      expect(balances[0].program).toBe('Amex MR')
      expect(balances[0].balance).toBe(50000)
      expect(balances[1].program).toBe('Chase UR')
      expect(balances[1].balance).toBe(30000)
    })

    it('returns empty array when user has no manual balances and no AwardWallet', async () => {
      setupDbMocks({ manualBalances: [], awRow: null })

      const balances = await getUserBalances('user-1')

      expect(balances).toEqual([])
    })
  })

  describe('AwardWallet only (no manual balances)', () => {
    it('returns cached AwardWallet balances when user has no manual programs', async () => {
      setupDbMocks({
        manualBalances: [],
        awRow: {
          cachedBalances: [
            awBalance('Delta SkyMiles', 75000, 'DL', 'Gold'),
            awBalance('United MileagePlus', 45000, 'UA'),
          ],
          syncedAt: SYNCED_AT,
          syncOk: true,
        },
      })

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
        awRow: {
          cachedBalances: [awBalance('Amex Membership Rewards', 80000, 'AX', 'Platinum')],
          syncedAt: SYNCED_AT,
          syncOk: true,
        },
      })

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
        awRow: {
          cachedBalances: [awBalance('Amex Membership Rewards', 80000, 'AX')],
          syncedAt: SYNCED_AT,
          syncOk: true,
        },
      })

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
        awRow: {
          cachedBalances: [awBalance('Delta SkyMiles', 75000, 'DL')],
          syncedAt: SYNCED_AT,
          syncOk: true,
        },
      })

      const balances = await getUserBalances('user-1')

      // Should be de-duped to 1 entry (AwardWallet wins)
      expect(balances).toHaveLength(1)
      expect(balances[0].balance).toBe(75000)
    })

    it('treats different codes as separate programs', async () => {
      setupDbMocks({
        manualBalances: [{ id: '1', program: 'Hilton Honors', code: 'HH', balance: 200000 }],
        awRow: {
          cachedBalances: [awBalance('Marriott Bonvoy', 150000, 'MR')],
          syncedAt: SYNCED_AT,
          syncOk: true,
        },
      })

      const balances = await getUserBalances('user-1')

      expect(balances).toHaveLength(2)
      expect(balances.map((b) => b.code).sort()).toEqual(['HH', 'MR'])
    })
  })

  describe('sorting', () => {
    it('returns balances sorted by balance descending', async () => {
      setupDbMocks({
        manualBalances: [{ id: '1', program: 'Small Balance', code: 'SB', balance: 1000 }],
        awRow: {
          cachedBalances: [
            awBalance('Medium Balance', 50000, 'MB'),
            awBalance('Large Balance', 100000, 'LB'),
          ],
          syncedAt: SYNCED_AT,
          syncOk: true,
        },
      })

      const balances = await getUserBalances('user-1')

      expect(balances).toHaveLength(3)
      expect(balances[0].balance).toBe(100000)
      expect(balances[1].balance).toBe(50000)
      expect(balances[2].balance).toBe(1000)
    })
  })

  describe('degradation: AwardWallet cache is empty or stale', () => {
    it('returns manual balances when the cache has never been synced (null cached_balances)', async () => {
      setupDbMocks({
        manualBalances: [{ id: '1', program: 'Amex MR', code: 'AX', balance: 50000 }],
        awRow: { cachedBalances: null, syncedAt: null, syncOk: false },
      })

      const balances = await getUserBalances('user-1')

      expect(balances).toHaveLength(1)
      expect(balances[0].program).toBe('Amex MR')
      expect(balances[0].balance).toBe(50000)
    })

    it('returns manual balances when the last sync failed and left an empty cache', async () => {
      setupDbMocks({
        manualBalances: [{ id: '1', program: 'Chase UR', code: 'UR', balance: 75000 }],
        awRow: { cachedBalances: [], syncedAt: SYNCED_AT, syncOk: false },
      })

      const balances = await getUserBalances('user-1')

      expect(balances).toHaveLength(1)
      expect(balances[0].program).toBe('Chase UR')
    })

    it('returns empty when both sources are empty', async () => {
      setupDbMocks({ manualBalances: [], awRow: { cachedBalances: [], syncedAt: SYNCED_AT, syncOk: false } })

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

    it('handles a connected row whose cache is present but empty', async () => {
      setupDbMocks({
        manualBalances: [{ id: '1', program: 'Southwest', code: 'WN', balance: 40000 }],
        awRow: { cachedBalances: [], syncedAt: SYNCED_AT, syncOk: true },
      })

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
      awRow: null,
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
      awRow: null,
    })

    const balances = await getUserBalances('user-1')

    expect(balances).toHaveLength(1)
    // deriveCode fallback should derive a code from the program name
    expect(balances[0].code).toBeDefined()
    expect(balances[0].code.length).toBeGreaterThan(0)
  })

  it('de-dupes an AwardWallet balance with no code against manual via its derived code', async () => {
    // AwardWallet can return a program without a monogram. mergeKey must fall
    // back to deriveCode(program) on the SYNCED side too, so it still collides
    // with the manual entry it duplicates — and AwardWallet still wins.
    setupDbMocks({
      manualBalances: [{ id: '1', program: 'Amex MR', code: 'AX', balance: 50000 }],
      awRow: {
        // code is empty → mergeKey derives 'AX' from 'Amex Membership Rewards'
        cachedBalances: [awBalance('Amex Membership Rewards', 80000, '')],
        syncedAt: SYNCED_AT,
        syncOk: true,
      },
    })

    const balances = await getUserBalances('user-1')

    expect(balances).toHaveLength(1)
    expect(balances[0].balance).toBe(80000)
    expect(balances[0].program).toBe('Amex Membership Rewards')
  })
})

describe('status field preservation', () => {
  it('preserves status from AwardWallet balances', async () => {
    setupDbMocks({
      manualBalances: [],
      awRow: {
        cachedBalances: [awBalance('Delta SkyMiles', 100000, 'DL', 'Diamond Medallion')],
        syncedAt: SYNCED_AT,
        syncOk: true,
      },
    })

    const balances = await getUserBalances('user-1')

    expect(balances[0].status).toBe('Diamond Medallion')
  })

  it('preserves kind as status from manual balances', async () => {
    setupDbMocks({
      manualBalances: [{ id: '1', program: 'Hyatt', code: 'HY', balance: 50000, kind: 'Globalist' }],
      awRow: null,
    })

    const balances = await getUserBalances('user-1')

    expect(balances[0].status).toBe('Globalist')
  })
})

// --- getCachedAwBalances() ---------------------------------------------------

describe('getCachedAwBalances()', () => {
  it('returns the empty/unsynced shape when there is no hop_user_accounts row', async () => {
    setupDbMocks({ manualBalances: [], awRow: null })

    const cached = await getCachedAwBalances('user-1')

    expect(cached).toEqual({ balances: [], syncedAt: null, ok: false })
  })

  it('returns the empty/unsynced shape for a connected row with a null cache (pre-migration / never synced)', async () => {
    setupDbMocks({ manualBalances: [], awRow: { cachedBalances: null, syncedAt: null, syncOk: false } })

    const cached = await getCachedAwBalances('user-1')

    expect(cached).toEqual({ balances: [], syncedAt: null, ok: false })
  })

  it('returns the populated snapshot for a synced row', async () => {
    setupDbMocks({
      manualBalances: [],
      awRow: {
        cachedBalances: [awBalance('Delta SkyMiles', 75000, 'DL')],
        syncedAt: SYNCED_AT,
        syncOk: true,
      },
    })

    const cached = await getCachedAwBalances('user-1')

    expect(cached.ok).toBe(true)
    expect(cached.syncedAt).toBe(SYNCED_AT)
    expect(cached.balances).toHaveLength(1)
    expect(cached.balances[0].program).toBe('Delta SkyMiles')
  })

  it('never throws — degrades to the empty shape on any db failure', async () => {
    withDbMock.mockImplementation(async <T>(fallback: T) => fallback)

    const cached = await getCachedAwBalances('user-1')

    expect(cached).toEqual({ balances: [], syncedAt: null, ok: false })
  })
})

// --- refreshAwCache() ---------------------------------------------------------
// The ONLY function (besides the cron/bootstrap callers of it) that makes a
// LIVE AwardWallet call. Drives getBalances directly (mocked) and asserts the
// exact write payload via a capturing upsert mock.

interface CapturedUpsert {
  table: string
  payload: Record<string, unknown> | Record<string, unknown>[]
  opts?: { onConflict?: string }
}

function mockUpsertCapture(): { calls: CapturedUpsert[] } {
  const state = { calls: [] as CapturedUpsert[] }
  withDbMock.mockImplementation(async <T>(fallback: T, fn: (db: unknown) => Promise<T>): Promise<T> => {
    const db = {
      from: (table: string) => ({
        upsert: (payload: Record<string, unknown>, opts?: { onConflict?: string }) => {
          state.calls.push({ table, payload, opts })
          return Promise.resolve({ data: [payload], error: null })
        },
      }),
    }
    try {
      return await fn(db)
    } catch {
      return fallback
    }
  })
  return state
}

describe('refreshAwCache()', () => {
  it('writes cached_balances + last_synced_at + last_sync_ok:true on success', async () => {
    const capture = mockUpsertCapture()
    getBalancesMock.mockResolvedValue({
      ok: true,
      data: [awBalance('Delta SkyMiles', 75000, 'DL')],
    } as ApiResult<Balance[]>)

    const ok = await refreshAwCache('user-1', 'aw-123')

    expect(ok).toBe(true)
    expect(getBalancesMock).toHaveBeenCalledWith('aw-123')
    expect(capture.calls).toHaveLength(1)
    const call = capture.calls[0]
    expect(call.table).toBe('hop_user_accounts')
    expect(call.opts?.onConflict).toBe('user_id')
    const payload = call.payload as Record<string, unknown>
    expect(payload.user_id).toBe('user-1')
    expect(payload.last_sync_ok).toBe(true)
    expect(payload.cached_balances).toEqual([awBalance('Delta SkyMiles', 75000, 'DL')])
    expect(typeof payload.last_synced_at).toBe('string')
  })

  it('never clobbers a good snapshot on failure — omits cached_balances entirely', async () => {
    const capture = mockUpsertCapture()
    getBalancesMock.mockResolvedValue({ ok: false, reason: 'AwardWallet request timed out' })

    const ok = await refreshAwCache('user-1', 'aw-123')

    expect(ok).toBe(false)
    expect(capture.calls).toHaveLength(1)
    const payload = capture.calls[0].payload as Record<string, unknown>
    expect(payload.last_sync_ok).toBe(false)
    expect('cached_balances' in payload).toBe(false)
    expect(typeof payload.last_synced_at).toBe('string')
  })

  it('never throws — a thrown getBalances still stamps a failed sync', async () => {
    const capture = mockUpsertCapture()
    getBalancesMock.mockRejectedValue(new Error('network down'))

    const ok = await refreshAwCache('user-1', 'aw-123')

    expect(ok).toBe(false)
    expect(capture.calls).toHaveLength(1)
    expect((capture.calls[0].payload as Record<string, unknown>).last_sync_ok).toBe(false)
  })
})

// --- listConnectedAwUsers() ---------------------------------------------------

describe('listConnectedAwUsers()', () => {
  it('filters out rows with a null/blank aw_user_id', async () => {
    withDbMock.mockImplementation(async <T>(fallback: T, fn: (db: unknown) => Promise<T>): Promise<T> => {
      const db = {
        from: () => ({
          select: () => ({
            then: (resolve: (v: unknown) => unknown) =>
              resolve({
                data: [
                  { user_id: 'user-1', aw_user_id: 'aw-1' },
                  { user_id: 'user-2', aw_user_id: null },
                  { user_id: 'user-3', aw_user_id: '' },
                  { user_id: 'user-4', aw_user_id: 'aw-4' },
                ],
                error: null,
              }),
          }),
        }),
      }
      try {
        return await fn(db)
      } catch {
        return fallback
      }
    })

    const users = await listConnectedAwUsers()

    expect(users).toEqual([
      { userId: 'user-1', awUserId: 'aw-1' },
      { userId: 'user-4', awUserId: 'aw-4' },
    ])
  })

  it('returns [] on any db failure — never throws', async () => {
    withDbMock.mockImplementation(async <T>(fallback: T) => fallback)

    const users = await listConnectedAwUsers()

    expect(users).toEqual([])
  })
})
