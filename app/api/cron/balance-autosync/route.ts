// GET /api/cron/balance-autosync — the daily credential-based balance sync
// (lib/balance-autosync.ts): for each due row in hop_program_credentials, sign
// in via the Browser Rendering worker, extract + clamp the balance server-side,
// and upsert it as an ordinary manual balance.
//
// GATING: runs ONLY when isCredentialAutosyncLive() (flag + vault key + worker
// URL + worker secret). Until then: 503 disabled, no work. Requires the Vercel
// cron auth (CRON_SECRET) like every other cron route. NEVER throws to the
// platform — per-credential failures land in each row's status/lastError.
//
// SCHEDULE: wired in vercel.json.

import { isCredentialAutosyncLive } from '@/lib/env'
import { runCredentialAutosync } from '@/lib/balance-autosync'
import { recordHeartbeat } from '@/lib/cron-heartbeat'
import { isAuthorizedCron } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'
// Headless logins are slow; allow the full batch to finish.
export const maxDuration = 300

export async function GET(request: Request) {
  if (!isCredentialAutosyncLive()) {
    // Liveness record (ADR 0007): off is an owner choice, not an outage.
    if (isAuthorizedCron(request)) await recordHeartbeat('balance-autosync', false, 'disabled')
    return Response.json({ ok: false, error: 'disabled' }, { status: 503 })
  }
  if (!isAuthorizedCron(request)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const summary = await runCredentialAutosync()
  await recordHeartbeat(
    'balance-autosync',
    true,
    `attempted:${summary.attempted} synced:${summary.synced} failed:${summary.failed}`,
  )
  return Response.json({ ok: true, ...summary })
}
