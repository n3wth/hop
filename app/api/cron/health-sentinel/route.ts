// GET /api/cron/health-sentinel — the daily health sentinel (ADR 0007).
//
// Gathers first-party signals (heartbeat ages, counted degradation rows, flag
// vs key presence, dataset date stamps, observed-vs-baseline cpp), runs the
// PURE detectors in lib/health-checks.ts, upserts idempotent fingerprinted
// findings, resolves the ones a detector VERIFIED healthy, files at most
// MAX_ISSUES_PER_RUN issues (Linear when configured; owner email for P1s
// otherwise), prunes old degradation events, and records its own heartbeat.
//
// AUTH: CRON_SECRET bearer (same contract as the other cron routes). GATED on
// isSelfImproveEnabled(): off → 503 disabled, no reads, no detection — the
// only write on that path is the deliberately ungated heartbeat (the recorded
// ADR 0007 exception).
//
// UNKNOWN ≠ HEALTHY: every input is its own degradable read; a null input
// makes its detector report 'unknown', which neither files nor resolves — no
// data is never treated as fixed.
//
// NEVER 500s: the outer catch returns {ok:false, reason} with a 200 (the
// business-digest route pattern) so Vercel cron never sees a platform failure
// from us. No LLM anywhere; every number is a counted row, a timestamp
// difference, or a named exported constant.

import { isSelfImproveEnabled } from '@/lib/env'
import { withDb } from '@/lib/supabase-helpers'
import { listValuations } from '@/lib/valuations'
import { listHeartbeats, recordHeartbeat } from '@/lib/cron-heartbeat'
import { getDegradationWindowCounts, pruneDegradationEvents } from '@/lib/degradation-telemetry'
import {
  gatherFlagSeamInputs,
  runHealthChecks,
  WATCH_DEAD_DAYS,
  type HealthCheckInputs,
} from '@/lib/health-checks'
import {
  fileFindings,
  listOpenFindings,
  resolveFinding,
  upsertFinding,
} from '@/lib/improvement-findings'
import * as placeFacts from '@/lib/place-facts'
import * as climateNormals from '@/lib/climate-normals'
import { isAuthorizedCron } from '@/lib/cron-auth'

// Reads live per-request data; never cache or statically render.
export const dynamic = 'force-dynamic'
// This route does the most DB work of any cron (heartbeat + degradation +
// overrides + dead-watch reads, then finding upserts/resolves/filing). Give it
// the same ceiling as the other heavy crons so it can't be cut off mid-run
// before it records its own liveness (N-790).
export const maxDuration = 300

// D4 inputs. The regenerator scripts start emitting an explicit GENERATED_AT
// stamp in the data-refresh PR; until a dataset carries one we degrade
// honestly: place-facts falls back to its FX snapshot date (a real
// generation-time stamp already committed in the data), climate-normals
// reports null — UNKNOWN, which neither files nor resolves.
function stampOf(mod: object): string | null {
  const v = (mod as Record<string, unknown>).GENERATED_AT
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

function gatherDatasetStamps(): NonNullable<HealthCheckInputs['datasets']> {
  return [
    {
      name: 'place-facts',
      file: 'lib/place-facts.ts',
      generatedAt: stampOf(placeFacts) ?? placeFacts.FX.date ?? null,
    },
    {
      name: 'climate-normals',
      file: 'lib/climate-normals.ts',
      generatedAt: stampOf(climateNormals),
    },
  ]
}

// D5's overrides input. Mirrors lib/valuation-overrides.ts#getValuationOverrides
// but degrades to null (UNKNOWN) instead of [] — for the drift detector, "the
// table was unreachable" must never read as "no drift" (a dead DB would
// otherwise falsely resolve open drift findings).
async function readOverridesForDrift(): Promise<
  Array<{ programId: string; cpp: number; sampleSize: number }> | null
> {
  return withDb<Array<{ programId: string; cpp: number; sampleSize: number }> | null>(
    null,
    async (db) => {
      const { data, error } = await db
        .from('hop_valuation_overrides')
        .select('program_id, cpp, sample_size')
      if (error || !data) return null
      const out: Array<{ programId: string; cpp: number; sampleSize: number }> = []
      for (const row of data) {
        const cpp = Number(row.cpp)
        const sampleSize = Number(row.sample_size)
        if (typeof row.program_id !== 'string' || row.program_id === '') continue
        if (!Number.isFinite(cpp) || !Number.isFinite(sampleSize)) continue
        out.push({ programId: row.program_id, cpp, sampleSize })
      }
      return out
    },
  )
}

async function queryDeadWatches(now: Date): Promise<number | null> {
  return withDb<number | null>(null, async (db) => {
    const staleDate = new Date(now.getTime() - WATCH_DEAD_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { data: watches, error: watchesErr } = await db
      .from('hop_standing_orders')
      .select('id')
      .eq('active', true)
      .lt('created_at', staleDate)
    if (watchesErr || !watches) return null
    if (watches.length === 0) return 0

    const watchIds = watches.map((w: { id: string }) => w.id)
    const { data: alerts, error: alertsErr } = await db
      .from('hop_standing_order_alerts')
      .select('standing_order_id')
      .in('standing_order_id', watchIds)
    if (alertsErr || !alerts) return null

    const alertedWatchIds = new Set(
      alerts.map((a: { standing_order_id: string }) => a.standing_order_id)
    )
    let count = 0
    for (const w of watches) {
      if (!alertedWatchIds.has(w.id)) {
        count++
      }
    }
    return count
  })
}

export async function GET(request: Request) {
  try {
    if (!isAuthorizedCron(request)) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
    if (!isSelfImproveEnabled()) {
      // Being off is an owner choice, not an outage — the heartbeat says so
      // (the one deliberately ungated write; see ADR 0007's exception list).
      await recordHeartbeat('health-sentinel', false, 'disabled')
      return Response.json({ ok: false, error: 'disabled' }, { status: 503 })
    }

    const now = new Date()

    // Gather inputs — each its own degradable read; null = unknown.
    const [heartbeats, degradation, overrides, deadWatches] = await Promise.all([
      listHeartbeats(),
      getDegradationWindowCounts(now),
      readOverridesForDrift(),
      queryDeadWatches(now),
    ])
    const inputs: HealthCheckInputs = {
      heartbeats,
      degradation,
      flags: gatherFlagSeamInputs(),
      datasets: gatherDatasetStamps(),
      valuations: overrides === null ? null : { baseline: listValuations(), overrides },
      deadWatches,
    }

    const reports = runHealthChecks(inputs, now)

    // Upsert every detection (idempotent by fingerprint; reopen-within-window
    // and post-window episode reset live in the store).
    let upserted = 0
    let upsertFailed = 0
    for (const report of reports) {
      for (const finding of report.findings) {
        const res = await upsertFinding({
          fingerprint: finding.fingerprint,
          kind: finding.kind,
          severity: finding.severity,
          title: finding.title,
          body: finding.body,
        })
        if (res) upserted++
        else upsertFailed++
      }
    }

    // Resolve only what a detector VERIFIED healthy this run ('unknown'
    // reports contribute no cleared subjects, so a degraded input can never
    // resolve anything).
    const open = await listOpenFindings()
    let resolved = 0
    const resolvedFingerprints = new Set<string>()
    if (open !== null) {
      const clearedFingerprints = new Set<string>()
      for (const report of reports) {
        if (report.status === 'unknown') continue
        for (const subject of report.clearedSubjects) {
          clearedFingerprints.add(`${report.kind}:${subject}`)
        }
      }
      for (const finding of open) {
        if (!clearedFingerprints.has(finding.fingerprint)) continue
        if (await resolveFinding(finding.fingerprint)) {
          resolved++
          resolvedFingerprints.add(finding.fingerprint)
        }
      }
    }

    // File up to MAX_ISSUES_PER_RUN of the still-open, still-unfiled findings.
    // A degraded store (open === null) files nothing — the next daily run is
    // the retry.
    const candidates =
      open === null
        ? []
        : open.filter((f) => !f.filedAt && !resolvedFingerprints.has(f.fingerprint))
    const filed = await fileFindings(candidates)

    // Housekeeping + our own liveness, then the per-detector status body.
    const pruned = await pruneDegradationEvents(now)
    await recordHeartbeat(
      'health-sentinel',
      true,
      `findings:${upserted} resolved:${resolved} filed:${filed.length}`,
    )

    return Response.json({
      ok: true,
      detectors: reports.map((r) => ({
        detector: r.detector,
        status: r.status,
        findings: r.findings.length,
        cleared: r.clearedSubjects.length,
      })),
      openFindings: open === null ? 'unknown' : open.length,
      upserted,
      ...(upsertFailed > 0 ? { upsertFailed } : {}),
      resolved,
      filed,
      unfiled: Math.max(0, candidates.length - filed.length),
      pruned: pruned ? 'ok' : 'skipped',
    })
  } catch (e) {
    // Belt-and-braces: everything above promises never to throw, but the
    // platform must still never see a 500 from this route.
    return Response.json({
      ok: false,
      reason: e instanceof Error ? e.message : 'error',
    })
  }
}
