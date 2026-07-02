// Pure health detectors (ADR 0007) — the health sentinel's brain.
//
// THE RESIDUAL PRINCIPLE: every signal here is a residual of a computation the
// engine already performs — heartbeat ages, counted degradation rows, env
// presence, dataset date stamps, observed-vs-baseline cpp deltas. Every number
// is a counted row, a timestamp difference, or a named exported constant. No
// LLM computes, ranks, or thresholds anything.
//
// runHealthChecks(inputs, now) is PURE: the sentinel route
// (app/api/cron/health-sentinel/route.ts) gathers the inputs — each its own
// degradable query — so every detector is unit-testable with zero env. A null
// input means UNKNOWN: that detector neither files nor resolves ("no data" is
// never "fixed"). gatherFlagSeamInputs() is the one deliberate env-touching
// export: it probes flag booleans plus key PRESENCE (via hasEnv — never
// values) at call time, because env IS its subject.

import {
  hasEnv,
  isBillingEnabled,
  isCheckoutEnabled,
  isGmailHistoryEnabled,
  isValuationSyncEnabled,
  type EnvKey,
} from '@/lib/env'
import { MIN_SAMPLES_TO_TRUST } from '@/lib/valuations-live'
import { renderFinding } from '@/lib/improvement-templates'

// ── Thresholds — named, exported, never guessed ─────────────────────────────
// A heartbeat older than HEARTBEAT_STALE_FACTOR × its job's nominal interval
// counts as a dead cron (exactly at the line is still healthy).
export const HEARTBEAT_STALE_FACTOR = 2
// A committed dataset older than this many days is stale (D4).
export const DATASET_STALE_DAYS = 120
// D2 spike line: max(SPIKE_MIN_EVENTS, SPIKE_FACTOR × prior-week daily mean).
// The min-volume floor keeps a quiet site from alarming on 2 events.
export const SPIKE_MIN_EVENTS = 5
export const SPIKE_FACTOR = 3
// D5: |observed − baseline| / baseline strictly above this is drift, and only
// when the override clears ADR 0005's MIN_SAMPLES_TO_TRUST gate.
export const VALUATION_DRIFT_THRESHOLD = 0.25
// D6 (dead watches) ships in PR 2 — the threshold lives here now so every
// loop constant has one home.
export const WATCH_DEAD_DAYS = 21
// The sentinel files at most this many new issues per run (spam bound).
export const MAX_ISSUES_PER_RUN = 3
// A finding re-detected within this window of resolving reopens the SAME row
// (same Linear issue) — a flapping source can never pile up issues.
export const REOPEN_WINDOW_DAYS = 7

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

// ── Cron registry — kept in lockstep with vercel.json by a vitest ───────────
// (lib/__tests__/health-checks.test.ts asserts paths AND schedule strings
// match, the ADR 0006 "two sources of truth" failure class.)
export type CronJob =
  | 'standing-orders'
  | 'revalidate-seo'
  | 'valuation-sync'
  | 'business-digest'
  | 'health-sentinel'
  | 'sync-stripe'

export interface CronJobSpec {
  job: CronJob
  path: string
  schedule: string
  expectedIntervalMs: number
}

export const CRON_JOBS: readonly CronJobSpec[] = [
  { job: 'standing-orders', path: '/api/cron/standing-orders', schedule: '0 */6 * * *', expectedIntervalMs: 6 * HOUR_MS },
  { job: 'revalidate-seo', path: '/api/cron/revalidate-seo', schedule: '0 6 * * 0', expectedIntervalMs: 7 * DAY_MS },
  { job: 'valuation-sync', path: '/api/cron/valuation-sync', schedule: '30 13 * * *', expectedIntervalMs: DAY_MS },
  { job: 'sync-stripe', path: '/api/cron/sync-stripe', schedule: '0 2 * * *', expectedIntervalMs: DAY_MS },
  { job: 'business-digest', path: '/api/cron/business-digest', schedule: '7 14 * * 1', expectedIntervalMs: 7 * DAY_MS },
  { job: 'health-sentinel', path: '/api/cron/health-sentinel', schedule: '17 11 * * *', expectedIntervalMs: DAY_MS },
]

// ── Flag/key seam registry (D3) ─────────────────────────────────────────────
// D3 reads TWO independent inputs per seam: the RAW flag state (parsed with
// the same 1|true|yes rule the lib/env.ts helpers use) and key PRESENCE via
// hasEnv. It must NOT read the composite is*Enabled() helpers as its flag
// source — several fold key presence into the boolean (e.g. isCheckoutEnabled
// is flag AND hasEnv('DUFFEL_API_KEY_TEST')), so in the exact drift state
// (flag on, key missing) the composite reads false and the detector would be
// structurally blind. The composites still keep this table honest the other
// way: a unit-tested consistency assertion checks composite === (flagOn &&
// keysPresent) for every row, so the table can never drift from the seams it
// audits.
//
// Only seams whose required keys are lib/env.ts EnvKeys appear here (hasEnv is
// the only sanctioned presence probe). The convo-memory / inferred-facts seams
// key on AI_GATEWAY_API_KEY, which is not an EnvKey — add them when it is.
// Flag-ONLY seams (observed-outcomes, self-improve) have nothing to drift; the
// self-improve Linear keys are deliberately absent too, because flag-on with
// no Linear key is the DESIGNED detect-and-record mode, not drift.
export interface FlagSeam {
  /** Raw HOP_ENABLE_* env var name — D3's flag-state source (never the composite). */
  flag: string
  /** Keys the seam needs. Probed via hasEnv only: presence, never values. */
  requiredKeys: readonly EnvKey[]
  /** The fused helper this row audits — used ONLY by the consistency test. */
  composite: () => boolean
  compositeName: string
}

export const FLAG_REQUIREMENTS: readonly FlagSeam[] = [
  {
    flag: 'HOP_ENABLE_CHECKOUT',
    requiredKeys: ['DUFFEL_API_KEY_TEST'],
    composite: isCheckoutEnabled,
    compositeName: 'isCheckoutEnabled',
  },
  {
    flag: 'HOP_ENABLE_GMAIL_HISTORY',
    requiredKeys: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'],
    composite: isGmailHistoryEnabled,
    compositeName: 'isGmailHistoryEnabled',
  },
  {
    flag: 'HOP_ENABLE_VALUATION_SYNC',
    requiredKeys: ['HOP_VALUATION_WORKER_URL', 'HOP_VALUATION_SYNC_SECRET'],
    composite: isValuationSyncEnabled,
    compositeName: 'isValuationSyncEnabled',
  },
  {
    flag: 'HOP_ENABLE_BILLING',
    requiredKeys: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID_PRO_MONTHLY'],
    composite: isBillingEnabled,
    compositeName: 'isBillingEnabled',
  },
]

export interface FlagSeamInput {
  flag: string
  flagOn: boolean
  missingKeys: string[]
}

// The one env-reading function in this module (env is D3's subject). Flags are
// non-secret booleans, parsed with lib/env.ts's exact 1|true|yes convention;
// keys are probed via hasEnv — presence only, never values, nothing logged.
export function gatherFlagSeamInputs(): FlagSeamInput[] {
  return FLAG_REQUIREMENTS.map((seam) => ({
    flag: seam.flag,
    flagOn: /^(1|true|yes)$/i.test((process.env[seam.flag] ?? '').trim()),
    missingKeys: seam.requiredKeys.filter((k) => !hasEnv(k)),
  }))
}

// ── Detections, findings, reports ───────────────────────────────────────────
export type FindingKind =
  | 'cron-dead'
  | 'upstream-spike'
  | 'flag-drift'
  | 'dataset-stale'
  | 'valuation-drift'

export type FindingSeverity = 'p1' | 'p3'

// A structured detection: every number a template renders arrives here
// pre-computed (lib/improvement-templates.ts only formats).
export type Detection =
  | {
      kind: 'cron-dead'
      subject: string
      data: { lastRunAt: string; ageHours: number; expectedIntervalHours: number; staleAfterHours: number }
    }
  | {
      kind: 'upstream-spike'
      subject: string
      data: { count24h: number; priorDailyMean: number; threshold: number }
    }
  | {
      kind: 'flag-drift'
      subject: string
      data: { missingKeys: string[] }
    }
  | {
      kind: 'dataset-stale'
      subject: string
      data: { file: string; generatedAt: string; ageDays: number; staleAfterDays: number }
    }
  | {
      kind: 'valuation-drift'
      subject: string
      data: {
        observedCpp: number
        baselineCpp: number
        sampleSize: number
        sampleGate: number
        driftShare: number
        thresholdShare: number
      }
    }

export interface HealthFinding {
  kind: FindingKind
  subject: string
  /** Stable identity: `${kind}:${subject}` — same failure, same fingerprint, every run. */
  fingerprint: string
  severity: FindingSeverity
  title: string
  body: string
}

export type DetectorId =
  | 'cron-liveness'
  | 'upstream-spike'
  | 'flag-drift'
  | 'dataset-stale'
  | 'valuation-drift'

export interface DetectorReport {
  detector: DetectorId
  kind: FindingKind
  /** 'unknown' = degraded input: neither files nor resolves. */
  status: 'ok' | 'findings' | 'unknown'
  findings: HealthFinding[]
  /** Subjects VERIFIED healthy this run — the only ones eligible to resolve. */
  clearedSubjects: string[]
}

export interface HealthCheckInputs {
  /** D1 — null when the heartbeat read degraded. */
  heartbeats: Array<{ job: string; lastRunAt: string; ok: boolean; note?: string | null }> | null
  /** D2 — null when the degradation-events read degraded. */
  degradation: { last24h: Record<string, number>; priorWeekDailyMean: Record<string, number> } | null
  /** D3 — from gatherFlagSeamInputs(); null kept for input-shape uniformity. */
  flags: FlagSeamInput[] | null
  /** D4 — generatedAt is null per-dataset when it carries no stamp yet (unknown). */
  datasets: Array<{ name: string; file: string; generatedAt: string | null }> | null
  /** D5 — null when the overrides read degraded ([] from a dead table must not read as "no drift"). */
  valuations: {
    baseline: Record<string, number>
    overrides: Array<{ programId: string; cpp: number; sampleSize: number }>
  } | null
}

export function fingerprintOf(kind: FindingKind, subject: string): string {
  return `${kind}:${subject}`
}

function severityOf(kind: FindingKind): FindingSeverity {
  // Everything files at P3 except a dead cron: the loops themselves depend on
  // crons running, so that one is the pager-grade signal.
  return kind === 'cron-dead' ? 'p1' : 'p3'
}

function toFinding(d: Detection): HealthFinding {
  const { title, body } = renderFinding(d)
  return {
    kind: d.kind,
    subject: d.subject,
    fingerprint: fingerprintOf(d.kind, d.subject),
    severity: severityOf(d.kind),
    title,
    body,
  }
}

function report(
  detector: DetectorId,
  kind: FindingKind,
  findings: HealthFinding[],
  clearedSubjects: string[],
): DetectorReport {
  return { detector, kind, status: findings.length > 0 ? 'findings' : 'ok', findings, clearedSubjects }
}

function unknownReport(detector: DetectorId, kind: FindingKind): DetectorReport {
  return { detector, kind, status: 'unknown', findings: [], clearedSubjects: [] }
}

// ── D1: cron liveness ───────────────────────────────────────────────────────
// Age-only, by design: a fresh `ok:false note:'disabled'` heartbeat is an
// owner choice, not an outage. A job with NO row yet is unknown for that job
// (day-one silence is not "dead", and not "healthy" either).
function checkCronLiveness(
  heartbeats: HealthCheckInputs['heartbeats'],
  now: Date,
): DetectorReport {
  if (heartbeats === null) return unknownReport('cron-liveness', 'cron-dead')
  const findings: HealthFinding[] = []
  const cleared: string[] = []
  for (const spec of CRON_JOBS) {
    const hb = heartbeats.find((h) => h.job === spec.job)
    if (!hb) continue
    const t = Date.parse(hb.lastRunAt)
    if (!Number.isFinite(t)) continue
    const age = now.getTime() - t
    const staleAfterMs = HEARTBEAT_STALE_FACTOR * spec.expectedIntervalMs
    if (age > staleAfterMs) {
      findings.push(
        toFinding({
          kind: 'cron-dead',
          subject: spec.job,
          data: {
            lastRunAt: hb.lastRunAt,
            ageHours: age / HOUR_MS,
            expectedIntervalHours: spec.expectedIntervalMs / HOUR_MS,
            staleAfterHours: staleAfterMs / HOUR_MS,
          },
        }),
      )
    } else {
      cleared.push(spec.job)
    }
  }
  return report('cron-liveness', 'cron-dead', findings, cleared)
}

// ── D2: upstream degradation spike ──────────────────────────────────────────
// The sources assembleSearch can degrade (lib/search.ts) — a zero-count source
// is VERIFIED healthy (clears a prior spike), unlike a missing input.
const KNOWN_DEGRADATION_SOURCES = ['cash', 'awards', 'balances'] as const

function checkUpstreamSpike(degradation: HealthCheckInputs['degradation']): DetectorReport {
  if (degradation === null) return unknownReport('upstream-spike', 'upstream-spike')
  const sources = new Set<string>([
    ...KNOWN_DEGRADATION_SOURCES,
    ...Object.keys(degradation.last24h),
    ...Object.keys(degradation.priorWeekDailyMean),
  ])
  const findings: HealthFinding[] = []
  const cleared: string[] = []
  for (const source of sources) {
    const count24h = degradation.last24h[source] ?? 0
    const priorDailyMean = degradation.priorWeekDailyMean[source] ?? 0
    const threshold = Math.max(SPIKE_MIN_EVENTS, SPIKE_FACTOR * priorDailyMean)
    if (count24h >= threshold) {
      findings.push(
        toFinding({
          kind: 'upstream-spike',
          subject: source,
          data: { count24h, priorDailyMean, threshold },
        }),
      )
    } else {
      cleared.push(source)
    }
  }
  return report('upstream-spike', 'upstream-spike', findings, cleared)
}

// ── D3: flag/key drift ──────────────────────────────────────────────────────
function checkFlagDrift(flags: HealthCheckInputs['flags']): DetectorReport {
  if (flags === null) return unknownReport('flag-drift', 'flag-drift')
  const findings: HealthFinding[] = []
  const cleared: string[] = []
  for (const seam of flags) {
    if (seam.flagOn && seam.missingKeys.length > 0) {
      findings.push(
        toFinding({
          kind: 'flag-drift',
          subject: seam.flag,
          data: { missingKeys: [...seam.missingKeys] },
        }),
      )
    } else {
      cleared.push(seam.flag)
    }
  }
  return report('flag-drift', 'flag-drift', findings, cleared)
}

// ── D4: committed-dataset staleness ─────────────────────────────────────────
function checkDatasetStaleness(
  datasets: HealthCheckInputs['datasets'],
  now: Date,
): DetectorReport {
  if (datasets === null) return unknownReport('dataset-stale', 'dataset-stale')
  const findings: HealthFinding[] = []
  const cleared: string[] = []
  for (const ds of datasets) {
    if (ds.generatedAt === null) continue // no stamp yet: unknown for this dataset
    const t = Date.parse(ds.generatedAt)
    if (!Number.isFinite(t)) continue
    const ageMs = now.getTime() - t
    if (ageMs > DATASET_STALE_DAYS * DAY_MS) {
      findings.push(
        toFinding({
          kind: 'dataset-stale',
          subject: ds.name,
          data: {
            file: ds.file,
            generatedAt: ds.generatedAt,
            ageDays: Math.floor(ageMs / DAY_MS),
            staleAfterDays: DATASET_STALE_DAYS,
          },
        }),
      )
    } else {
      cleared.push(ds.name)
    }
  }
  return report('dataset-stale', 'dataset-stale', findings, cleared)
}

// ── D5: valuation drift ─────────────────────────────────────────────────────
// Pure arithmetic over two numbers the engine already computes: the curated
// baseline (lib/valuations.ts) and the observed trimmed-mean override (ADR
// 0005). The trust gate is reused verbatim: below MIN_SAMPLES_TO_TRUST a
// program is neither drifting nor verified healthy — no finding, no clear.
function checkValuationDrift(valuations: HealthCheckInputs['valuations']): DetectorReport {
  if (valuations === null) return unknownReport('valuation-drift', 'valuation-drift')
  const findings: HealthFinding[] = []
  const cleared: string[] = []
  for (const o of valuations.overrides) {
    if (!Number.isFinite(o.cpp) || !Number.isInteger(o.sampleSize)) continue
    if (o.sampleSize < MIN_SAMPLES_TO_TRUST) continue
    const baseline = valuations.baseline[o.programId]
    if (!Number.isFinite(baseline) || baseline === undefined || baseline <= 0) continue
    const driftShare = Math.abs(o.cpp - baseline) / baseline
    if (driftShare > VALUATION_DRIFT_THRESHOLD) {
      findings.push(
        toFinding({
          kind: 'valuation-drift',
          subject: o.programId,
          data: {
            observedCpp: o.cpp,
            baselineCpp: baseline,
            sampleSize: o.sampleSize,
            sampleGate: MIN_SAMPLES_TO_TRUST,
            driftShare,
            thresholdShare: VALUATION_DRIFT_THRESHOLD,
          },
        }),
      )
    } else {
      cleared.push(o.programId)
    }
  }
  return report('valuation-drift', 'valuation-drift', findings, cleared)
}

// Run every detector over pre-gathered inputs. Pure and total: never throws,
// one report per detector, degraded inputs surface as status 'unknown'.
export function runHealthChecks(inputs: HealthCheckInputs, now: Date): DetectorReport[] {
  return [
    checkCronLiveness(inputs.heartbeats, now),
    checkUpstreamSpike(inputs.degradation),
    checkFlagDrift(inputs.flags),
    checkDatasetStaleness(inputs.datasets, now),
    checkValuationDrift(inputs.valuations),
  ]
}
