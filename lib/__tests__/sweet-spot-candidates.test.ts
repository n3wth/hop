import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  ORIGIN_HUBS,
  DESTINATIONS_PER_RUN,
  MAX_NEW_CANDIDATES_PER_RUN,
  NOTABILITY_BASELINE_MULTIPLIER,
  PROGRAM_ID_TO_SWEET_SPOT_SLUG,
  isNotable,
  draftKey,
  buildExistingKeys,
  filterNewCandidates,
  rankAndCapCandidates,
  destinationsForRun,
  runSweetSpotCandidatePipeline,
  type SweetSpotCandidate,
} from '@/lib/sweet-spot-candidates'
import { CONTENT_CANDIDATES_CREATED_BY } from '@/lib/sweet-spot-constants'
import { POINTS_THRESHOLD_CPP } from '@/lib/search'
import { allPrograms, sweetSpots } from '@/lib/sweet-spots'
import { destinations } from '@/lib/destinations'
import { isContentCandidatesEnabled } from '@/lib/env'

// The pipeline mines the SAME assembleSearch funnel every real search uses,
// scores real (never estimated) cpp figures, and only ever writes
// pending_review rows — never approves. Every helper below is pure by design
// (see lib/sweet-spot-candidates.ts) specifically so these tests don't need
// to mock assembleSearch/the db to exercise the scoring/dedup/cap logic.

function candidate(overrides: Partial<SweetSpotCandidate> = {}): SweetSpotCandidate {
  return {
    route: 'SFO → NRT',
    programSlug: 'alaska-atmos',
    program: 'Alaska / Atmos',
    cabin: 'Business',
    milesOw: 60000,
    milesLabel: '60k',
    cpp: 4.1,
    baseline: 1.4,
    sampleCount: 3,
    notes: 'Observed ~4.1¢/pt over 3 sampled dates vs ~1.4¢/pt typical for this program.',
    destCountry: 'Japan',
    destRegion: 'Asia',
    ...overrides,
  }
}

describe('isNotable() — both gates required', () => {
  it('requires the POINTS_THRESHOLD_CPP floor even with a huge baseline multiple', () => {
    // 3x baseline but under the absolute cpp floor.
    expect(isNotable(1.0, 0.3)).toBe(false)
  })

  it('requires the baseline multiplier even above the absolute cpp floor', () => {
    // Clears POINTS_THRESHOLD_CPP but is not 1.3x this program's own baseline.
    expect(isNotable(POINTS_THRESHOLD_CPP, POINTS_THRESHOLD_CPP)).toBe(false)
  })

  it('exactly at both boundaries is notable', () => {
    const baseline = 2.0
    expect(isNotable(baseline * NOTABILITY_BASELINE_MULTIPLIER, baseline)).toBe(true)
  })

  it('one unit below either boundary is not notable', () => {
    const baseline = 2.0
    expect(isNotable(baseline * NOTABILITY_BASELINE_MULTIPLIER - 0.01, baseline)).toBe(false)
  })

  it('degrades to false on non-finite/zero/negative input, never throws', () => {
    expect(isNotable(NaN, 2)).toBe(false)
    expect(isNotable(5, 0)).toBe(false)
    expect(isNotable(5, -1)).toBe(false)
    expect(isNotable(Infinity, 2)).toBe(false)
  })
})

describe('PROGRAM_ID_TO_SWEET_SPOT_SLUG — every value is a real sweet-spots slug', () => {
  it('maps only to slugs that exist in lib/sweet-spots.ts', () => {
    const known = new Set(allPrograms())
    for (const slug of Object.values(PROGRAM_ID_TO_SWEET_SPOT_SLUG)) {
      expect(known.has(slug)).toBe(true)
    }
  })

  it('a mined program absent from the map is dropped, not guessed', () => {
    // 'united' has no sweet-spots page — lib/sweet-spot-candidates.ts must
    // never invent a slug for it.
    expect(PROGRAM_ID_TO_SWEET_SPOT_SLUG.united).toBeUndefined()
  })
})

describe('draftKey() / buildExistingKeys() / filterNewCandidates() — dedup, pure', () => {
  it('a seen draft blocks the same combo — the key never carries status, so this holds for pending/approved/rejected alike', () => {
    const keys = buildExistingKeys(
      [{ route: 'SFO → NRT', programSlug: 'alaska-atmos', cabin: 'Business' }],
      [],
    )
    expect(keys.has(draftKey('SFO → NRT', 'alaska-atmos', 'Business'))).toBe(true)
  })

  it('a combo already in the static seed table is excluded even with zero drafts', () => {
    const seed = sweetSpots[0]
    const keys = buildExistingKeys([], sweetSpots)
    expect(keys.has(draftKey(seed.route, seed.programSlug, seed.cabin))).toBe(true)
  })

  it('filterNewCandidates drops exactly the combos already seen', () => {
    const seen = candidate({ route: 'SFO → NRT', programSlug: 'alaska-atmos' })
    const fresh = candidate({ route: 'JFK → CDG', programSlug: 'aeroplan' })
    const keys = buildExistingKeys(
      [{ route: seen.route, programSlug: seen.programSlug, cabin: seen.cabin }],
      [],
    )
    expect(filterNewCandidates([seen, fresh], keys)).toEqual([fresh])
  })

  it('draftKey() is case/whitespace-insensitive', () => {
    expect(draftKey('  sfo → nrt ', 'ALASKA-ATMOS', 'business')).toBe(draftKey('SFO → NRT', 'alaska-atmos', 'Business'))
  })

  // The P1 this covers: mined candidates are airport pairs ("SFO → NRT"), but
  // lib/sweet-spots.ts's static seed table uses region strings ("US ↔ Japan",
  // "US ↔ Asia") — an exact draftKey() match between the two can never fire,
  // so the static half of dedup was dead code for real mined data. This test
  // fails against a filterNewCandidates() that only checks the candidate's
  // own literal route (the pre-fix behavior) and passes once static-table
  // dedup goes through staticRouteAliasKeys()'s country/region aliases.
  it('a mined airport-pair candidate is dropped as a duplicate of a static region-string seed row for the same program/cabin', () => {
    // Real static row: lib/sweet-spots.ts has { route: 'US ↔ Japan', programSlug:
    // 'alaska-atmos', cabin: 'Business' } — candidate()'s defaults (SFO → NRT,
    // alaska-atmos, Business, destCountry 'Japan') are chosen to collide with it.
    const mined = candidate()
    const keys = buildExistingKeys([], sweetSpots)
    expect(filterNewCandidates([mined], keys)).toEqual([])
  })

  it('a mined candidate for a genuinely new combo survives dedup against the static table', () => {
    const mined = candidate({
      route: 'ORD → GIG',
      programSlug: 'lifemiles',
      cabin: 'Business',
      destCountry: 'Brazil',
      destRegion: 'South America',
    })
    const keys = buildExistingKeys([], sweetSpots)
    expect(filterNewCandidates([mined], keys)).toEqual([mined])
  })
})

describe('rankAndCapCandidates() — ranked by cpp/baseline desc, capped', () => {
  it('caps to MAX_NEW_CANDIDATES_PER_RUN, strongest ratios first', () => {
    const weak = candidate({ route: 'A', cpp: 3.0, baseline: 1.5 }) // 2.0x
    const strong = candidate({ route: 'B', cpp: 6.0, baseline: 1.5 }) // 4.0x
    const mid = candidate({ route: 'C', cpp: 4.5, baseline: 1.5 }) // 3.0x
    const extra = candidate({ route: 'D', cpp: 3.75, baseline: 1.5 }) // 2.5x
    const ranked = rankAndCapCandidates([weak, strong, mid, extra])
    expect(ranked).toHaveLength(MAX_NEW_CANDIDATES_PER_RUN)
    expect(ranked.map((c) => c.route)).toEqual(['B', 'C', 'D'])
  })

  it('does not mutate the input array', () => {
    const input = [candidate({ route: 'A', cpp: 3, baseline: 1.5 }), candidate({ route: 'B', cpp: 6, baseline: 1.5 })]
    const copy = [...input]
    rankAndCapCandidates(input)
    expect(input).toEqual(copy)
  })
})

describe('destinationsForRun() — a stable daily rotation over lib/destinations.ts', () => {
  it('returns at most DESTINATIONS_PER_RUN destinations', () => {
    expect(destinationsForRun(new Date('2026-07-05')).length).toBeLessThanOrEqual(DESTINATIONS_PER_RUN)
  })

  it('is deterministic for the same calendar day', () => {
    const a = destinationsForRun(new Date('2026-07-05T01:00:00Z'))
    const b = destinationsForRun(new Date('2026-07-05T23:00:00Z'))
    expect(a.map((d) => d.code)).toEqual(b.map((d) => d.code))
  })

  it('every returned destination is a real lib/destinations.ts entry', () => {
    const known = new Set(destinations.map((d) => d.code))
    for (const d of destinationsForRun(new Date('2026-07-05'))) {
      expect(known.has(d.code)).toBe(true)
    }
  })
})

describe('isContentCandidatesEnabled() — the double lock', () => {
  const KEYS = ['HOP_ENABLE_CONTENT_CANDIDATES', 'SEATS_AERO_API_KEY', 'DUFFEL_API_KEY_LIVE'] as const
  const ORIGINAL: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of KEYS) {
      ORIGINAL[k] = process.env[k]
      delete process.env[k]
    }
  })
  afterEach(() => {
    for (const k of KEYS) {
      if (ORIGINAL[k] === undefined) delete process.env[k]
      else process.env[k] = ORIGINAL[k]
    }
  })

  it('is false by default (no flag, no keys)', () => {
    expect(isContentCandidatesEnabled()).toBe(false)
  })

  it('flag alone is insufficient', () => {
    process.env.HOP_ENABLE_CONTENT_CANDIDATES = '1'
    expect(isContentCandidatesEnabled()).toBe(false)
  })

  it('keys alone are insufficient', () => {
    process.env.SEATS_AERO_API_KEY = 'test-key'
    process.env.DUFFEL_API_KEY_LIVE = 'test-key'
    expect(isContentCandidatesEnabled()).toBe(false)
  })

  it('requires the flag AND both keys', () => {
    process.env.HOP_ENABLE_CONTENT_CANDIDATES = '1'
    process.env.SEATS_AERO_API_KEY = 'test-key'
    expect(isContentCandidatesEnabled()).toBe(false)
    process.env.DUFFEL_API_KEY_LIVE = 'test-key'
    expect(isContentCandidatesEnabled()).toBe(true)
  })
})

describe('runSweetSpotCandidatePipeline() — degrade-safe', () => {
  const KEYS = ['SEATS_AERO_API_KEY', 'DUFFEL_API_KEY_LIVE'] as const
  const ORIGINAL: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of KEYS) {
      ORIGINAL[k] = process.env[k]
      delete process.env[k]
    }
  })
  afterEach(() => {
    for (const k of KEYS) {
      if (ORIGINAL[k] === undefined) delete process.env[k]
      else process.env[k] = ORIGINAL[k]
    }
  })

  it('resolves to created:0 found:0 drafts:[] with no live pricing keys or db configured — no network calls, never throws', async () => {
    await expect(runSweetSpotCandidatePipeline(new Date('2026-07-05'))).resolves.toEqual({
      created: 0,
      found: 0,
      drafts: [],
    })
  })

  it('mines within the documented origin hub set', () => {
    expect(ORIGIN_HUBS).toEqual(['SFO', 'JFK', 'ORD', 'LAX'])
  })
})

// Deadline/incremental-persist/early-stop-at-cap behavior is covered in
// lib/__tests__/sweet-spot-candidates-pipeline.test.ts, which mocks
// assembleSearch + the sweet-spot-drafts persistence functions to exercise
// the orchestration deterministically (this file stays mock-free so the
// degrade-safe test above exercises the REAL upstream/db gating).

describe('CONTENT_CANDIDATES_CREATED_BY — the provenance sentinel', () => {
  it('is not shaped like an owner email (never mistaken for one)', () => {
    expect(CONTENT_CANDIDATES_CREATED_BY).toBe('auto:content-candidates')
    expect(CONTENT_CANDIDATES_CREATED_BY).not.toContain('@')
  })
})
