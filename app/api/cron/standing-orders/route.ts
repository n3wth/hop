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
// EMAIL DELIVERY: after recording an alert, we send it by email (Resend) to the
// watch's notify address and flip `delivered` on success. This is GATED on
// RESEND_API_KEY — when email is unconfigured the whole delivery step is skipped
// and the alert stays in-app (durable record), exactly as before. A send failure
// (or a missing notify address) leaves `delivered=false` so the next run retries.
//
// NEVER throws to the platform: every order is evaluated in isolation; one
// failure can't sink the batch. Always responds 200 (when enabled) with a summary.

import { assembleSearch } from '@/lib/search'
import { getUserBalances } from '@/lib/accounts'
import { getPrefs } from '@/lib/prefs'
import {
  listActiveStandingOrders,
  recordNotifiedOffer,
  markAlertDelivered,
} from '@/lib/standing-orders'
import { recordAlert, type StandingOrderAlert } from '@/lib/standing-order-alerts'
import { evaluateOrder } from '@/lib/standing-orders-model'
import { isEmailEnabled, sendAlertEmail } from '@/lib/email'
import { recordHeartbeat } from '@/lib/cron-heartbeat'
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
    // Liveness record (ADR 0007): being off is an owner choice, not an outage.
    // Only for authorized callers, so a public probe can't keep it fresh.
    if (isAuthorized(request)) recordHeartbeat('standing-orders', false, 'disabled')
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

  // Resolve the email gate ONCE — when unconfigured we skip every send (no
  // network, no per-order cost) and alerts stay in-app.
  const emailEnabled = isEmailEnabled()

  let evaluated = 0
  let crossings = 0
  let alertsRecorded = 0
  let delivered = 0
  const errors: string[] = []
  // Tally of evaluateOrder's why-not codes — counted here where evalResult is
  // already in hand, so the heartbeat note carries the "why" with zero extra
  // queries (ADR 0007).
  const reasonTally: Record<string, number> = {}

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
      if (evalResult.reason) {
        reasonTally[evalResult.reason] = (reasonTally[evalResult.reason] ?? 0) + 1
      }
      if (!evalResult.crossed || !evalResult.pick) continue

      crossings++

      // Record the durable alert FIRST (the user-facing record), then stamp the
      // dedupe fingerprint so a transient alert-write failure doesn't suppress a
      // retry next tick.
      const alertCpp = evalResult.cpp ?? evalResult.pick.cpp ?? order.minCpp
      const alertId = await recordAlert({
        userId: uid,
        standingOrderId: order.id,
        params: order.params,
        pick: evalResult.pick,
        cpp: alertCpp,
        fingerprint: evalResult.fingerprint,
      })
      if (alertId) alertsRecorded++

      if (evalResult.fingerprint) {
        await recordNotifiedOffer(uid, order.id, evalResult.fingerprint)
      }

      // EMAIL DELIVERY (best-effort). Only when: email is configured, the alert
      // persisted (we have its id to mark delivered), and the watch has a notify
      // address. A successful send flips `delivered=true`; any failure leaves it
      // false so the next run retries. Never throws into the batch.
      if (emailEnabled && alertId && order.notifyEmail) {
        const alert: StandingOrderAlert = {
          id: alertId,
          standingOrderId: order.id,
          route: evalResult.pick.route || `${order.params.from} → ${order.params.to}`,
          pick: evalResult.pick,
          cpp: alertCpp,
          fingerprint: evalResult.fingerprint,
          delivered: false,
          seen: false,
        }
        const sent = await sendAlertEmail(order.notifyEmail, alert)
        if (sent.ok) {
          const marked = await markAlertDelivered(uid, alertId)
          if (marked) delivered++
        }
      }
    } catch (e) {
      errors.push(`${order.id}: ${e instanceof Error ? e.message : 'error'}`)
    }
  }

  // Liveness record (ADR 0007): after the work, so a fresh ok heartbeat means
  // "ran to completion". The note tallies the run's reason codes, sorted for
  // a stable read. Fire-and-forget — can never fail the response.
  const reasonNote = Object.entries(reasonTally)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([reason, n]) => `${reason}:${n}`)
    .join(' ')
  recordHeartbeat(
    'standing-orders',
    true,
    [`evaluated:${evaluated}`, `crossings:${crossings}`, reasonNote, errors.length > 0 ? `errors:${errors.length}` : '']
      .filter(Boolean)
      .join(' '),
  )

  return Response.json({
    ok: true,
    evaluated,
    crossings,
    alertsRecorded,
    delivered,
    emailEnabled,
    durationMs: Date.now() - startedAt,
    errors: errors.length > 0 ? errors : undefined,
  })
}
