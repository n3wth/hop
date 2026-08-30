'use server'

import { getOwnerSession } from '@/lib/owner'
import { analyzeAdminData } from '@/lib/admin-analysis'
import { listHeartbeats } from '@/lib/cron-heartbeat'
import { getDegradationWindowCounts } from '@/lib/degradation-telemetry'
import { listOpenFindings } from '@/lib/improvement-findings'
import { CRON_JOBS } from '@/lib/health-checks'

// Owner-only, on-demand LLM narration for two /admin sections: system health
// and open findings. Deliberately re-derives the SAME lib/* reads the /admin
// page itself uses rather than accepting any client-supplied payload — the
// model only ever sees data the engine already computed (ADR 0007's residual
// principle), never arbitrary caller JSON. Output is prose the owner reads;
// this performs no writes and computes no thresholds.

export type AnalysisResult = { ok: true; text: string } | { ok: false; error: string }

const NOT_AUTHORIZED: AnalysisResult = { ok: false, error: 'Not authorized' }

export async function analyzeAdminHealth(): Promise<AnalysisResult> {
  if (!(await getOwnerSession())) return NOT_AUTHORIZED

  const [heartbeats, degradation] = await Promise.all([listHeartbeats(), getDegradationWindowCounts()])
  if (heartbeats === null && degradation === null) {
    return { ok: false, error: 'No health data available to analyze' }
  }

  const text = await analyzeAdminData('System health', {
    cronJobs: CRON_JOBS.map((j) => ({ job: j.job, expectedIntervalHours: j.expectedIntervalMs / 3_600_000 })),
    heartbeats,
    degradation,
  })
  return text ? { ok: true, text } : { ok: false, error: "Couldn't analyze — try again" }
}

export async function analyzeAdminFindings(): Promise<AnalysisResult> {
  if (!(await getOwnerSession())) return NOT_AUTHORIZED

  const findings = await listOpenFindings()
  if (!findings || findings.length === 0) {
    return {
      ok: false,
      error: findings === null ? 'Findings are unavailable' : 'No open findings to analyze',
    }
  }

  const text = await analyzeAdminData(
    'Open findings',
    findings.map((f) => ({
      severity: f.severity,
      title: f.title,
      body: f.body,
      firstSeenAt: f.firstSeenAt,
      lastSeenAt: f.lastSeenAt,
    })),
  )
  return text ? { ok: true, text } : { ok: false, error: "Couldn't analyze — try again" }
}
