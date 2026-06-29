// GET /api/cron/standing-orders — the scheduled "verdict that watches" runner.
//
// For each ACTIVE standing order: load the user's LIVE balances (getUserBalances)
// and run the UNCHANGED assembleSearch(order.params, balances) — the exact engine
// a manual search runs. Then evaluateOrder() (pure) decides whether hop's own
// verdict crossed the user's line on a NEW offer. On a crossing we persist an
// alert (hop_standing_order_alerts) and stamp last_notified_offer so the same
// seat never re-alerts. The /account "Your alerts" surface renders the records.
//
// GATING: this runs ONLY when STANDING_ORDERS_CRON_ENABLED is truthy. Until it's
// flipped on, the route returns 503 disabled and does NO work / NO charges. It
// also requires the Vercel cron auth header (CRON_SECRET) when set, so it can't
// be triggered by the public.
//
// SCHEDULE: wire in vercel.json (see report). This handler is the cron target.
//
// PUSH DELIVERY TODO: this is the DETECTION + RECORD half. Actual email/web-push
// delivery needs infra we don't have yet (a transactional email key or a
// web-push subscription store). When that lands, send here and flip the alert's
// `delivered` flag. Today the alert is durable + surfaced in-app instead.
//
// NEVER throws to the platform: every order is evaluated in isolation; one
// failure can't sink the batch. Always responds 200 (when enabled) with a summary.

import { assembleSearch } from '@/lib/search'
import { getUserBalances } from '@/lib/accounts'
import { getPrefs } from '@/lib/prefs'
import {
  listActiveStandingOrders,
  recordNotifiedOffer,
} from '@/lib/standing-orders'
import { recordAlert } from '@/lib/standing-order-alerts'
import { evaluateOrder } from '@/lib/standing-orders-model'
import type { TravelPrefs } from '@/lib/prefs-model'

// This route reads per-user data and must never be cached or statically rendered.
export const dynamic = 'force-dynamic'

function isEnabled(): boolean {
  return /^(1|true|yes)$/i.test(process.env.STANDING_ORDERS_CRON_ENABLED ?? '')
}

// Verify the request is from Vercel Cron (or an authorized caller). Vercel sends
// `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is set. When no secret
// is configured we allow it (so local/manual runs work) — but the ENABLE flag
// still gates real execution.
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

// Merge the watch's own cabin floor onto the user's stored prefs so the engine
// applies BOTH (the watch's minCabin overrides the global one for this run).
function prefsForOrder(
  base: TravelPrefs | undefined,
  minCabin: TravelPrefs['minCabin'],
): TravelPrefs | undefined {
  if (!minCabin) return base
  return { ...(base ?? {}), minCabin }
}

export async function GET(request: Request) {
  if (!isEnabled()) {
    return Response.json(
      { ok: false, disabled: true, reason: 'STANDING_ORDERS_CRON_ENABLED is off' },
      { status: 503 },
    )
  }
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const orders = await listActiveStandingOrders()

  // Cache per-user balances/prefs across that user's multiple watches in one run.
  const balancesCache = new Map<string, Awaited<ReturnType<typeof getUserBalances>>>()
  const prefsCache = new Map<string, TravelPrefs | undefined>()

  let evaluated = 0
  let crossings = 0
  let alertsRecorded = 0
  const errors: string[] = []

  for (const order of orders) {
    try {
      evaluated++
      const uid = order.userId

      if (!balancesCache.has(uid)) {
        balancesCache.set(uid, await getUserBalances(uid))
      }
      if (!prefsCache.has(uid)) {
        const p = await getPrefs(uid).catch(() => undefined)
        prefsCache.set(uid, p?.travelPrefs)
      }
      const balances = balancesCache.get(uid) ?? []
      const prefs = prefsForOrder(prefsCache.get(uid), order.minCabin)

      // THE UNCHANGED ENGINE. Same call /api/search makes.
      const result = await assembleSearch(order.params, balances, prefs)

      const evalResult = evaluateOrder(order, result)
      if (!evalResult.crossed || !evalResult.pick) continue

      crossings++

      // Record the durable alert FIRST (the user-facing record), then stamp the
      // dedupe fingerprint so a transient alert-write failure doesn't suppress a
      // retry next tick.
      const alertId = await recordAlert({
        userId: uid,
        standingOrderId: order.id,
        params: order.params,
        pick: evalResult.pick,
        cpp: evalResult.cpp ?? evalResult.pick.cpp ?? order.minCpp,
        fingerprint: evalResult.fingerprint,
      })
      if (alertId) alertsRecorded++

      if (evalResult.fingerprint) {
        await recordNotifiedOffer(uid, order.id, evalResult.fingerprint)
      }

      // PUSH DELIVERY TODO: send email/web-push here, then mark the alert
      // delivered. No-op today (no channel infra) — the in-app surface covers it.
    } catch (e) {
      errors.push(`${order.id}: ${e instanceof Error ? e.message : 'error'}`)
    }
  }

  return Response.json({
    ok: true,
    evaluated,
    crossings,
    alertsRecorded,
    durationMs: Date.now() - startedAt,
    errors: errors.length > 0 ? errors : undefined,
  })
}
