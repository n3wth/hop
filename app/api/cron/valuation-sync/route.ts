// GET /api/cron/valuation-sync — pulls the Cloudflare valuation Worker's
// aggregated per-program cpp snapshot (GET {WORKER_URL}/valuations) and syncs
// the trustworthy rows into Supabase (lib/valuation-overrides.ts), which
// lib/valuations-live.ts later merges over the static lib/valuations.ts
// baseline for the /ask concierge prompt.
//
// GATING: this runs ONLY when isValuationSyncEnabled() is true (the explicit
// flag AND HOP_VALUATION_WORKER_URL AND HOP_VALUATION_SYNC_SECRET are all
// configured). Until then the route returns 503 disabled and does NO work. It
// also requires the Vercel cron auth header (CRON_SECRET) when set, so it
// can't be triggered by the public — same pattern as standing-orders/route.ts.
//
// SCHEDULE: wired in vercel.json.
//
// NEVER throws to the platform: a worker outage or malformed response degrades
// to a 200 no-op summary rather than a 500, since this cron running early or
// misconfigured must not alarm anything.

import { env, isValuationSyncEnabled } from '@/lib/env'
import { programById } from '@/lib/programs'
import { clampCpp } from '@/lib/valuations'
import { upsertValuationOverrides, type ValuationOverride } from '@/lib/valuation-overrides'
import { recordHeartbeat } from '@/lib/cron-heartbeat'
import { isAuthorizedCron } from '@/lib/cron-auth'

// This route reads live remote data and must never be cached or statically rendered.
export const dynamic = 'force-dynamic'

const FETCH_TIMEOUT_MS = 10_000

function isEnabled(): boolean {
  return isValuationSyncEnabled()
}

interface WorkerValuationEntry {
  cpp: number
  sampleSize: number
  asOf: string
}

interface WorkerValuationsResponse {
  ok: boolean
  valuations?: Record<string, WorkerValuationEntry>
}

function isValidEntry(programId: string, entry: WorkerValuationEntry | undefined): entry is WorkerValuationEntry {
  if (!entry || typeof entry !== 'object') return false
  if (!programById(programId)) return false
  if (clampCpp(entry.cpp) === null) return false
  if (!Number.isInteger(entry.sampleSize) || entry.sampleSize <= 0) return false
  const ms = Date.parse(entry.asOf)
  if (Number.isNaN(ms)) return false
  if (ms > Date.now()) return false
  return true
}

export async function GET(request: Request) {
  if (!isEnabled()) {
    // Liveness record (ADR 0007): being off is an owner choice, not an outage.
    // Only for authorized callers, so a public probe can't keep it fresh.
    if (isAuthorizedCron(request)) await recordHeartbeat('valuation-sync', false, 'disabled')
    return Response.json({ ok: false, error: 'disabled' }, { status: 503 })
  }
  if (!isAuthorizedCron(request)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  let payload: WorkerValuationsResponse | undefined
  try {
    const res = await fetch(`${env.hopValuationWorkerUrl()}/valuations`, {
      headers: { Authorization: `Bearer ${env.hopValuationSyncSecret()}` },
      signal: controller.signal,
    })
    if (res.ok) {
      payload = (await res.json()) as WorkerValuationsResponse
    }
  } catch {
    // Network failure, timeout, bad JSON — treated as "worker unreachable" below.
  } finally {
    clearTimeout(timer)
  }

  if (!payload || !payload.ok || !payload.valuations) {
    // Still a completed run — the cron itself worked; the upstream didn't.
    await recordHeartbeat('valuation-sync', true, 'worker-unreachable')
    return Response.json({ ok: true, applied: 0, skipped: 0, reason: 'worker unreachable' })
  }

  const validRows: ValuationOverride[] = []
  let skipped = 0
  for (const [programId, entry] of Object.entries(payload.valuations)) {
    if (isValidEntry(programId, entry)) {
      validRows.push({ programId, cpp: entry.cpp, sampleSize: entry.sampleSize, asOf: entry.asOf })
    } else {
      skipped++
    }
  }

  const persisted = await upsertValuationOverrides(validRows)
  if (!persisted) {
    await recordHeartbeat('valuation-sync', true, 'persist-failed')
    return Response.json({ ok: true, applied: 0, skipped: validRows.length + skipped, reason: 'persist failed' })
  }

  // Liveness record (ADR 0007): after the work — ran to completion.
  await recordHeartbeat('valuation-sync', true, `applied:${validRows.length} skipped:${skipped}`)
  return Response.json({ ok: true, applied: validRows.length, skipped })
}
