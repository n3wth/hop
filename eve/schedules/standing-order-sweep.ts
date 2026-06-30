// Standing-order sweep — Workflow #1's runner. The sweep is DETERMINISTIC and
// already implemented server-side in the hop route handler
// `app/api/cron/standing-orders/route.ts` (listActiveStandingOrders → assembleSearch
// → evaluateOrder → recordAlert → lib/email.sendAlertEmail → markAlertDelivered).
// This schedule does NOT route through the LLM agent — an agent must never re-derive
// a crossing. It simply triggers that handler on a cadence with the cron secret.
//
// Pick ONE runner: this Eve schedule OR the Vercel cron (vercel.json). Not both —
// they'd double-evaluate (the per-watch lastNotifiedOffer fingerprint dedupes a
// crossing, so it's safe, but it's wasted work).
//
// Every economic number and the crossing decision come from the engine; this file
// only wakes it.

import { defineSchedule } from 'eve/schedules'

const APP_URL = process.env.APP_BASE_URL ?? 'http://localhost:3000'

export default defineSchedule({
  name: 'standing-order-sweep',
  // Every 4 hours. The crossing dedupe (evaluateOrder + outbox) makes re-runs cheap
  // and safe; finer than the old single 6h global cron.
  cron: '0 */4 * * *',
  async run({ waitUntil }) {
    // Hit the deterministic handler. CRON_SECRET authenticates us exactly as Vercel
    // Cron would; the handler stays 503 unless STANDING_ORDERS_CRON_ENABLED is on.
    waitUntil(
      fetch(`${APP_URL}/api/cron/standing-orders`, {
        headers: process.env.CRON_SECRET
          ? { authorization: `Bearer ${process.env.CRON_SECRET}` }
          : {},
      }).catch(() => {
        // Never throw out of a schedule; the next firing retries.
      }),
    )
  },
})
