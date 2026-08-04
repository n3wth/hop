# Observed point-valuation sync

> Retrospective/companion plan doc — this pipeline was implemented this session. See
> `docs/decisions/0005-observed-point-valuation-sync.md` for the full rationale.

## Problem

`lib/valuations.ts`'s `BASELINE_CPP` table is the last hand-curated economic figure in hop:
cents-per-point per loyalty program, meant to be refreshed quarterly by a human from published
community valuations. Every search already computes a *real* cpp per option
(`lib/cpp.ts` via `lib/search.ts#assembleSearch`) — that first-party signal can ground the
baseline instead of waiting on a manual refresh, without scraping anyone's credentials or
copyrighted content (see ADR 0005 for the options considered and rejected).

## Architecture

```
assembleSearch (per search, unchanged)
   -> lib/valuation-telemetry.ts#recordCppObservations   [fire-and-forget, no-op unless enabled]
        POST {WORKER_URL}/observe  (bearer HOP_VALUATION_SYNC_SECRET)
              |
              v
   Cloudflare Worker (cloudflare/valuations-worker/)
     - D1 "hop-valuations" (id d26989d0-b0e1-42bc-87ba-859424f6f5b9)
     - observations table: append-only intake from /observe
     - Cron Trigger (every 6h): trimmed-mean cpp per program, gated on
       MIN_SAMPLES_TO_TRUST, damped +/-MAX_DAMPING_PCT vs previous snapshot,
       prunes observations older than OBSERVATION_RETENTION_DAYS
     - valuation_snapshot table: current aggregate per program
     - GET /valuations returns the snapshot
              |
              v
   Vercel cron: app/api/cron/valuation-sync/route.ts  (scheduled in vercel.json)
     - GET {WORKER_URL}/valuations
     - validates + clampCpp()s each row, requires a real programById() match
     - mirrors trustworthy rows into Supabase via lib/valuation-overrides.ts
              |
              v
   lib/valuations-live.ts#getLiveValuations() / liveValuationsByName()
     - starts from lib/valuations.ts#listValuations() (the static floor)
     - overwrites a program's cpp ONLY when the override is fresh
       (<= OVERRIDE_FRESHNESS_DAYS) and has enough samples
       (>= MIN_SAMPLES_TO_TRUST) — else the static baseline wins
     - consumed by /ask concierge prompt-building call sites
```

Every hop between these boxes degrades independently: a dead Worker, an empty D1 table, a missing
Supabase row, or the flag being off all collapse back to the pure static baseline. Nothing in this
chain can throw to a caller or fabricate a number — the Worker's aggregation and the Vercel cron's
validation only ever narrow or reject data, never invent it.

## Files touched

- `lib/env.ts` — `HOP_VALUATION_WORKER_URL`, `HOP_VALUATION_SYNC_SECRET`,
  `isValuationSyncEnabled()`.
- `lib/valuation-telemetry.ts` — fire-and-forget observation emitter (new).
- `lib/valuation-overrides.ts` — Supabase persistence for the mirrored aggregate, `withDb`
  pattern, table `hop_valuation_overrides` (new).
- `lib/valuations-live.ts` — merges overrides on top of the static baseline (new).
- `app/api/cron/valuation-sync/route.ts` — pulls the Worker snapshot into Supabase (new).
- `cloudflare/valuations-worker/` — separate Workers runtime: `/observe`, `/valuations`,
  scheduled aggregation, D1 migrations, README (new, excluded from the Next app's
  build/typecheck/lint the same way `eve/` is).
- `lib/valuations.ts` — **unchanged**. Its pure/no-top-level-I/O contract and
  `lib/__tests__/valuations.test.ts` stay exactly as they were.
- `docs/decisions/0005-observed-point-valuation-sync.md` — ADR for this decision.
- `CLAUDE.md` — one paragraph under "Architecture — the big picture" pointing at
  `lib/valuations.ts` + `lib/valuations-live.ts`.

## Rollout steps (operator, manual)

None of this is live yet. To turn it on:

1. **Deploy the Worker.** From `cloudflare/valuations-worker/`: authenticate
   (`wrangler login` or `CLOUDFLARE_API_TOKEN`), `wrangler secret put HOP_VALUATION_SYNC_SECRET`
   (a freshly generated random value), then `npm install && npm run deploy`. The D1 database is
   already provisioned — no manual schema step needed.
2. **Set the three Vercel env vars:**
   - `HOP_VALUATION_WORKER_URL` — the deployed `*.workers.dev` URL, no trailing slash.
   - `HOP_VALUATION_SYNC_SECRET` — the **same** value set as the Worker secret in step 1.
   - `HOP_ENABLE_VALUATION_SYNC=1` — flips `isValuationSyncEnabled()` on.
3. **Wait for observations to accumulate.** Real searches start POSTing to `/observe`
   immediately once the flag is on, but `lib/valuations-live.ts` only trusts a program's override
   once it has **>= 20 samples** (`MIN_SAMPLES_TO_TRUST`) and an `asOf` inside the last 14 days
   (`OVERRIDE_FRESHNESS_DAYS`). Low-volume programs may never cross that bar and will simply keep
   reading from the static baseline indefinitely — that is the intended, safe default.
4. **Optional CI**: add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub repo secrets
   so `.github/workflows/deploy-valuations-worker.yml` can auto-deploy the Worker on future pushes
   to `cloudflare/valuations-worker/`.

Until all of step 2 is done, `isValuationSyncEnabled()` is false and the entire pipeline —
telemetry emission, the Vercel cron, the live-valuation merge — is a complete no-op with zero
behavior change to the running app.
