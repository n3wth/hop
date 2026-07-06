// Credential-based balance auto-sync — the scheduled leg of the "hop signs in
// and reads your balance" rail (docs/plans/2026-07-05-credential-sync.md).
//
// For each due credential the cron: decrypts the login (lib/credential-vault),
// asks the Cloudflare Browser Rendering worker to sign in and return the
// dashboard TEXT, then runs that text through the SAME extraction + clamp
// pipeline as the paste/email rails (lib/balance-sync#extractBalances) filtered
// to the credential's own program — the worker never computes a balance, and a
// number still has to appear in (and near a mention of) the program's page
// text before it can land in hop_manual_balances.
//
// Honest state machine per row (surfaced on /account):
//   pending → ok            balance read + applied
//   pending → failed        login/extraction failed (lastError says why)
//   pending → unsupported   no recipe for the program yet
// NEVER throws; each credential is independent.

import { env, isCredentialAutosyncLive } from '@/lib/env'
import { canonicalizeProgram } from '@/lib/programs'
import {
  decryptCredential,
  listDueCredentials,
  recordSyncOutcome,
} from '@/lib/credential-vault'
import { applyExtractedBalances, extractBalances } from '@/lib/balance-sync'

// Sync at most daily-ish per credential; the cron runs daily, the 20h window
// tolerates schedule jitter without double-syncing.
const STALE_HOURS = 20
// Browser Rendering runs a real headless login — give it room, then cut it off.
export const FETCH_TIMEOUT_MS = 60_000
// Per-run cap: rows sync sequentially, so worst case is
// MAX_PER_RUN * FETCH_TIMEOUT_MS. Kept well under the cron route's
// maxDuration=300s (app/api/cron/balance-autosync/route.ts) so the platform
// never kills the run mid-batch — 4 * 60s = 240s leaves ~60s of headroom for
// extraction + DB writes on top of the raw fetches.
export const MAX_PER_RUN = 4

interface WorkerFetchResponse {
  ok: boolean
  text?: string
  reason?: string
}

export interface AutosyncSummary {
  attempted: number
  synced: number
  failed: number
  unsupported: number
}

async function fetchDashboardText(
  program: string,
  username: string,
  password: string,
): Promise<WorkerFetchResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`${env.balanceFetchWorkerUrl()}/fetch`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.balanceFetchSecret()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ program, username, password }),
      signal: controller.signal,
    })
    if (!res.ok) return { ok: false, reason: `worker responded ${res.status}` }
    const json = (await res.json()) as WorkerFetchResponse
    return json && typeof json === 'object' ? json : { ok: false, reason: 'bad worker reply' }
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError'
    return { ok: false, reason: timedOut ? 'fetch timed out' : 'worker unreachable' }
  } finally {
    clearTimeout(timer)
  }
}

// One credential, end to end. Exported for tests via dependency on pure parts;
// the cron calls runCredentialAutosync below.
async function syncOne(row: {
  id: string
  userId: string
  program: string
  secretEnc: string
}): Promise<'ok' | 'failed' | 'unsupported'> {
  const creds = decryptCredential(row.secretEnc)
  if (!creds) {
    await recordSyncOutcome(row.id, 'failed', 'could not decrypt — re-save the login')
    return 'failed'
  }

  const res = await fetchDashboardText(row.program, creds.username, creds.password)
  if (!res.ok || typeof res.text !== 'string' || res.text.trim() === '') {
    const unsupported = res.reason === 'unsupported'
    await recordSyncOutcome(
      row.id,
      unsupported ? 'unsupported' : 'failed',
      res.reason ?? 'no page text',
    )
    return unsupported ? 'unsupported' : 'failed'
  }

  // Same clamp as every other rail, then keep ONLY this credential's program —
  // a logged-in dashboard can mention partner programs.
  const { balances } = await extractBalances(res.text)
  const target = canonicalizeProgram(row.program)
  const match = balances.find((b) => {
    const def = canonicalizeProgram(b.program)
    if (target && def) return def.id === target.id
    return b.program.trim().toLowerCase() === row.program.trim().toLowerCase()
  })
  if (!match) {
    await recordSyncOutcome(row.id, 'failed', 'signed in, but no balance found on the page')
    return 'failed'
  }

  // applyExtractedBalances never throws — it reports write failures in its
  // counters. Only claim 'ok' when the balance actually persisted (added,
  // updated, or already-current); a transient DB failure stays 'failed' so the
  // row doesn't falsely read "Synced" and the cron doesn't over-count.
  const applied = await applyExtractedBalances(row.userId, [match])
  if (applied.failed > 0 || applied.added + applied.updated + applied.unchanged === 0) {
    await recordSyncOutcome(row.id, 'failed', "couldn't save the balance — will retry")
    return 'failed'
  }
  await recordSyncOutcome(row.id, 'ok')
  return 'ok'
}

// The cron entrypoint. No-op summary when the seam isn't fully live.
export async function runCredentialAutosync(): Promise<AutosyncSummary> {
  const summary: AutosyncSummary = { attempted: 0, synced: 0, failed: 0, unsupported: 0 }
  if (!isCredentialAutosyncLive()) return summary

  const staleBefore = new Date(Date.now() - STALE_HOURS * 3_600_000).toISOString()
  const due = await listDueCredentials(staleBefore, MAX_PER_RUN)
  for (const row of due) {
    summary.attempted++
    const outcome = await syncOne(row)
    if (outcome === 'ok') summary.synced++
    else if (outcome === 'unsupported') summary.unsupported++
    else summary.failed++
  }
  return summary
}
