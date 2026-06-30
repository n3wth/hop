---
title: Standing-order crossings were detected but never delivered (and we nearly shipped a second delivery layer)
date: 2026-06-30
tags: [notifications, delivery, gated, resend, email, standing-orders, cron, eve, recon, duplication, open-prs]
files: [lib/email.ts, lib/standing-orders.ts, lib/subscription.ts, app/api/cron/standing-orders/route.ts]
status: solved
---

## Problem

Two problems, one window.

1. **Detection without delivery.** The standing-orders engine could fully detect a value crossing —
   it ran `assembleSearch` headlessly per watch, evaluated `evaluateOrder`, and computed the `cpp` —
   but it had **no way to tell the user**. The 6-hourly cron found crossings and dropped them on the
   floor.
2. **A near-duplicate subsystem.** While building Eve's proactive layer we started a *parallel*
   email-delivery stack — not realizing `main` had already shipped one in **PR #59**. We almost
   merged two outbound paths for the same job.

## Symptoms

- `app/api/cron/standing-orders/route.ts` once had a `// PUSH DELIVERY TODO` where a send should be:
  the cron recorded an alert and moved on; the durable alert's `delivered` flag never flipped true.
- A second, parallel delivery layer (a `notify`/`outbox`/`notification-prefs` trio) was prototyped
  in the same window, gated on its own flag/env, with its own preference store and dedupe ledger —
  redundant with `lib/email.ts` from #59.
- The duplication only surfaced when reconciling our branch against the latest `main` and its open
  PRs — not during initial planning.

## Root cause

- **Detection-only by history.** hop was built as a request/response optimizer: every surface is a
  user *pulling* a verdict. There was no *push* path because the engine had never spoken first.
  Standing orders introduced that moment but the delivery seam to carry it was added separately (in
  #59).
- **Recon gap.** Our planning/review checked the working tree and the engine, but did **not** scan
  open/in-flight PRs and the very latest `main` before designing a new subsystem. #59 had already
  shipped `lib/email.ts`; we built against a stale picture and produced a parallel layer.

## Solution

Defer to the shipped seam (#59) and drop the parallel layer. The actual outbound path is:

- **`lib/email.ts`** — the delivery seam.
  - `isEmailEnabled()` is GATED on `RESEND_API_KEY`: a clean no-op when unconfigured, so production
    degrades to the in-app alert record exactly like every other hop seam.
  - `sendAlertEmail(to, alert)` sends via the Resend REST API and **never throws** — returns
    `{ok:true}` or `{ok:false, reason:'unconfigured'|'invalid-recipient'|'send-failed'}`, so a dead
    provider leaves the alert undelivered (to retry) instead of crashing the cron batch.
  - `renderAlertEmail(alert)` is pure and deterministic. Route, `cpp`, miles, taxes all come
    straight from the engine's `FlightOption` (`alert.pick`) — the engine-is-truth invariant
    (ADR 0002); the LLM may narrate around these, never produce them.
- **Per-watch contact** — the delivery address is `order.notifyEmail` on `hop_standing_orders`
  (attached to the watch, not a separate preference store). Dedupe is the per-watch
  `lastNotifiedOffer` fingerprint, not an outbox ledger.
- **`markAlertDelivered(userId, alertId)`** (`lib/standing-orders.ts`) flips the durable alert's
  `delivered` flag once a send succeeds, scoped by `user_id`.
- **Free-tier alert cap** — `lib/subscription.ts` caps how many alerts a free user can be sent.
- **The cron wiring** — `app/api/cron/standing-orders/route.ts` checks `isEmailEnabled()`, then on a
  crossing calls `sendAlertEmail(order.notifyEmail, alert)`, and on `{ok:true}` calls
  `markAlertDelivered(uid, alertId)`. The delivered count is returned for observability.

The richer abstraction we prototyped (multi-channel preference store, opportunity-vs-standing-order
opt-in, an idempotent outbox ledger) is **deferred, not built** — recorded in
`docs/decisions/0003-notification-delivery-abstraction.md` as a future enhancement. Eve's `deliver`
tool WRAPS `lib/email.ts`; an opportunity is recorded and delivered through the same alert shape
until a broader sender exists.

## How this compounds

- **Always scan open PRs and the latest `main` before building a new subsystem.** This is the
  lesson with teeth. Our parallel delivery layer existed only because recon/review checked the local
  tree and the engine but not in-flight work. Before designing anything net-new, list open PRs
  (`gh pr list`) and diff against the freshest `main`; if a seam for the job already exists, wrap it
  instead of cloning it. "How does hop reach a user" must have exactly one answer (`lib/email.ts`),
  and one outbound path means improving it (a verified domain, a retry policy) improves every caller
  at once.
- **Delivery degrades gracefully and is engine-narrated.** Gated behind `isEmailEnabled()`,
  never-throws, and renders only engine numbers — the same house-style contract every other hop seam
  holds. A future agent adding an ungated or LLM-numbered push trips the reviewers
  (`eve-architecture-reviewer`, `degradation-reviewer`, `security-reviewer`).
- **Production behavior is unchanged until opt-in.** Because delivery is gated on `RESEND_API_KEY`,
  the whole path ships dark; turning it on is one key.
- See `docs/decisions/0003-notification-delivery-abstraction.md` for the decision record and the
  deferred richer layer.
