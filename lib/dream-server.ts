// Server-side resolution for THE LEDGER DREAM: the user's real merged balances
// and their home-airport origin, both keyed off the Auth0 session. Shared by the
// signed-in home module and the /api/dream* routes so they all dream from the same
// portfolio. Degrades gracefully — never throws.

import 'server-only'
import { auth0 } from '@/lib/auth0'
import { getUserBalances } from '@/lib/accounts'
import { getPrefs, type UserPrefs } from '@/lib/prefs'
import { mockBalances } from '@/lib/mock'
import type { Balance } from '@/lib/types'

export interface DreamSession {
  userId?: string
  balances: Balance[]
  origin: string // home airport (IATA) or SFO default
}

// Resolve the current user's dream context. MOCK fixtures fill in ONLY for a
// signed-in dev user with nothing connected (mirrors app/page.tsx), so local dev
// always sees a populated dream; a real user with no programs gets the genuine
// save-toward fallback. Signed-out → empty balances, default origin.
export async function resolveDreamSession(): Promise<DreamSession> {
  let userId: string | undefined
  try {
    const session = await auth0.getSession()
    userId = session?.user?.sub
  } catch {
    userId = undefined
  }

  if (!userId) return { userId: undefined, balances: [], origin: 'SFO' }

  const [real, prefs] = await Promise.all([
    getUserBalances(userId).catch(() => [] as Balance[]),
    getPrefs(userId).catch((): UserPrefs => ({})),
  ])

  let balances = real
  if (balances.length === 0 && /^(1|true|yes)$/i.test(process.env.MOCK ?? '')) {
    balances = mockBalances()
  }

  return {
    userId,
    balances,
    origin: prefs.homeAirport || 'SFO',
  }
}
