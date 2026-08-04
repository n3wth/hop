# 0003. Eve's delivery tool wraps the shipped email seam (lib/email.ts)

Status: Accepted
Date: 2026-06-30

## Context

hop's standing-orders cron detects a verdict crossing headlessly (`assembleSearch` per watch →
`evaluateOrder` → `recordAlert`). For Eve to be *proactive* it must reach the user when a crossing
happens while no one is looking — without double-sending, without mailing someone who never asked,
and without changing production behavior before an operator is ready.

While prototyping Eve we began building a parallel delivery layer for this. We then discovered that
`main` had **already shipped** an email-delivery seam in **PR #59** (`lib/email.ts`). Two outbound
stacks for the same job is exactly the kind of duplication that rots. The decision below records
deferring to #59 and *dropping* the parallel layer — and parks the richer abstraction we sketched
as an explicit future enhancement so the idea isn't lost.

What #59 actually shipped, and what we build on:

- **`lib/email.ts`** is the delivery seam. `isEmailEnabled()` is gated on `RESEND_API_KEY` (a clean
  no-op when unconfigured); `sendAlertEmail(to, alert)` sends via the Resend REST API and **never
  throws** (returns `{ok:true}` or `{ok:false, reason:'unconfigured'|'invalid-recipient'|'send-failed'}`);
  `renderAlertEmail(alert)` is pure and deterministic, rendering the body straight from the
  engine's `FlightOption` (`alert.pick`) and inventing no numbers (per ADR 0002).
- **Per-watch contact** is `order.notifyEmail` on `hop_standing_orders` — the address is attached to
  the watch, not a separate preference store.
- **`markAlertDelivered(userId, alertId)`** (`lib/standing-orders.ts`) flips the durable alert's
  `delivered` flag after a successful send, scoped by `user_id`.
- **Free-tier alert cap** lives in `lib/subscription.ts`.
- The cron (`app/api/cron/standing-orders/route.ts`) already wires it: `isEmailEnabled()` → on a
  crossing, `sendAlertEmail(order.notifyEmail, alert)` → `markAlertDelivered(uid, alertId)`.

## Decision

**Eve's `deliver` tool WRAPS `lib/email.ts` rather than introducing a parallel delivery stack.**
The tool builds a `StandingOrderAlert` from engine-sourced inputs (cpp read off `pick.cpp`, never a
model argument), calls `sendAlertEmail(to, alert)`, and on `{ok:true}` calls
`markAlertDelivered(userId, alertId)`. It adds no envelope of its own; `lib/email`'s gate and
never-throws contract are the safety boundary. The tool exposes **no `cpp` input**, so a
model-fabricated number can never reach the user.

The richer abstraction we prototyped is recorded here as a **DEFERRED future enhancement — NOT
currently built**:

- a multi-channel preference store (email / slack / discord / webpush) with per-user channel
  selection;
- an opportunity-vs-standing-order opt-in split (broad opportunity email is consent-sensitive and
  separate from a watched-route crossing).

None of these exist in the repo today. If/when proactive opportunity pushes or a second channel are
built, this ADR is the starting point.

**Update (moat-hardening pass):** the third deferred item — an idempotent outbox ledger
(`UNIQUE(user_id, kind, dedupe_key)`) for once-only delivery with reserve/mark/release semantics —
**has since shipped**: `lib/notification-outbox.ts` + `hop_notification_outbox`, wired into
`app/api/cron/standing-orders/route.ts` ahead of `recordAlert`/`sendAlertEmail`. It is an ADDITIVE
safety net on top of the pre-existing `lastNotifiedOffer` fingerprint stamp, not a replacement —
`lastNotifiedOffer` remains the primary dedupe; the outbox closes the crash/race window between
`recordAlert` and that stamp landing (e.g. overlapping cron runs on the same watch). The cron only
stamps `lastNotifiedOffer` and closes the reservation once `recordAlert` actually returns an id; a
failed alert write or an unexpected throw releases the reservation so the crossing gets a genuine
retry next tick, rather than being silently treated as delivered.

## Consequences

- **One outbound path, no duplication.** "How does hop reach a user" has exactly one answer
  (`lib/email.ts`). Eve's schedules and the Next.js cron call the same seam; improving it (a verified
  sending domain, a retry policy) improves every caller at once.
- **The cron is unchanged and resilient.** It already gates on `isEmailEnabled()`, sends on a
  crossing, and flips `markAlertDelivered` only on success. Because `sendAlertEmail` never throws,
  one order's send failure can't sink the batch; the durable alert remains for in-app display and a
  later retry.
- **Delivery stays decoupled from detection.** The engine that *detects* a crossing (ADR 0002) is
  untouched; the `deliver` tool only carries an already-detected, engine-numbered crossing.
- **Numbers stay engine-sourced.** `renderAlertEmail` reads `alert.pick`/`alert.cpp`; the tool omits
  `cpp` from its schema. The LLM may narrate around these numbers, never produce them.
- **The deferred richer layer is consent-gated by design when it lands.** Until then, broad
  opportunity email is intentionally not shipped — recording an opportunity reuses the same
  alert-shaped delivery rather than mailing everyone.
- **No scoping or secret regressions.** `RESEND_API_KEY` is read lazily via `env.*()` and used only
  server-side; `markAlertDelivered` is `user_id`-scoped. The `security-reviewer`,
  `degradation-reviewer`, and `eve-architecture-reviewer` cover this seam.
