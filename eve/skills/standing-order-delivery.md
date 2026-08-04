# Skill: standing-order delivery

Workflow #1 from the design doc — the smallest gap and the fastest real proactive message.
Detection already works in hop; this PR added the delivery. There are **two distinct halves**, and
only one of them involves you (the agent).

## Half 1 — the sweep is DETERMINISTIC and engine-owned (NOT your job)

The cross-user sweep + crossing decision + delivery is pure `lib/*` code, already implemented in the
hop route handler `app/api/cron/standing-orders/route.ts`:

`listActiveStandingOrders()` → per watch `getUserBalances` + `assembleSearch` → `evaluateOrder()`
(the pure crossing rule: redemption pick, eligible-program filter, `cpp ≥ minCpp` floored to 2.5,
seats, AND a NEW fingerprint vs `lastNotifiedOffer`) → `recordAlert()` →
`lib/email.ts#sendAlertEmail(order.notifyEmail, alert)` (gated on `isEmailEnabled()`) →
`markAlertDelivered()` + `recordNotifiedOffer()`.

**You never run this loop and never apply the cpp threshold yourself** — `evaluateOrder` is the only
crossing judge, exactly so an LLM never re-derives a verdict. `schedules/standing-order-sweep.ts`
triggers this handler on a cadence; the engine does the rest. Pick **one** runner — the Eve schedule
*or* the Vercel cron (`vercel.json`) — not both.

## Half 2 — conversational watch management (this IS your job)

When a user talks to you, manage their watches with the tools you actually have:

- "watch SFO→NRT business above 4cpp departing 2026-03-12" → `create_standing_order` (it parses,
  validates, clamps, and persists). Confirm back the parsed terms in the copy voice.
- "list my watches" → `list_standing_orders`.
- "pause the Tokyo one" / "stop watching that" → `pause_standing_order`.

You may also narrate a crossing the engine already delivered (if asked), reading the numbers off the
durable alert record — never recomputing them.

## Why this split

It keeps the moat intact: every economic number and the crossing decision come from `lib/*`. Your
value is the natural-language surface (create/list/pause) and the durable, idempotent delivery the
engine now performs — not re-implementing the verdict.
