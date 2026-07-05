import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assembleSearch } from '@/lib/search'
import { searchCash } from '@/lib/duffel'
import { searchAwards } from '@/lib/seatsaero'
import { recordCppObservations } from '@/lib/valuation-telemetry'

// lib/search.ts's recordCppObservations() call site must respect useMock the
// same way the recordDegradation() call site two lines below it does (see
// lib/__tests__/degradation-telemetry.test.ts) — fixture cpp values must
// never reach the live valuation worker's trust gate (ADR 0005).

vi.mock('@/lib/duffel', () => ({ searchCash: vi.fn() }))
vi.mock('@/lib/seatsaero', () => ({ searchAwards: vi.fn() }))
vi.mock('@/lib/valuation-telemetry', () => ({ recordCppObservations: vi.fn() }))

const ORIGINAL_ENV = { ...process.env }
const params = { from: 'SFO', to: 'LAX', depart: '2026-08-01', adults: 1 }

const LIVE_AWARD = {
  id: 'a1',
  kind: 'award' as const,
  airline: 'Alaska',
  program: 'Amex Membership Rewards',
  route: 'SFO → LAX',
  date: 'Aug 1',
  miles: 10000,
  taxes: 0,
  tier: 'muted' as const,
  bookingUrl: '',
}

const LIVE_CASH = {
  id: 'c1',
  kind: 'cash' as const,
  airline: 'Alaska',
  route: 'SFO → LAX',
  date: 'Aug 1',
  cashPrice: 500,
  tier: 'muted' as const,
  bookingUrl: '',
}

beforeEach(() => {
  delete process.env.MOCK
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.clearAllMocks()
})

describe('lib/search.ts recordCppObservations() call site — mock-mode guard', () => {
  it('a live run with a priced award reports an observation', async () => {
    vi.mocked(searchCash).mockResolvedValue({ ok: true, data: [LIVE_CASH] })
    vi.mocked(searchAwards).mockResolvedValue({ ok: true, data: [LIVE_AWARD] })

    await assembleSearch(params, [])

    expect(vi.mocked(recordCppObservations)).toHaveBeenCalledTimes(1)
    const [samples] = vi.mocked(recordCppObservations).mock.calls[0]
    expect(samples).toEqual([
      expect.objectContaining({ programId: 'amex-mr', cpp: 5, cashCents: 50000, miles: 10000 }),
    ])
  })

  it('the mock path never reports an observation', async () => {
    process.env.MOCK = '1'

    await assembleSearch(params, [])

    expect(vi.mocked(recordCppObservations)).not.toHaveBeenCalled()
    // The mock path never even calls the live upstreams.
    expect(vi.mocked(searchCash)).not.toHaveBeenCalled()
    expect(vi.mocked(searchAwards)).not.toHaveBeenCalled()
  })
})
