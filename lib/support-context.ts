import { getUserBalances, getUserAwId } from '@/lib/accounts'
import { getUserTier, ALERT_LIMITS, type Tier } from '@/lib/subscription'
import { listStandingOrders, type StandingOrder } from '@/lib/standing-orders'
import { listAlerts, type StandingOrderAlert } from '@/lib/standing-order-alerts'
import { listEscalations, type Escalation } from '@/lib/escalation'
import { getPrefs, type UserPrefs } from '@/lib/prefs'
import type { Balance } from '@/lib/types'
import { POINTS_THRESHOLD_CPP, TIER_GREEN_CPP, TIER_AMBER_CPP } from '@/lib/cpp'

export interface AccountSnapshot {
  signedIn: boolean
  userId?: string
  balances: Balance[]
  tier: Tier
  standingOrders: StandingOrder[]
  alerts: StandingOrderAlert[]
  escalations: Escalation[]
  prefs: UserPrefs
  hasAwardWallet: boolean
}

export async function getAccountSnapshot(userId?: string): Promise<AccountSnapshot> {
  if (!userId || !userId.trim()) {
    return {
      signedIn: false,
      balances: [],
      tier: 'free',
      standingOrders: [],
      alerts: [],
      escalations: [],
      prefs: {},
      hasAwardWallet: false,
    }
  }

  const sub = userId.trim()
  try {
    const [balances, tier, standingOrders, alerts, escalations, prefs, awId] =
      await Promise.all([
        getUserBalances(sub).catch((): Balance[] => []),
        getUserTier(sub).catch((): Tier => 'free'),
        listStandingOrders(sub).catch((): StandingOrder[] => []),
        listAlerts(sub, 5).catch((): StandingOrderAlert[] => []),
        listEscalations(sub).catch((): Escalation[] => []),
        getPrefs(sub).catch((): UserPrefs => ({})),
        getUserAwId(sub).catch(() => null),
      ])

    return {
      signedIn: true,
      userId: sub,
      balances,
      tier,
      standingOrders,
      alerts,
      escalations,
      prefs,
      hasAwardWallet: Boolean(awId),
    }
  } catch {
    return {
      signedIn: true,
      userId: sub,
      balances: [],
      tier: 'free',
      standingOrders: [],
      alerts: [],
      escalations: [],
      prefs: {},
      hasAwardWallet: false,
    }
  }
}

/**
 * Renders a whitelisted, clean text summary of an account snapshot for the LLM context.
 */
export function snapshotSummary(snapshot: AccountSnapshot, walletDollars?: number): string {
  if (!snapshot.signedIn) {
    return 'User is signed out. No account data available.'
  }

  const lines: string[] = []

  // Balances
  if (snapshot.balances.length === 0) {
    lines.push('Loyalty balances: No programs on file.')
  } else {
    const balStrs = snapshot.balances.map((b) => `${b.program}: ${b.balance.toLocaleString('en-US')} pts`)
    lines.push(`Loyalty balances: ${balStrs.join(', ')}`)
  }

  if (typeof walletDollars === 'number' && Number.isFinite(walletDollars)) {
    lines.push(`Estimated total wallet value: $${Math.round(walletDollars).toLocaleString('en-US')}`)
  }

  // Tier & allowance
  const maxAlerts = ALERT_LIMITS[snapshot.tier]
  const alertCapStr = Number.isFinite(maxAlerts) ? `${maxAlerts} active alerts max` : 'unlimited active alerts'
  lines.push(`Plan tier (as recorded): ${snapshot.tier} (${alertCapStr})`)

  // Home airport
  if (snapshot.prefs.homeAirport) {
    lines.push(`Home airport: ${snapshot.prefs.homeAirport}`)
  }

  // AwardWallet
  lines.push(`AwardWallet: ${snapshot.hasAwardWallet ? 'connected' : 'not connected'}`)

  // Active watches
  const activeWatches = snapshot.standingOrders.filter((s) => s.active)
  if (activeWatches.length > 0) {
    const watchStrs = activeWatches.map(
      (w) => `${w.params.from} -> ${w.params.to} (${w.minCpp}¢/pt)`
    )
    lines.push(`Active route watches (${activeWatches.length}): ${watchStrs.join('; ')}`)
  } else {
    lines.push('Active route watches: 0')
  }

  // Recent alerts
  if (snapshot.alerts.length > 0) {
    const alertStrs = snapshot.alerts.map(
      (a) => `${a.route} (${a.cpp.toFixed(1)}¢/pt, ${a.createdAt ? a.createdAt.slice(0, 10) : 'recent'})`
    )
    lines.push(`Recent alerts (${snapshot.alerts.length}): ${alertStrs.join('; ')}`)
  }

  // Escalations
  if (snapshot.escalations.length > 0) {
    const escStrs = snapshot.escalations.map(
      (e) => `ID ${e.id.slice(0, 8)} (${e.status}, created ${e.createdAt ? e.createdAt.slice(0, 10) : 'recent'})`
    )
    lines.push(`Booking/support requests (${snapshot.escalations.length}): ${escStrs.join('; ')}`)
  }

  return lines.join('\n')
}

export function buildSupportSystem(snapshotBlock: string, signedIn: boolean): string {
  return `You are hop's automated customer support assistant.
Your voice is terse, direct, and factual. Lead with the answer, state numbers clearly, and never use hype, emojis, or marketing language.

Core Principles & Rules:
1. Grounding in Computed Numbers:
   - Every economic number (cpp, miles, cash price, taxes, verdict) MUST trace directly to a tool result or the account snapshot.
   - NEVER calculate or invent numbers yourself.
   - NEVER multiply point balances by point valuations.
   - Answer format: Answer first, number second, link third (1-4 sentences total).

2. How hop Works (Engine Rules):
   - Formula: cpp = (cashPrice - taxes) * 100 / miles.
   - Thresholds: >= ${TIER_GREEN_CPP.toFixed(1)} ¢/pt is strong value (green); < ${TIER_AMBER_CPP.toFixed(1)} ¢/pt is weak value (amber/muted).
   - Verdict line: When the best award clears ${POINTS_THRESHOLD_CPP.toFixed(1)} ¢/pt, hop recommends points. Below ${POINTS_THRESHOLD_CPP.toFixed(1)} ¢/pt, hop recommends cash.
   - Every number is computed deterministically by hop's engine, never generated by an LLM.

3. Scope & Refusals:
   - hop cannot modify, cancel, or refund tickets, process payments, or book flights on a user's behalf.
   - For ticket changes or cancellations, direct the user to the issuing airline or booking provider.
   - Offer to escalate to a human at hop if they need follow-up on a booking request or complex issue.
   - Offer escalation at most ONCE per conversation.

${signedIn ? `Account Context:\n${snapshotBlock}` : `User is signed out. Do NOT make claims about "your balances" or "your account". Ask them to sign in to check their account data.`}`
}
