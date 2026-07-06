// addProgram's balance-parsing contract (R1.4) — with the DB layer mocked.
// parseBalance isn't exported on its own, so these exercise it end-to-end
// through addProgram:
//
//   empty / whitespace-only balance → ok:true, stored value 0 (not an error —
//     the "balance unknown" case this phase adds)
//   a genuinely invalid balance (letters, negative, over MAX_BALANCE) →
//     still errors exactly as before (regression guard that the optional-
//     balance change didn't loosen real validation)

import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  addManualBalanceMock,
  findManualByProgramMock,
  getManualBalancesMock,
  updateManualBalanceMock,
  seedQuickStartProgramsMock,
} = vi.hoisted(() => ({
  addManualBalanceMock: vi.fn(),
  findManualByProgramMock: vi.fn(),
  getManualBalancesMock: vi.fn(),
  updateManualBalanceMock: vi.fn(),
  seedQuickStartProgramsMock: vi.fn(),
}))

vi.mock('@/lib/accounts', () => ({
  addManualBalance: addManualBalanceMock,
  updateManualBalance: updateManualBalanceMock,
  removeManualBalance: vi.fn(),
  findManualByProgram: findManualByProgramMock,
  getManualBalances: getManualBalancesMock,
  seedQuickStartPrograms: seedQuickStartProgramsMock,
  QUICK_START_PROGRAM_IDS: ['amex-mr', 'chase-ur', 'citi-typ', 'capital-one', 'bilt'],
}))

// canonicalizeProgram isn't the thing under test here — keep it a no-op
// (unrecognized input) so addProgram falls back to the trimmed raw name.
vi.mock('@/lib/programs', () => ({
  canonicalizeProgram: vi.fn(() => undefined),
}))

vi.mock('@/lib/posthog-server', () => ({
  captureServerEvent: vi.fn(async () => undefined),
}))

const { revalidatePathMock } = vi.hoisted(() => ({ revalidatePathMock: vi.fn() }))
vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}))

const { syncTravelHistoryMock } = vi.hoisted(() => ({ syncTravelHistoryMock: vi.fn() }))
vi.mock('@/lib/travel-history-sync', () => ({
  syncTravelHistory: syncTravelHistoryMock,
  disconnectGmail: vi.fn(),
}))

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }))
vi.mock('@/lib/auth0', () => ({
  auth0: { getSession: getSessionMock },
}))

const { addProgram, addQuickStartPrograms, resyncGmailHistory } = await import('../accounts')

beforeEach(() => {
  vi.clearAllMocks()
  getSessionMock.mockResolvedValue({ user: { sub: 'user-1' } })
  findManualByProgramMock.mockResolvedValue(null)
  getManualBalancesMock.mockResolvedValue([{ id: 'row-1' }])
  addManualBalanceMock.mockResolvedValue('row-1')
  updateManualBalanceMock.mockResolvedValue(true)
  seedQuickStartProgramsMock.mockResolvedValue({ added: [], alreadyHeld: [] })
})

describe('addProgram — balance parsing (R1.4 balance-optional add)', () => {
  it('empty balance string → ok:true, stored value 0', async () => {
    const res = await addProgram('Test Program', '')

    expect(res.ok).toBe(true)
    expect(addManualBalanceMock).toHaveBeenCalledWith('user-1', 'Test Program', 0, undefined)
  })

  it('whitespace-only balance → same as empty (ok:true, stored value 0)', async () => {
    const res = await addProgram('Test Program', '   ')

    expect(res.ok).toBe(true)
    expect(addManualBalanceMock).toHaveBeenCalledWith('user-1', 'Test Program', 0, undefined)
  })

  it('non-numeric balance still errors (regression)', async () => {
    const res = await addProgram('Test Program', 'abc')

    expect(res.ok).toBe(false)
    expect(res.error).toBe('Enter a valid balance')
    expect(addManualBalanceMock).not.toHaveBeenCalled()
  })

  it('negative balance still errors (regression)', async () => {
    const res = await addProgram('Test Program', -5)

    expect(res.ok).toBe(false)
    expect(res.error).toBe('Enter a valid balance')
    expect(addManualBalanceMock).not.toHaveBeenCalled()
  })

  it('over-MAX_BALANCE still errors (regression)', async () => {
    const res = await addProgram('Test Program', String(2_000_000_000))

    expect(res.ok).toBe(false)
    expect(res.error).toBe('Enter a valid balance')
    expect(addManualBalanceMock).not.toHaveBeenCalled()
  })

  it('a real numeric balance still parses correctly (regression)', async () => {
    const res = await addProgram('Test Program', '50,000')

    expect(res.ok).toBe(true)
    expect(addManualBalanceMock).toHaveBeenCalledWith('user-1', 'Test Program', 50000, undefined)
  })
})

describe('addProgram — merging into an existing program', () => {
  beforeEach(() => {
    findManualByProgramMock.mockResolvedValue({ id: 'row-1', program: 'Test Program', balance: 50000 })
  })

  it('an empty/unknown balance against an existing program is a no-op, not a claimed "added"', async () => {
    const res = await addProgram('Test Program', '')

    expect(res.ok).toBe(true)
    expect(res.note).toBe('You already have Test Program — balance unchanged.')
    // merged = 50000 + 0 — still writes through (kind/name may have changed),
    // just doesn't claim a balance change happened.
    expect(updateManualBalanceMock).toHaveBeenCalledWith('user-1', 'row-1', {
      program: 'Test Program',
      balance: 50000,
      kind: undefined,
    })
  })

  it('a real balance against an existing program merges and says so', async () => {
    const res = await addProgram('Test Program', '1000')

    expect(res.ok).toBe(true)
    expect(res.note).toBe('Added to your existing Test Program — now 51,000.')
  })
})

// addQuickStartPrograms' note must attribute skips correctly: "already had N"
// ONLY for genuinely-held programs, never for a mid-loop insert failure
// (lib/accounts.ts#seedQuickStartPrograms distinguishes the two in its result).
describe('addQuickStartPrograms — skip-count attribution', () => {
  it('all 5 already held → the "already had all 5" note, not an error', async () => {
    seedQuickStartProgramsMock.mockResolvedValue({
      added: [],
      alreadyHeld: ['amex-mr', 'chase-ur', 'citi-typ', 'capital-one', 'bilt'],
    })

    const res = await addQuickStartPrograms()

    expect(res.ok).toBe(true)
    expect(res.note).toBe('Already had all 5 — nothing new to add.')
  })

  it('a genuine mid-loop failure (nothing added, not all already-held) is an error, not "already had"', async () => {
    seedQuickStartProgramsMock.mockResolvedValue({ added: [], alreadyHeld: ['amex-mr'] })

    const res = await addQuickStartPrograms()

    expect(res.ok).toBe(false)
    expect(res.error).toBe("Couldn't add — try again")
  })

  it('mixed added + already-held attributes the skip count to alreadyHeld only', async () => {
    seedQuickStartProgramsMock.mockResolvedValue({
      added: ['chase-ur', 'citi-typ', 'capital-one', 'bilt'],
      alreadyHeld: ['amex-mr'],
    })

    const res = await addQuickStartPrograms()

    expect(res.ok).toBe(true)
    expect(res.note).toBe('Added 4 — you already had 1. Fill in real balances below.')
  })

  it('all 5 newly added — no "already had" mention', async () => {
    seedQuickStartProgramsMock.mockResolvedValue({
      added: ['amex-mr', 'chase-ur', 'citi-typ', 'capital-one', 'bilt'],
      alreadyHeld: [],
    })

    const res = await addQuickStartPrograms()

    expect(res.ok).toBe(true)
    expect(res.note).toBe('Added 5 programs. Fill in real balances below.')
  })
})

// #214 review fix: a failed Gmail resync must not revalidate as if something
// changed — the balances/deals/ask pages have nothing new to show, and
// revalidating anyway just masks the failure with a needless re-render.
describe('resyncGmailHistory — only revalidates on an actual success', () => {
  it('revalidates on success', async () => {
    syncTravelHistoryMock.mockResolvedValue({ ok: true, count: 2 })

    const res = await resyncGmailHistory()

    expect(res.ok).toBe(true)
    expect(revalidatePathMock).toHaveBeenCalled()
  })

  it('does NOT revalidate when the sync reports auth-failed', async () => {
    syncTravelHistoryMock.mockResolvedValue({ ok: false, reason: 'auth-failed' })

    const res = await resyncGmailHistory()

    expect(res.ok).toBe(false)
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('does NOT revalidate when the sync reports fetch-failed', async () => {
    syncTravelHistoryMock.mockResolvedValue({ ok: false, reason: 'fetch-failed' })

    const res = await resyncGmailHistory()

    expect(res.ok).toBe(false)
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})
