# 0001. Eve is co-located in the hop repo

Status: Accepted
Date: 2026-06-30

## Context

We are adding a proactive layer — [Vercel Eve](https://vercel.com/eve), a durable agent runtime
— on top of hop. Eve supplies the three pieces hop lacks: a **runtime** that runs on its own
(`schedules/`), a **channel** to reach the user (`channels/`), and a **memory** that personalizes
(`defineState`). hop already owns the hard part: the deterministic points-vs-cash verdict engine
in `lib/*`.

The design doc (`docs/plans/2026-06-30-eve-agent.md`) had to choose how Eve reaches that engine.
Two options:

1. **Out-of-process** — Eve runs elsewhere and calls hop's external MCP server
   (`app/api/[transport]/route.ts`) over HTTP with a `hop_` Bearer token, acting as a user.
2. **Co-located** — Eve lives *inside* the hop repo and its `tools/*.ts` import `lib/*` directly,
   the same way every web surface and the cron already do.

The co-located path is already **proven**: the standing-orders cron
(`app/api/cron/standing-orders/route.ts`) imports `assembleSearch` (`lib/search.ts`) and
`getUserBalances` (`lib/accounts.ts`) and runs the engine *headlessly, with no user present*. That
is exactly Eve's execution shape. Going out-of-process would mean re-serializing the engine across
HTTP, re-authenticating as the user on every call, and maintaining a second code path to the same
functions.

## Decision

**Eve lives in the hop repo under `eve/` and its tools import `lib/*` directly.** Eve is deployed
on Vercel alongside the Next.js app. Its `tools/` (`eve/tools/verdict.ts`, `price-trip.ts`,
`balances.ts`, `standing-orders.ts`, `deliver.ts`) wrap the same engine functions the web app
calls — `assembleSearch`, `priceTrip`, `getUserBalances`, the standing-orders CRUD, and
`lib/email.ts#sendAlertEmail`. Its `schedules/` (`daily-opportunity-scan.ts`, `standing-order-sweep.ts`) run that
engine on a cadence; its `channels/email.ts` delivers the result; `agent.ts` pins
`anthropic/claude-sonnet-4-6` (resolved via AI Gateway) to match the in-app concierge.

**The external MCP server stays as-is, for third-party agents.** `app/api/[transport]/route.ts`
(streamable-HTTP `/api/mcp` + legacy SSE `/api/sse`, optional `hop_` Bearer tokens) is the public
"Add to Claude" surface. Eve does **not** consume it — it sits next to the engine — so the MCP
server is no longer hop's *only* agent integration, but remains the integration for callers we do
not own.

## Consequences

- **One code path to the engine.** Eve tools, the cron, and the web app all call the same `lib/*`
  functions, so a change to the engine reaches every surface at once and there is no second
  serialization/auth layer to keep in sync.
- **Full in-process authority is a responsibility.** Co-located Eve imports `lib/*` with the same
  authority as the cron (service-role DB client, no token boundary). Blocker #10 in the design doc
  applies: scope writes deliberately (create standing orders, deliver, book) and add an audit
  trail. The `eve-architecture-reviewer` enforces co-location, flag gating, and human-in-the-loop
  on irreversible actions.
- **The MCP server now has a narrower job.** It serves third parties only; it does not need to
  grow to cover Eve's needs. A user's data stays reachable only via that user's own `hop_` token
  (out-of-process) or, in-process, via explicit `userId` scoping (`lib/accounts.ts#getUserBalances`).
- **Deployment is unified.** Eve ships with the app on Vercel (AI Gateway + Workflows + Sandbox +
  Connect), not as a separate service — one repo, one deploy, one set of env/flags.
- **If Eve ever moves out-of-process**, the fallback is the MCP server + `hop_` token path
  (`lib/api-tokens.ts#userIdForToken`); the design doc notes the seams that would matter then
  (e.g. Gmail patterns are read only by the in-app concierge today).
