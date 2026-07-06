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

const { addManualBalanceMock, findManualByProgramMock, getManualBalancesMock } = vi.hoisted(() => ({
  addManualBalanceMock: vi.fn(),
  findManualByProgramMock: vi.fn(),
  getManualBalancesMock: vi.fn(),
}))

vi.mock('@/lib/accounts', () => ({
  addManualBalance: addManualBalanceMock,
  updateManualBalance: vi.fn(),
  removeManualBalance: vi.fn(),
  findManualByProgram: findManualByProgramMock,
  getManualBalances: getManualBalancesMock,
  seedQuickStartPrograms: vi.fn(async () => ({ added: [] })),
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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }))
vi.mock('@/lib/auth0', () => ({
  auth0: { getSession: getSessionMock },
}))

const { addProgram } = await import('../accounts')

beforeEach(() => {
  vi.clearAllMocks()
  getSessionMock.mockResolvedValue({ user: { sub: 'user-1' } })
  findManualByProgramMock.mockResolvedValue(null)
  getManualBalancesMock.mockResolvedValue([{ id: 'row-1' }])
  addManualBalanceMock.mockResolvedValue('row-1')
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
