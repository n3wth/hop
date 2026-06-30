// Email — the MVP delivery channel. Per the design doc's web-first/email-as-MVP
// rollout, email is the channel that needs ZERO new client surface and reaches
// every user, so it carries the first proactive messages (standing-order crossings
// and the opportunity digest).
//
// IMPORTANT — two delivery paths, deliberately:
//   - PROACTIVE ALERTS go through lib/email.sendAlertEmail (the `deliver` tool):
//     gated by isEmailEnabled() (RESEND_API_KEY), never throws, with a DETERMINISTIC
//     body rendered from the engine's FlightOption. That path is the source of truth
//     for the numbers; this channel config is the agent's email I/O.
//   - INBOUND replies + agent-composed prose route through this channel so the user
//     can converse ("watch SFO→NRT business above 4cpp", "stop showing me Tokyo").
//
// Sender identity + unsubscribe are required before turning notifications on
// (design-doc blocker #1). The From identity is kept in one place so it can't drift
// from lib/email's Resend `from`.

import { defineChannel } from 'eve/channels'

// Same From identity lib/email.ts resolves for Resend: HOP_ALERT_EMAIL_FROM with a
// hop default. Kept aligned so the agent's email I/O and the alert sender never drift.
const FROM = process.env.HOP_ALERT_EMAIL_FROM?.trim() || 'hop alerts <alerts@hop.travel>'

export default defineChannel({
  type: 'email',
  from: FROM,
  // Inbound replies become new turns in the user's durable session, so a reply to
  // an alert ("watch this route", "not interested in Tokyo") is handled in-thread.
  inbound: true,
  // Required for proactive mail. Eve appends the unsubscribe affordance. (Broad
  // opportunity opt-out / multi-channel preferences are a DEFERRED enhancement —
  // main's sender is standing-order + per-watch notifyEmail only.)
  unsubscribe: true,
})
