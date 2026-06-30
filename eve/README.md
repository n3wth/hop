# eve/ — hop's proactive travel agent (Vercel Eve)

This directory is hop's always-on travel agent, built on [Vercel Eve](https://vercel.com/eve)
("Next.js for agents"). It is the **runtime + channel + memory** that the deterministic verdict
engine in `lib/*` has always lacked: Eve runs hop's own engine on a schedule against each user's
real balances and learned patterns, detects when a redemption crosses the value line
(`cpp ≥ 2.5`), and *pushes* the result to the user (email first).

The design source of truth is [`docs/plans/2026-06-30-eve-agent.md`](../docs/plans/2026-06-30-eve-agent.md).

## The one rule: the engine computes, Eve narrates

hop's core invariant holds here without exception. **Every economic number — cpp, miles, taxes,
tiers, ranking, the pick, the verdict — is computed by `lib/*` deterministic code, never generated
by the model.** Eve's tools (`tools/*.ts`) import and wrap the *same* `lib/*` functions the Next.js
app already calls (`assembleSearch`, `priceTrip`, `getUserBalances`, `cpp`/`tier`, the standing-order
CRUD + crossing rule, `lib/email.ts#sendAlertEmail`). The LLM composes prose *around* those returned numbers; it
must never invent one. This is the same contract the in-app concierge enforces via `price_trip`.

## How it maps to the design doc

| File | Design-doc role |
|---|---|
| `agent.ts` | the agent — `defineAgent({ model: 'anthropic/claude-sonnet-4-6' })`, model resolved via AI Gateway (same model as the concierge) |
| `instructions.md` | the agent's role + operating rules (personalize, always quote engine numbers, copy voice, human-in-the-loop on booking) |
| `tools/verdict.ts` | wraps `assembleSearch` — route+dates+balances → verdict/pick/summary/degraded |
| `tools/price-trip.ts` | wraps `priceTrip(code, balances)` — one-glance destination economics |
| `tools/balances.ts` | wraps `getUserBalances(userId)` — the single balance resolver |
| `tools/standing-orders.ts` | create/list/pause a watch (`parseStandingOrder` + standing-order CRUD) |
| `tools/deliver.ts` | wraps `lib/email.ts#sendAlertEmail` (+ `markAlertDelivered`) — lets a proactive run email a crossing |
| `skills/standing-order-delivery.md` | Workflow #1 playbook — sweep active watches, evaluate, deliver crossings |
| `skills/opportunity-alert.md` | Workflow #2 playbook — patterns→cpp opportunity detection |
| `skills/copy-voice.md` | the strict copy voice distilled for the agent |
| `schedules/standing-order-sweep.ts` | the schedule that replaces the gated `vercel.json` cron (Workflow #1) |
| `schedules/daily-opportunity-scan.ts` | `0 8 * * *` opportunity digest (Workflow #2) |
| `channels/email.ts` | the MVP delivery channel (email-first rollout) |

Workflows #3 (trip-window planning), #4 (conversational concierge with memory), and #5
(transfer-bonus watch) are phase-2; their hooks are noted in the design doc and reachable through
the same tools.

## Why this is build-isolated from the Next.js app

`eve/` is a **separate runtime**. It is deliberately **excluded from the Next.js `tsconfig`, ESLint,
and `next build`** so that Eve's framework imports (`eve/tools`, `eve/schedules`, `eve/context`) and
its own dependency tree never enter the app's type-check, lint, or production bundle — and the app's
build never depends on Eve being installed. The two share exactly one thing: the `lib/*` engine,
imported here via **relative paths from the repo root** (e.g. `import { assembleSearch } from
'../../lib/search'`), not the app's `@/*` alias. Treat the files in this directory as documentary
against Eve's API surface; they are not type-checked by hop's toolchain.

Co-location is the *proven* path: the existing standing-orders cron
(`app/api/cron/standing-orders/route.ts`) already imports `assembleSearch` + `getUserBalances` and
runs the engine headlessly with no user present. Eve formalizes that pattern. The external MCP server
(`app/api/[transport]/route.ts`, `hop_` Bearer tokens) stays as-is for *third-party* agents.

## Running it

This scaffold was generated from `npx eve@latest init` and then wired to hop's engine.

```bash
# from eve/ — install Eve's own deps (separate from the Next app)
npx eve@latest init        # the basis for this directory's layout
npm install                # Eve runtime deps (eve, ai, zod, …)
eve dev                    # local Eve dev server: schedules, channels, tools, sessions
```

Eve resolves the model via Vercel AI Gateway and runs on Vercel Workflows + Sandbox + Connect.
Local dev needs the AI Gateway credential and the same hop env the engine reads
(`lib/env.ts` is lazy, so importing a `lib/*` client never throws — but live `assembleSearch` wants
`DUFFEL_API_KEY` + `SEATSAERO_API_KEY`, and email delivery wants `RESEND_API_KEY` (`isEmailEnabled()`);
absent those, the engine degrades per-section and `sendAlertEmail` is a clean no-op).
Use `MOCK=1` to drive the engine from fixtures without upstream keys.
