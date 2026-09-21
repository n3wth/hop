// Cron liveness heartbeats (ADR 0007) — one row per vercel.json cron job
// (hop_cron_heartbeats), upserted fire-and-forget at the end of each
// AUTHORIZED run so the health sentinel's D1 detector (lib/health-checks.ts)
// can tell a dead cron from a quiet one. An `ok` heartbeat means "ran to
// completion"; `ok:false, note:'disabled'` means the owner has the job
// switched off — a choice, not an outage (D1 only looks at AGE, so a fresh
// disabled heartbeat never reads as dead).
//
// WRITES ARE DELIBERATELY UNGATED — a recorded ADR 0007 exception, not an
// oversight: gating them behind HOP_ENABLE_SELF_IMPROVE would blind D1 during
// flag churn, and liveness history must already exist the day the flag flips.
// They are inert one-row upserts that no-op via withDb when the DB or table
// is absent. READS are gated: flag off → null (unknown), which neither files
// nor resolves.
//
// recordHeartbeat() returns a Promise<void> that ALWAYS resolves and NEVER
// rejects — the same belt-and-suspenders contract as
// lib/outclicks.ts#recordOutclick. Callers await it (or hand it to
// next/server's after()) so the serverless instance stays alive until the
// one-row upsert flushes, instead of suspending the moment the response is
// sent and dropping an un-awaited write. A heartbeat bug must never fail a
// cron's real work.

import { isSelfImproveEnabled } from '@/lib/env'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { withDb } from '@/lib/supabase-helpers'
import type { CronJob } from '@/lib/health-checks'

const TABLE = 'hop_cron_heartbeats'
// Notes are engine-produced tallies ("evaluated:12 below-cpp:4"), never user
// text — the cap is just belt-and-suspenders against a runaway string.
const MAX_NOTE_LENGTH = 500

export interface CronHeartbeat {
  job: string
  lastRunAt: string
  ok: boolean
  note: string | null
}

// Record that a cron job ran (ok=true: to completion; ok=false: e.g.
// 'disabled'). Returns a promise that resolves once the one-row upsert
// settles; await it so the write is not dropped when a serverless instance
// suspends after the response.
export function recordHeartbeat(job: CronJob, ok: boolean, note?: string): Promise<void> {
  try {
    return withDb(false, async (db) => {
      const { error } = await db.from(TABLE).upsert(
        {
          job,
          last_run_at: new Date().toISOString(),
          ok,
          note: note ? note.slice(0, MAX_NOTE_LENGTH) : null,
        },
        { onConflict: 'job' },
      )
      return !error
    }).then(() => undefined)
  } catch {
    // Unreachable in practice (withDb never throws) — guarded anyway so the
    // returned promise always resolves.
    return Promise.resolve()
  }
}

// Every stored heartbeat — the sentinel's D1 input. GATED (reads are the
// flag's side of this seam): flag off → null. null (never []) on any failure,
// because "no data" must read as UNKNOWN — not as "every cron is dead" and
// not as "healthy".
export async function listHeartbeats(): Promise<CronHeartbeat[] | null> {
  if (!isSelfImproveEnabled()) return null
  return withDb<CronHeartbeat[] | null>(null, async (db) => {
    const { data, error } = await db.from(TABLE).select('job, last_run_at, ok, note')
    if (error || !data) return null
    return data
      .filter((r: any) => typeof r.job === 'string' && typeof r.last_run_at === 'string')
      .map((r: any) => ({
        job: r.job,
        lastRunAt: r.last_run_at,
        ok: Boolean(r.ok),
        note: r.note ?? null,
      }))
  })
}
