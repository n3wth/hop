'use server'

import { revalidatePath } from 'next/cache'
import { auth0 } from '@/lib/auth0'
import { isBalanceSyncEnabled } from '@/lib/env'
import { formatSyncAddress, regenerateSyncAlias } from '@/lib/balance-sync'

// Server Action to ROTATE the user's personal sync (forwarding) address — the
// revoke path for a leaked address. Gated by the session AND the balance-sync
// flag; scoped to session.user.sub. Returns the new address on success. Never
// throws.

type Result = { ok: boolean; address?: string; error?: string }

export async function resetSyncAddress(): Promise<Result> {
  if (!isBalanceSyncEnabled()) return { ok: false, error: 'unavailable' }
  const session = await auth0.getSession()
  const userId = session?.user?.sub
  if (!userId) return { ok: false, error: 'Not signed in' }

  const alias = await regenerateSyncAlias(userId)
  if (!alias) return { ok: false, error: "Couldn't reset — try again" }

  revalidatePath('/account')
  return { ok: true, address: formatSyncAddress(alias) }
}
