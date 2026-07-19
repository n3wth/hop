import { afterEach, describe, expect, it } from 'vitest'
import {
  CRON_JOBS,
  DATASET_STALE_DAYS,
  FLAG_REQUIREMENTS,
  HEARTBEAT_STALE_FACTOR,
  MAX_ISSUES_PER_RUN,
  REOPEN_WINDOW_DAYS,
  SPIKE_FACTOR,
  SPIKE_MIN_EVENTS,
  VALUATION_DRIFT_THRESHOLD,
  WATCH_DEAD_DAYS,
  gatherFlagSeamInputs,
  runHealthChecks,
  type DetectorId,
  type HealthCheckInputs,
} from '@/lib/health-checks'
import { MIN_SAMPLES_TO_TRUST } from '@/lib/valuations-live'
import vercelConfig from '@/vercel.json'

// The detectors are PURE: inputs are handed in, `now` is handed in, zero env.
// Boundary tests follow the cpp-2.5 discipline: the exact threshold is on the
// healthy side; one unit past it detects. A null input is UNKNOWN — no
// findings AND no cleared subjects, so it can neither file nor resolve.

const NOW = new Date('2026-07-02T12:00:00.000Z')
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

const EMPTY: HealthCheckInputs = {
  heartbeats: null,
  degradation: null,
  flags: null,
  datasets: null,
  valuations: null,
  deadWatches: null,
}

function reportOf(overrides: Partial<HealthCheckInputs>, detector: DetectorId) {
  const report = runHealthChecks({ ...EMPTY, ...overrides }, NOW).find((r) => r.detector === detector)
  if (!report) throw new Error(`no report for ${detector}`)
  return report
}

const ORIGINAL_ENV = { ...process.env }
afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('threshold constants — named, exported, exact', () => {
  it('exports the decided values', () => {
    expect(HEARTBEAT_STALE_FACTOR).toBe(2)
    expect(DATASET_STALE_DAYS).toBe(120)
    expect(SPIKE_MIN_EVENTS).toBe(5)
    expect(SPIKE_FACTOR).toBe(3)
    expect(VALUATION_DRIFT_THRESHOLD).toBe(0.25)
    expect(WATCH_DEAD_DAYS).toBe(21)
    expect(MAX_ISSUES_PER_RUN).toBe(3)
    expect(REOPEN_WINDOW_DAYS).toBe(7)
  })

  it("reuses ADR 0005's trust gate verbatim", () => {
    expect(MIN_SAMPLES_TO_TRUST).toBe(20)
  })
})

describe('CRON_JOBS ↔ vercel.json — two sources of truth stay in lockstep', () => {
  it('matches paths AND schedule strings, both directions', () => {
    const crons = vercelConfig.crons as Array<{ path: string; schedule: string }>
    expect(crons.length).toBe(CRON_JOBS.length)
    for (const spec of CRON_JOBS) {
      const cron = crons.find((c) => c.path === spec.path)
      expect(cron, `vercel.json is missing ${spec.path}`).toBeDefined()
      expect(cron?.schedule).toBe(spec.schedule)
    }
  })
})

describe('D1 cron liveness', () => {
  const spec = CRON_JOBS.find((j) => j.job === 'standing-orders')!
  const heartbeat = (ageMs: number) => ({
    job: 'standing-orders',
    lastRunAt: new Date(NOW.getTime() - ageMs).toISOString(),
    ok: true,
  })

  it('exactly 2× the interval old → still healthy (cleared)', () => {
    const r = reportOf(
      { heartbeats: [heartbeat(HEARTBEAT_STALE_FACTOR * spec.expectedIntervalMs)] },
      'cron-liveness',
    )
    expect(r.status).toBe('ok')
    expect(r.findings).toHaveLength(0)
    expect(r.clearedSubjects).toContain('standing-orders')
  })

  it('one millisecond past 2× → cron-dead finding at P1', () => {
    const r = reportOf(
      { heartbeats: [heartbeat(HEARTBEAT_STALE_FACTOR * spec.expectedIntervalMs + 1)] },
      'cron-liveness',
    )
    expect(r.status).toBe('findings')
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0].fingerprint).toBe('cron-dead:standing-orders')
    expect(r.findings[0].severity).toBe('p1')
    expect(r.clearedSubjects).not.toContain('standing-orders')
  })

  it('a fresh ok:false disabled heartbeat is NOT dead (age-only, owner choice)', () => {
    const r = reportOf(
      {
        heartbeats: [
          { job: 'standing-orders', lastRunAt: NOW.toISOString(), ok: false, note: 'disabled' },
        ],
      },
      'cron-liveness',
    )
    expect(r.findings).toHaveLength(0)
    expect(r.clearedSubjects).toContain('standing-orders')
  })

  it('a job with no heartbeat row yet is unknown for that job — no finding, no clear', () => {
    const r = reportOf({ heartbeats: [heartbeat(0)] }, 'cron-liveness')
    expect(r.findings).toHaveLength(0)
    expect(r.clearedSubjects).toEqual(['standing-orders'])
  })

  it('null heartbeats input → detector unknown: neither files nor resolves', () => {
    const r = reportOf({ heartbeats: null }, 'cron-liveness')
    expect(r.status).toBe('unknown')
    expect(r.findings).toHaveLength(0)
    expect(r.clearedSubjects).toHaveLength(0)
  })

  it('fingerprints are stable across runs (same failure → same fingerprint)', () => {
    const stale = { heartbeats: [heartbeat(10 * DAY_MS)] }
    const a = reportOf(stale, 'cron-liveness').findings[0]
    const b = reportOf(stale, 'cron-liveness').findings[0]
    expect(a.fingerprint).toBe(b.fingerprint)
    expect(a.fingerprint).toBe('cron-dead:standing-orders')
  })
})

describe('D2 upstream degradation spike', () => {
  it('4 events on a zero baseline → nothing; 5 → finding', () => {
    const four = reportOf(
      { degradation: { last24h: { cash: SPIKE_MIN_EVENTS - 1 }, priorWeekDailyMean: {} } },
      'upstream-spike',
    )
    expect(four.findings).toHaveLength(0)
    expect(four.clearedSubjects).toContain('cash')

    const five = reportOf(
      { degradation: { last24h: { cash: SPIKE_MIN_EVENTS }, priorWeekDailyMean: {} } },
      'upstream-spike',
    )
    expect(five.findings).toHaveLength(1)
    expect(five.findings[0].fingerprint).toBe('upstream-spike:cash')
    expect(five.findings[0].severity).toBe('p3')
  })

  it('a real baseline raises the line to SPIKE_FACTOR × mean', () => {
    // mean 2/day → line = max(5, 6) = 6.
    const under = reportOf(
      { degradation: { last24h: { awards: 5 }, priorWeekDailyMean: { awards: 2 } } },
      'upstream-spike',
    )
    expect(under.findings).toHaveLength(0)

    const at = reportOf(
      { degradation: { last24h: { awards: 6 }, priorWeekDailyMean: { awards: 2 } } },
      'upstream-spike',
    )
    expect(at.findings).toHaveLength(1)
    expect(at.findings[0].fingerprint).toBe('upstream-spike:awards')
  })

  it('a zero-event source is VERIFIED healthy (clears a prior spike)', () => {
    const r = reportOf({ degradation: { last24h: {}, priorWeekDailyMean: {} } }, 'upstream-spike')
    expect(r.status).toBe('ok')
    expect(r.clearedSubjects).toEqual(expect.arrayContaining(['cash', 'awards', 'balances']))
  })

  it('route variance never forks the fingerprint (identity is the source alone)', () => {
    const r = reportOf(
      { degradation: { last24h: { cash: 12 }, priorWeekDailyMean: { cash: 0.5 } } },
      'upstream-spike',
    )
    expect(r.findings.map((f) => f.fingerprint)).toEqual(['upstream-spike:cash'])
  })

  it('null degradation input → unknown', () => {
    const r = reportOf({ degradation: null }, 'upstream-spike')
    expect(r.status).toBe('unknown')
    expect(r.clearedSubjects).toHaveLength(0)
  })
})

describe('D3 flag/key drift', () => {
  function seamInput(flag: string) {
    const seam = gatherFlagSeamInputs().find((s) => s.flag === flag)
    if (!seam) throw new Error(`no seam for ${flag}`)
    return seam
  }

  it('flag on + key absent → drift finding', () => {
    process.env.HOP_ENABLE_CHECKOUT = '1'
    delete process.env.DUFFEL_API_KEY_TEST
    const seam = seamInput('HOP_ENABLE_CHECKOUT')
    expect(seam.flagOn).toBe(true)
    expect(seam.missingKeys).toEqual(['DUFFEL_API_KEY_TEST'])

    const r = reportOf({ flags: [seam] }, 'flag-drift')
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0].fingerprint).toBe('flag-drift:HOP_ENABLE_CHECKOUT')
    expect(r.findings[0].severity).toBe('p3')
  })

  it('both absent → no drift (cleared)', () => {
    delete process.env.HOP_ENABLE_CHECKOUT
    delete process.env.DUFFEL_API_KEY_TEST
    const r = reportOf({ flags: [seamInput('HOP_ENABLE_CHECKOUT')] }, 'flag-drift')
    expect(r.findings).toHaveLength(0)
    expect(r.clearedSubjects).toContain('HOP_ENABLE_CHECKOUT')
  })

  it('both present → no drift (cleared)', () => {
    process.env.HOP_ENABLE_CHECKOUT = '1'
    process.env.DUFFEL_API_KEY_TEST = 'duffel_test_x'
    const r = reportOf({ flags: [seamInput('HOP_ENABLE_CHECKOUT')] }, 'flag-drift')
    expect(r.findings).toHaveLength(0)
    expect(r.clearedSubjects).toContain('HOP_ENABLE_CHECKOUT')
  })

  it('null flags input → unknown', () => {
    const r = reportOf({ flags: null }, 'flag-drift')
    expect(r.status).toBe('unknown')
  })

  // The corrected D3 design: the detector reads the RAW flag + hasEnv, never
  // the composite (which folds key presence in and is blind to drift). This
  // assertion keeps FLAG_REQUIREMENTS honest against the seams it audits:
  // composite === (flagOn && keysPresent) in every state.
  it('consistency: composite === (flagOn && keysPresent) for every seam, in all four states', () => {
    for (const seam of FLAG_REQUIREMENTS) {
      for (const flagOn of [false, true]) {
        for (const keysPresent of [false, true]) {
          if (flagOn) process.env[seam.flag] = '1'
          else delete process.env[seam.flag]
          for (const key of seam.requiredKeys) {
            if (keysPresent) process.env[key] = 'test-value'
            else delete process.env[key]
          }
          const input = gatherFlagSeamInputs().find((s) => s.flag === seam.flag)!
          expect(input.flagOn).toBe(flagOn)
          expect(input.missingKeys.length === 0).toBe(keysPresent)
          expect(
            seam.composite(),
            `${seam.compositeName} disagrees with FLAG_REQUIREMENTS at flagOn=${flagOn}, keysPresent=${keysPresent}`,
          ).toBe(flagOn && keysPresent)
          process.env = { ...ORIGINAL_ENV }
        }
      }
    }
  })
})

describe('D4 committed-dataset staleness', () => {
  const dataset = (ageMs: number) => ({
    name: 'place-facts',
    file: 'lib/place-facts.ts',
    generatedAt: new Date(NOW.getTime() - ageMs).toISOString(),
  })

  it('exactly DATASET_STALE_DAYS old → healthy', () => {
    const r = reportOf({ datasets: [dataset(DATASET_STALE_DAYS * DAY_MS)] }, 'dataset-stale')
    expect(r.findings).toHaveLength(0)
    expect(r.clearedSubjects).toContain('place-facts')
  })

  it('one day past the line → finding', () => {
    const r = reportOf({ datasets: [dataset((DATASET_STALE_DAYS + 1) * DAY_MS)] }, 'dataset-stale')
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0].fingerprint).toBe('dataset-stale:place-facts')
    expect(r.findings[0].title).toContain(`${DATASET_STALE_DAYS + 1} days old`)
  })

  it('a dataset with no stamp yet is unknown for that dataset — no finding, no clear', () => {
    const r = reportOf(
      { datasets: [{ name: 'climate-normals', file: 'lib/climate-normals.ts', generatedAt: null }] },
      'dataset-stale',
    )
    expect(r.findings).toHaveLength(0)
    expect(r.clearedSubjects).toHaveLength(0)
  })

  it('null datasets input → unknown', () => {
    const r = reportOf({ datasets: null }, 'dataset-stale')
    expect(r.status).toBe('unknown')
  })
})

describe('D5 valuation drift', () => {
  // Baseline 2.0 keeps the boundary exact in floating point: 2.5 → drift 0.25.
  const valuations = (cpp: number, sampleSize: number): HealthCheckInputs['valuations'] => ({
    baseline: { alaska: 2.0 },
    overrides: [{ programId: 'alaska', cpp, sampleSize }],
  })

  it('drift exactly at the threshold → healthy', () => {
    const r = reportOf({ valuations: valuations(2.5, MIN_SAMPLES_TO_TRUST) }, 'valuation-drift')
    expect(r.findings).toHaveLength(0)
    expect(r.clearedSubjects).toContain('alaska')
  })

  it('drift above the threshold with enough samples → finding', () => {
    const r = reportOf({ valuations: valuations(2.51, MIN_SAMPLES_TO_TRUST) }, 'valuation-drift')
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0].fingerprint).toBe('valuation-drift:alaska')
    expect(r.findings[0].severity).toBe('p3')
  })

  it('drift below (downward drift symmetric) at exactly the threshold → healthy', () => {
    const r = reportOf({ valuations: valuations(1.5, MIN_SAMPLES_TO_TRUST) }, 'valuation-drift')
    expect(r.findings).toHaveLength(0)
  })

  it('huge drift under the sample gate → NOTHING (trust gate) — no finding, no clear', () => {
    const r = reportOf({ valuations: valuations(3.8, MIN_SAMPLES_TO_TRUST - 1) }, 'valuation-drift')
    expect(r.findings).toHaveLength(0)
    expect(r.clearedSubjects).toHaveLength(0)
  })

  it('a program without a baseline is skipped, never a division by zero', () => {
    const r = reportOf(
      {
        valuations: {
          baseline: {},
          overrides: [{ programId: 'mystery', cpp: 9, sampleSize: 50 }],
        },
      },
      'valuation-drift',
    )
    expect(r.findings).toHaveLength(0)
    expect(r.clearedSubjects).toHaveLength(0)
  })

  it('null valuations input → unknown (a dead table must not resolve drift findings)', () => {
    const r = reportOf({ valuations: null }, 'valuation-drift')
    expect(r.status).toBe('unknown')
  })
})

describe('D6 dead watches', () => {
  it('zero dead watches → healthy', () => {
    const r = reportOf({ deadWatches: 0 }, 'dead-watches')
    expect(r.findings).toHaveLength(0)
    expect(r.clearedSubjects).toContain('all')
  })

  it('positive count → finding', () => {
    const r = reportOf({ deadWatches: 5 }, 'dead-watches')
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0].fingerprint).toBe('dead-watches:all')
    expect(r.findings[0].title).toContain('5 counted')
    expect(r.findings[0].body).toContain('5 active, unalerted watches')
    expect(r.findings[0].severity).toBe('p3')
  })

  it('null deadWatches input → unknown', () => {
    const r = reportOf({ deadWatches: null }, 'dead-watches')
    expect(r.status).toBe('unknown')
  })
})

describe('all-null inputs — the fully degraded run', () => {
  it('every detector reports unknown; nothing files, nothing resolves', () => {
    const reports = runHealthChecks(EMPTY, NOW)
    expect(reports).toHaveLength(6)
    for (const r of reports) {
      expect(r.status).toBe('unknown')
      expect(r.findings).toHaveLength(0)
      expect(r.clearedSubjects).toHaveLength(0)
    }
  })
})
