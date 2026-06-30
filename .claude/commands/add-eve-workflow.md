---
description: Scaffold a new Eve workflow (skill + schedule + tool wrapping lib/*, delivery via lib/email (sendAlertEmail)) following the established pattern. Numbers stay engine-sourced; the seam stays flag-gated.
argument-hint: <workflow idea, e.g. "weekly opportunity digest from balances + topValue">
---

# /add-eve-workflow — scaffold an Eve workflow the hop way

Scaffold a new **Eve** workflow for: **$ARGUMENTS**.

Eve is Vercel's durable agent framework ("Next.js for agents"), **co-located in the hop repo** —
its tools import hop's `lib/*` engine directly, the same proven path the standing-orders cron
already uses to run `assembleSearch` headlessly. The design doc is the source of truth:
**read `docs/plans/2026-06-30-eve-agent.md` first** (5 workflows, web+email-first hybrid rollout,
12 blockers) and place this new workflow within that design — don't contradict it.

## Before you scaffold — research + fit

1. Read `docs/plans/2026-06-30-eve-agent.md`. Decide which of the 5 designed workflows this is (or
   whether it's a genuinely new one) and which **blockers** apply (delivery, dedupe, seat-stub,
   Gmail gating, etc.).
2. Identify the exact **engine hooks** this workflow wraps, and confirm each returns numbers you can
   narrate without recomputing:
   `assembleSearch` (`lib/search.ts`), `priceTrip` (`lib/concierge-tools.ts`),
   `getUserBalances` (`lib/accounts.ts`), `evaluateOrder` (`lib/standing-orders-model.ts`),
   `listActiveStandingOrders`/`parseStandingOrder`/`createStandingOrder` (`lib/standing-orders*.ts`),
   `cpp()`/`tier()`/`POINTS_THRESHOLD_CPP` (`lib/cpp.ts`),
   `effectiveBalanceFor`/`transferRoutesTo`/`sourcePointsFor` (`lib/transfers.ts`),
   `topValue`/`affordableWith`/`destinationByCode` (`lib/destinations.ts`),
   `getTravelHistory`/`derivePatterns`/`travelHistorySummary` (`lib/travel-history.ts`).
3. Identify the **delivery + memory** seams: `lib/email.ts#sendAlertEmail` (gated, never-throws),
   the per-watch `notifyEmail` address + `lastNotifiedOffer` fingerprint on `hop_standing_orders`,
   `lib/standing-orders.ts#markAlertDelivered` (flip on success), and Eve
   `defineState<T>("ns.key", () => initial)` for durable per-user dedupe/learning.

## Scaffold the pieces (Eve is directory-based, co-located under `eve/`)

Create the files this workflow needs, each with a short top comment block (WHAT + WHY) matching
hop's file-header style. Be terse and concrete. Per Eve conventions the **runtime tool name is the
filename**, so name files to match.

- **`eve/skills/<slug>.md`** — a markdown playbook loaded contextually: when this workflow fires,
  what it scans, which tools it calls in what order, the copy voice it must use, and the explicit
  rule **"every cpp/miles/tier/verdict/$ comes from a tool result — never compute or estimate a
  number; narrate the engine's output."** Encode the copy bar from `docs/design/copy-spec.md`
  (terse, state the answer + number, no slop/clichés, no emoji, bunny = logo + one warm moment).
- **`eve/schedules/<slug>.ts`** — `defineSchedule({ cron: '<cron>', async run({ receive, waitUntil,
  appAuth }) { ... } })`. Per user: load data via the tools, threshold deterministically, dedupe via
  `defineState` (and/or the `lastNotifiedOffer` fingerprint), then deliver. Keep the body
  **retry-safe** (`'use
  workflow'`/`'use step'` auto-retry — no double side-effects). Confirm the cron cadence against
  Vercel's minimum frequency (blocker #4).
- **`eve/tools/<tool-name>.ts`** (only if a needed wrapper doesn't exist) — `defineTool` from
  `eve/tools` with a zod `inputSchema`, whose body **calls hop `lib/*` and returns the engine
  output**. Never recompute economics, never ask the model for a number (the engine-invariant and
  eve-architecture reviewers will flag it).
- **State** — declare `defineState<T>("<ns>.<key>", () => initial)` for per-user dedupe ledgers and
  learned preferences. Per-user namespacing only; **no secrets/PII in state**.

## Non-negotiable invariants for this workflow

- **Numbers are engine-sourced.** Every economic figure is computed by `lib/*` and only narrated by
  the model. The tool returns the number; the skill tells the model to restate it verbatim.
- **The seam is flag-gated with a graceful no-op.** Email delivery runs only when `isEmailEnabled()`
  (`RESEND_API_KEY`, `lib/email.ts`); booking/payment only when `isCheckoutEnabled()`
  (test key only, never live); Gmail patterns only when `isGmailHistoryEnabled()`. When a gate is
  off, the workflow must **return cleanly, not throw or half-send**. New env via `lib/env.ts` lazy
  accessors, never `process.env` directly.
- **Delivery doesn't double-send.** Dedupe on the **stable** per-watch `lastNotifiedOffer`
  fingerprint, send via `lib/email.ts#sendAlertEmail(to, alert)` (gated, never throws, returns a
  typed `EmailResult`), then `markAlertDelivered(userId, alertId)` only after `{ok:true}`. A
  schedule re-fire or retried step must not double-send.
- **Degrades, never crashes.** Engine + DB calls already return `{ok:false}`/fallbacks via `withDb`;
  catch per-user in the loop so one bad user/order doesn't abort the batch. Narrate the degraded path
  (`degraded[]`) honestly — don't paper over a dead section with an invented figure.
- **Human-in-the-loop on irreversible actions.** Anything that books, pays, sends money, or mutates
  standing orders goes through an Eve approval gate (park/resume); never autonomous, never the live
  Duffel key.
- **user_id scoping.** Service-role bypasses RLS — every DB read/write scopes by the authenticated
  Auth0 `sub`, never a caller-supplied id.

## Finish

- Add a vitest for the pure parts (thresholding, dedupe-key derivation, candidate selection) under
  `lib/**/*.test.ts`; the schedule body itself stays thin.
- Run `npx tsc --noEmit` and `npx vitest run <file>` on what you added.
- Then run `/review-parallel` (especially **eve-architecture-reviewer** and
  **engine-invariant-reviewer**) and `/compound` to capture anything learned.

End with the absolute paths of the files you created and a 3–5 line summary of the workflow's
trigger → engine hooks → delivery path, plus which blockers from the Eve doc still gate it.
