// GET /api/balances — returns the SIGNED-IN user's linked AwardWallet balances.
// Session-gated and scoped to session.user.sub so it can never leak another
// user's (or the global env) balances. Unused by the UI today; kept for debugging.

import { auth0 } from '@/lib/auth0'
import { getUserAwId } from '@/lib/accounts'
import { getBalances } from '@/lib/awardwallet'

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

  const result = await getBalances(awId)
  return Response.json(result)
}
