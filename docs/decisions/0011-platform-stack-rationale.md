# 0011. Platform stack: Vercel + Neon + Better Auth + Drizzle + Upstash

Status: Accepted
Date: 2026-07-07

## Context

The platform choices were made across mid-2026 (the auth/DB stack via
`docs/plans/auth-db-migration.md`, executed in phases; caching/rate-limiting when
`lib/cache.ts`/`lib/rate-limit.ts` landed; the valuations Worker via ADR 0005) but the
rationale lived in a plan's "Why" section and code comments, not in an ADR. Without a
decided-area record, agents can relitigate the stack or, worse, quietly add a parallel
choice (a second cache, a different ORM) that fragments it. This ADR records what was
chosen, why, and the constraints any replacement must meet.

## Decision

The stack, and the reasons each piece won:

- **Vercel** (hosting, previews, cron). The app is Next.js-native; per-PR preview
  deployments are load-bearing for the review loop (every PR gets a real URL + screenshot
  bots), and `vercel.json` cron powers the standing-orders/valuation/self-improve loops.
  Costs scale to near-zero at current traffic.
- **Neon** (Postgres). Serverless with scale-to-zero — hop's traffic is spiky and low;
  a provisioned instance would be idle spend. Branch-per-preview exists when needed.
  Replaced Supabase: we used none of its platform surface (RLS was bypassed by the
  service-role client anyway; user scoping is enforced in code via `withDb`), so we were
  paying platform complexity for a plain Postgres.
- **Better Auth** (identity). Replaced Auth0: no MAU pricing cliff, and identity tables
  live in *our* database (owns `user`/`session`/`account` via the Drizzle adapter), so
  there's no external user store to sync or pay per-user for. Code-first config matches
  the flag-gated house style (`isGoogleAuthEnabled`); no middleware required. Identity was
  re-keyed while the user count was tiny — "re-keying identity is cheap now and expensive
  after launch" was the trigger for doing it in 2026-07, not later.
- **Drizzle** (ORM + migrations). Replaced hand-rolled Supabase query-builder calls.
  Type-safe against `lib/db/schema.ts`, offline SQL generation (`db:generate`), and thin
  enough to sit behind the existing `withDb` chokepoint — the whole DB migration was
  executed by re-pointing one helper, which is the property to preserve.
- **Upstash Redis** (cache + rate limiting). Serverless REST Redis — no connection pools,
  which matters on Vercel's serverless fleet where per-process in-memory state doesn't
  survive across instances. Both `lib/cache.ts` and `lib/rate-limit.ts` degrade to an
  in-memory fallback when unconfigured and never throw, so Upstash is an upgrade, not a
  dependency: local dev and tests need no Redis.
- **Cloudflare Worker + D1** (valuation aggregation only). The one non-Vercel compute
  piece, decided in ADR 0005: telemetry ingestion wanted an isolated, always-cheap
  endpoint with its own storage, deliberately outside the app's blast radius.

The meta-rule that made each swap cheap, and that any future change must keep:
**every external service sits behind a lazy, gracefully-degrading seam** (`lib/env.ts`
call-time reads; `withDb`; the cache/rate-limit fallbacks). The app boots, tests, and
builds with zero credentials.

## Consequences

- This is a decided area. Adding a parallel cache/ORM/auth path, or re-opening
  "Supabase vs Neon"-class questions, needs a new ADR superseding this one — not a PR.
- Replacement criteria are explicit: any successor must (1) fit behind the existing seam,
  (2) cost ~zero at idle, (3) require no long-lived connections from serverless, and
  (4) keep identity data in our own Postgres.
- Known trade-offs accepted: Vercel/Neon/Upstash are three vendors where one platform
  could consolidate; the Upstash in-memory fallback means rate limits are per-process
  (advisory) whenever Redis is unconfigured; Better Auth is younger than Auth0 — mitigated
  by owning the tables (data is portable Postgres rows, not a vendor export).
- The full execution record stays in `docs/plans/auth-db-migration.md` (phases, re-keying
  mechanics); this ADR is the durable *why*.
