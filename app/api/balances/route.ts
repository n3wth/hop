// GET /api/balances — returns the SIGNED-IN user's cached AwardWallet
// balances. Session-gated and scoped to session.user.sub so it can never leak
// another user's (or the global env) balances. Unused by the UI today; kept
// for debugging. Reads the cache (lib/accounts.ts#getCachedAwBalances) rather
// than calling AwardWallet live — same no-live-call-on-a-request-path
// invariant as getUserBalances(). Use the "Refresh" button on /account (or
// the cron once it's flipped on) to force a live pull.

import { auth0 } from '@/lib/auth0'
import { getUserAwId, getCachedAwBalances } from '@/lib/accounts'

export async function GET() {
  const session = await auth0.getSession()
  const userId = session?.user?.sub
  if (!userId) {
    return Response.json({ ok: false, reason: 'Not signed in' }, { status: 401 })
  }

  const awId = await getUserAwId(userId)
  if (!awId) {
    return Response.json({ ok: false, reason: 'No AwardWallet account linked' })
  }

  const cached = await getCachedAwBalances(userId)
  if (!cached.ok && cached.balances.length === 0) {
    return Response.json({ ok: false, reason: 'Not synced yet — no cached balances' })
  }
  return Response.json({ ok: true, data: cached.balances, syncedAt: cached.syncedAt })
}
