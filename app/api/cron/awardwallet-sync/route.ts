// GET /api/cron/awardwallet-sync — periodically refreshes the AwardWallet
// balance cache (lib/accounts.ts#refreshAwCache) for every connected user, so
// getUserBalances() never has to make a live AwardWallet call on the hot path
// (home/deals/ask/search/account). Bootstrap-on-connect and the manual
// Refresh button already populate the cache; this cron just keeps it fresh
// for users who never revisit /account.
//
// GATING: this runs ONLY when isAwardWalletSyncCronLive() is true
// (AWARDWALLET_SYNC_CRON_ENABLED). Until then the route returns 503 disabled
// and does NO work — cached balances still populate via bootstrap + manual
// refresh, so the feature works before the flag ever flips. It also requires
// the Vercel cron auth header (CRON_SECRET) when set, same as
// standing-orders/valuation-sync.
//
// SCHEDULE: wired in vercel.json, offset from standing-orders' `0 */6 * * *`
// so the two crons don't contend.
//
// NEVER throws to the platform: each user is refreshed in isolation — one
// AwardWallet failure or db error can't sink the batch. Always responds 200
// (when enabled) with a summary.

import { isAwardWalletSyncCronLive } from '@/lib/env'
import { listConnectedAwUsers, refreshAwCache } from '@/lib/accounts'
import { recordHeartbeat } from '@/lib/cron-heartbeat'
import { isAuthorizedCron } from '@/lib/cron-auth'

// This route makes per-user live upstream calls and must never be cached or
// statically rendered.
export const dynamic = 'force-dynamic'

function isEnabled(): boolean {
  return isAwardWalletSyncCronLive()
}

export async function GET(request: Request) {
  if (!isEnabled()) {
    // Liveness record (ADR 0007): being off is an owner choice, not an outage.
    // Only for authorized callers, so a public probe can't keep it fresh.
    if (isAuthorizedCron(request)) await recordHeartbeat('awardwallet-sync', false, 'disabled')
    return Response.json(
      { ok: false, disabled: true, reason: 'AWARDWALLET_SYNC_CRON_ENABLED is off' },
      { status: 503 },
    )
  }
  if (!isAuthorizedCron(request)) {
    return Response.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const users = await listConnectedAwUsers()

  let refreshed = 0
  let failed = 0
  const errors: string[] = []

  for (const { userId, awUserId } of users) {
    try {
      const ok = await refreshAwCache(userId, awUserId)
      if (ok) refreshed++
      else failed++
    } catch (e) {
      failed++
      errors.push(`${userId}: ${e instanceof Error ? e.message : 'error'}`)
    }
  }

  await recordHeartbeat(
    'awardwallet-sync',
    true,
    [`refreshed:${refreshed}`, `failed:${failed}`, errors.length > 0 ? `errors:${errors.length}` : '']
      .filter(Boolean)
      .join(' '),
  )

  return Response.json({
    ok: true,
    total: users.length,
    refreshed,
    failed,
    durationMs: Date.now() - startedAt,
    errors: errors.length > 0 ? errors : undefined,
  })
}
