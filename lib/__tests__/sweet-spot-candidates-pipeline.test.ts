import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { assembleSearch } from '@/lib/search'
import {
  createSweetSpotDraft,
  draftSweetSpotWhy,
  listSweetSpotDrafts,
  updateSweetSpotDraftWhy,
} from '@/lib/sweet-spot-drafts'
import {
  runSweetSpotCandidatePipeline,
  destinationsForRun,
  ORIGIN_HUBS,
  MAX_NEW_CANDIDATES_PER_RUN,
  SAMPLE_DATE_OFFSETS_DAYS,
} from '@/lib/sweet-spot-candidates'
import type { FlightOption, SearchResult } from '@/lib/types'

// runSweetSpotCandidatePipeline()'s orchestration (timeout safety +
// incremental persistence) is the thing under test here — NOT scoring, which
// lib/__tests__/sweet-spot-candidates.test.ts already covers with pure,
// unmocked helpers. assembleSearch and the sweet-spot-drafts persistence
// functions are fully mocked so every test is instant and deterministic
// (real Date.now() drives the deadline checks; only ITS return value is
// stubbed where a test needs to simulate time passing).

vi.mock('@/lib/search', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/search')>()
  return { ...actual, assembleSearch: vi.fn() }
})
vi.mock('@/lib/sweet-spot-drafts', () => ({
  createSweetSpotDraft: vi.fn(),
  draftSweetSpotWhy: vi.fn(),
  listSweetSpotDrafts: vi.fn(),
  updateSweetSpotDraftWhy: vi.fn(),
}))

// vi.mock()'s factory-created mocks persist across every test in this file
// (the module is only mocked once) — clear call history explicitly before
// each test rather than relying on afterEach's restoreAllMocks() alone, which
// only guarantees spy-implementation restoration (needed for vi.spyOn(Date,
// 'now')), not that .mock.calls resets to empty for these factory mocks.
const ORIGINAL_SEATS_KEY = process.env.SEATS_AERO_API_KEY

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SEATS_AERO_API_KEY = 'test-key'
})

afterEach(() => {
  vi.restoreAllMocks()
  if (ORIGINAL_SEATS_KEY === undefined) delete process.env.SEATS_AERO_API_KEY
  else process.env.SEATS_AERO_API_KEY = ORIGINAL_SEATS_KEY
})

function fakeSearchResult(allAwards: FlightOption[]): SearchResult {
  return {
    params: { from: 'SFO', to: 'XXX', depart: '2026-08-01', adults: 1 },
    options: [],
    allAwards,
    pick: undefined,
    cashOption: undefined,
    verdict: allAwards.length > 0 ? 'use-points' : 'none',
    summary: {},
    balances: [],
    degraded: [],
  }
}

// 'Avianca LifeMiles' → canonicalizeProgram id 'lifemiles' → sweet-spots slug
// 'lifemiles', chosen deliberately: lib/sweet-spots.ts's only lifemiles+Business
// row ("Intra-Asia / Tokyo ↔ Sydney") doesn't match the "US ↔ <country/region>"
// alias pattern staticRouteAliasKeys() generates, so a mined SFO/JFK/ORD/LAX →
// <any destination> route for this program can never collide with the static
// seed table — keeps these tests independent of which destinations happen to
// rotate in for a given date (unlike e.g. alaska-atmos, which DOES collide
// with real Japan/Asia/Australia static rows).
function fakeNotableAward(): FlightOption {
  return {
    id: 'fake-lifemiles-j',
    kind: 'award',
    airline: 'Avianca',
    program: 'Avianca LifeMiles',
    route: 'x',
    date: 'x',
    cabin: 'Business',
    miles: 60000,
    taxes: 0,
    cpp: 6.0, // clears both POINTS_THRESHOLD_CPP and 1.3x lifemiles' 1.4 baseline
    tier: 'green',
    bookingUrl: '',
  }
}

describe('runSweetSpotCandidatePipeline() — timeout safety', () => {
  it('a deadline already in the past stops before starting any search', async () => {
    vi.mocked(listSweetSpotDrafts).mockResolvedValue([])
    const now = new Date('2026-07-05T00:00:00.000Z')

    const result = await runSweetSpotCandidatePipeline(now, { deadlineAt: now.getTime() - 1 })

    expect(vi.mocked(assembleSearch)).not.toHaveBeenCalled()
    expect(result).toEqual({ created: 0, found: 0, drafts: [] })
  })

  it('stops starting new routes once the deadline passes mid-grid, keeping whatever was found so far', async () => {
    vi.mocked(listSweetSpotDrafts).mockResolvedValue([])
    vi.mocked(assembleSearch).mockResolvedValue(fakeSearchResult([])) // no awards — isolates the deadline check from scoring
    const now = new Date('2026-07-05T00:00:00.000Z')
    const deadlineAt = now.getTime() + 1000

    // Date.now() is checked once per (hub, destination) pair, before that
    // route's searches start. First check (route 1): still within budget.
    // Second check (route 2): budget just exceeded.
    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValueOnce(deadlineAt - 1).mockReturnValueOnce(deadlineAt + 1)

    const result = await runSweetSpotCandidatePipeline(now, { deadlineAt })

    // Only route 1's SAMPLE_DATE_OFFSETS_DAYS concurrent searches ran.
    expect(vi.mocked(assembleSearch)).toHaveBeenCalledTimes(SAMPLE_DATE_OFFSETS_DAYS.length)
    expect(result).toEqual({ created: 0, found: 0, drafts: [] })
  })

  it('prices one route\'s sample dates concurrently (bounded to SAMPLE_DATE_OFFSETS_DAYS at a time)', async () => {
    vi.mocked(listSweetSpotDrafts).mockResolvedValue([])
    vi.mocked(assembleSearch).mockResolvedValue(fakeSearchResult([]))
    const now = new Date('2026-07-05T00:00:00.000Z')

    // Deadline trips after the first route so exactly one route's batch runs.
    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValueOnce(now.getTime()).mockReturnValueOnce(now.getTime() + 10_000_000)

    await runSweetSpotCandidatePipeline(now, { deadlineAt: now.getTime() + 1 })

    const calls = vi.mocked(assembleSearch).mock.calls
    expect(calls).toHaveLength(SAMPLE_DATE_OFFSETS_DAYS.length)
    // Every call in the one route's batch targets the SAME origin/destination
    // (only the date differs) — confirms it's one route sampled across dates,
    // not several different routes.
    const routes = new Set(calls.map(([params]) => `${params.from}->${params.to}`))
    expect(routes.size).toBe(1)
    const dates = new Set(calls.map(([params]) => params.depart))
    expect(dates.size).toBe(SAMPLE_DATE_OFFSETS_DAYS.length)
  })
})

describe('runSweetSpotCandidatePipeline() — incremental persistence + early stop at the cap', () => {
  it('persists each notable candidate as it is found and stops mining once the cap is hit', async () => {
    vi.mocked(listSweetSpotDrafts).mockResolvedValue([])
    vi.mocked(assembleSearch).mockResolvedValue(fakeSearchResult([fakeNotableAward()]))
    let nextId = 0
    vi.mocked(createSweetSpotDraft).mockImplementation(async () => `draft-${nextId++}`)
    vi.mocked(draftSweetSpotWhy).mockResolvedValue(null)

    const now = new Date('2026-07-05T00:00:00.000Z')
    // deadlineAt is checked against the REAL Date.now() (this test isn't
    // exercising the deadline itself — see the "timeout safety" describe
    // block above for that) — anchor it to the real clock, not `now` (a fixed
    // test date whose relationship to the real wall clock is otherwise
    // undefined and would make this test flaky).
    const result = await runSweetSpotCandidatePipeline(now, { deadlineAt: Date.now() + 10_000_000 })

    expect(result.created).toBe(MAX_NEW_CANDIDATES_PER_RUN)
    expect(result.found).toBe(MAX_NEW_CANDIDATES_PER_RUN)
    expect(result.drafts).toHaveLength(MAX_NEW_CANDIDATES_PER_RUN)
    expect(result.drafts.map((d) => d.programSlug)).toEqual(Array(MAX_NEW_CANDIDATES_PER_RUN).fill('lifemiles'))
    // Every persisted draft is distinct (a fresh route each time) and
    // deterministically ordered by discovery, not re-scored/re-ranked after
    // the fact — the tradeoff this early-stop design accepts (see the module
    // doc comment on runSweetSpotCandidatePipeline).
    expect(new Set(result.drafts.map((d) => d.route)).size).toBe(MAX_NEW_CANDIDATES_PER_RUN)

    // Mining stopped the instant the cap was hit: exactly the routes needed
    // to reach it were priced, not the full ~32-route grid.
    expect(vi.mocked(assembleSearch)).toHaveBeenCalledTimes(
      MAX_NEW_CANDIDATES_PER_RUN * SAMPLE_DATE_OFFSETS_DAYS.length,
    )
    expect(vi.mocked(createSweetSpotDraft)).toHaveBeenCalledTimes(MAX_NEW_CANDIDATES_PER_RUN)
  })

  it('a candidate that fails to persist counts toward found but not created, and mining continues past it', async () => {
    vi.mocked(listSweetSpotDrafts).mockResolvedValue([])
    vi.mocked(assembleSearch).mockResolvedValue(fakeSearchResult([fakeNotableAward()]))
    vi.mocked(createSweetSpotDraft).mockResolvedValue(null) // simulates a db failure on every attempt

    const now = new Date('2026-07-05T00:00:00.000Z')
    // Same real-clock anchoring as above — this test exercises the cap/found
    // bookkeeping, not the deadline.
    const result = await runSweetSpotCandidatePipeline(now, { deadlineAt: Date.now() + 10_000_000 })

    // Cap is never reached (nothing ever persists), so the full grid mines —
    // one notable candidate per hub/destination pair. Computed from the real
    // rotation rather than assuming a fixed slice size (the last slice of
    // lib/destinations.ts's rotation can be shorter than DESTINATIONS_PER_RUN).
    const expectedFound = ORIGIN_HUBS.length * destinationsForRun(now).length
    expect(result.found).toBe(expectedFound)
    expect(result.created).toBe(0)
    expect(result.drafts).toEqual([])
    expect(vi.mocked(updateSweetSpotDraftWhy)).not.toHaveBeenCalled()
  })
})
