// deliver — the outbound push. WRAPS hop's shipped delivery seam (lib/email.ts,
// PR #59) so a proactive run can email the user when a redemption crosses the
// line. This tool adds no envelope of its own; lib/email is the safety boundary:
//   - it is GATED: sendAlertEmail returns {ok:false,'unconfigured'} (no network,
//     no throw) unless isEmailEnabled() (a RESEND_API_KEY is present) — production
//     is unchanged until an operator configures the key;
//   - it NEVER throws: every outcome is a typed result
//     ({ok:true} | {ok:false, reason:'unconfigured'|'invalid-recipient'|'send-failed'}).
//
// The email BODY is rendered DETERMINISTICALLY by lib/email.renderAlertEmail from
// the engine's FlightOption (alert.pick: route/cpp/miles/taxes) — the agent does
// NOT write the numbers into the email, and it CANNOT supply a cpp: the displayed
// cpp is read off `pick.cpp` (the engine value). The tool deliberately omits a cpp
// input so a model-fabricated number can never reach the user.
//
// DEFERRED: opportunity-kind delivery and multi-channel preferences are a future
// enhancement — main's sender (#59) is standing-order-shaped and email-only, keyed
// on the per-watch `order.notifyEmail` address. This tool delivers a standing-order
// alert; an opportunity is recorded and delivered through the same alert shape.

import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { isEmailEnabled, sendAlertEmail } from '../../lib/email'
import { markAlertDelivered } from '../../lib/standing-orders'
import type { StandingOrderAlert } from '../../lib/standing-order-alerts'
import type { FlightOption } from '../../lib/types'

export default defineTool({
  name: 'deliver',
  description:
    "Deliver a standing-order crossing to the user by email, once. Only call this on a real crossing whose numbers came from the engine (verdict/price_trip). It is gated (a clean no-op until RESEND_API_KEY is configured) and never throws. You do NOT pass any numbers: the email is rendered deterministically from `pick` (the engine's FlightOption). Pass the watch's notify email as `to` and the crossing's stable fingerprint so re-runs stay traceable. Returns {ok:true} or {ok:false, reason: unconfigured | invalid-recipient | send-failed}.",
  inputSchema: z.object({
    userId: z.string().describe('Auth0 sub of the recipient (owner of the watch).'),
    to: z.string().describe("The watch's notify email (hop_standing_orders.notifyEmail)."),
    alertId: z.string().describe('The durable alert id (hop_standing_order_alerts.id) to mark delivered on success.'),
    route: z.string().describe('Display route, e.g. "SFO → NRT".'),
    pick: z
      .record(z.string(), z.unknown())
      .describe('The engine-computed FlightOption (carries cpp, program, miles, taxes, cabin, bookingUrl). The email reads its numbers from here.'),
    fingerprint: z
      .string()
      .describe('Stable per-crossing offer fingerprint (matches last_notified_offer).'),
  }),
  async execute({ userId, to, alertId, route, pick, fingerprint }) {
    // Cheap skip: when email isn't wired, don't even build the alert.
    if (!isEmailEnabled()) return { ok: false as const, reason: 'unconfigured' as const }
    const option = pick as unknown as FlightOption
    const alert: StandingOrderAlert = {
      id: alertId,
      standingOrderId: '',
      route,
      pick: option,
      // Read off the engine value; renderAlertEmail invents no number.
      cpp: typeof option.cpp === 'number' ? option.cpp : 0,
      fingerprint,
      delivered: false,
      seen: false,
    }
    const result = await sendAlertEmail(to, alert)
    if (result.ok) {
      await markAlertDelivered(userId, alertId)
    }
    return result
  },
})
