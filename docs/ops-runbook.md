# Ops runbook — production capabilities on/off

How to turn each production capability on or off, what each one needs, and how to
verify it. Env vars are set in the Vercel project (Production scope) unless noted.
`.env.example` is the complete enumeration of every var the app reads; this doc is
the procedure layer on top.

Two house rules make every switch here safe:

1. **Gated seams need BOTH the flag AND the credentials** (`lib/env.ts`
   `is*Enabled()` helpers). A flag without its keys — or keys without the flag —
   is a byte-for-byte no-op. You can stage secrets ahead of a flip.
2. **Nothing throws to a page.** An unconfigured or dead capability degrades to a
   `503 disabled` (cron routes), an `{ok:false}` result (lib clients), or a hidden
   UI section. Flipping a flag off is always a safe rollback.

Flags parse `1|true|yes` (case-insensitive) as on; anything else is off.

## Current production state (2026-07-04, post R0.4 flips)

Live state is visible at a glance on `/admin/ops` (owner-only preflight table).

| Capability | State |
| --- | --- |
| Self-improve loop (`HOP_ENABLE_SELF_IMPROVE`) | **ON.** Degradation telemetry records with reasons; drilldown on `/admin/ops`. |
| Linear filing (`LINEAR_API_KEY` + `LINEAR_TEAM_ID`) | **Set (2026-07-04).** Sentinel P1s should file to Linear; email fallback remains. |
| Valuation sync (`HOP_ENABLE_VALUATION_SYNC`) | **ON.** Worker deployed at `https://hop-valuations.newth.workers.dev` (D1 schema applied, 6h cron); all three Vercel vars set. Programs go live per-program at ≥20 samples. |
| Standing-order alerts (`STANDING_ORDERS_CRON_ENABLED`) | **ON.** `RESEND_API_KEY` set; hop.flights DKIM + SPF **verified** in Resend (the "Receiving MX" record stays failed by design — inbound mail is Cloudflare Email Routing). |
| Product analytics | `NEXT_PUBLIC_POSTHOG_KEY`/host set; the five funnel events ship as of PR #167. |
| Billing (`HOP_ENABLE_BILLING`) | **ON** (Stripe keys + webhook secret set). Still owed: one real test purchase end-to-end. |
| Checkout (`HOP_ENABLE_CHECKOUT`) | Set with `DUFFEL_API_KEY_TEST` (test-only by design). |
| `MOCK` | Removed from production env (live upstreams). |
| GitHub Actions CI | **Disabled** (billing broken — see the CI section below). Required PR check is the Vercel build. |

## Alerts / standing orders

The "verdict that watches" — `/api/cron/standing-orders` (every 6h, `vercel.json`)
re-runs `assembleSearch` per active watch and records + emails crossings.

**Turn on:**

1. `STANDING_ORDERS_CRON_ENABLED=1` — the route is `503 disabled` until truthy.
2. `CRON_SECRET=<random>` — Vercel Cron sends it as `Authorization: Bearer`;
   **unset means every cron route 401s in production** (fail-closed,
   `lib/cron-auth.ts`), so Vercel Cron itself would be locked out — always set
   it in prod. Local dev without the secret stays open.
3. Email delivery (optional but the point): `RESEND_API_KEY=<key>`, and verify the
   From domain in Resend — add Resend's **DKIM/SPF records to Cloudflare DNS** for
   `hop.flights`, or set `HOP_ALERT_EMAIL_FROM` to an already-verified domain as a
   stopgap. Without the key, alerts still record in-app (`delivered` stays false)
   and the cron skips the delivery step entirely.

**Turn off:** unset `STANDING_ORDERS_CRON_ENABLED` (or set `0`). Watches and past
alerts persist; evaluation just stops.

**Verify:** `curl -H "Authorization: Bearer $CRON_SECRET" https://hop.flights/api/cron/standing-orders`
returns a JSON summary (or `{"status":"disabled"}` when off). Failed sends leave
`delivered=false` and retry next run via the idempotent outbox (ADR 0003).

## Valuation sync (ADR 0005)

Live first-party cpp observations override the static `BASELINE_CPP` once a
program has ≥20 fresh samples. Fully inert until the Cloudflare Worker exists.

**Turn on (order matters — worker first):**

1. Deploy the worker: `cd cloudflare/valuations-worker && wrangler login`,
   `openssl rand -hex 32`, `wrangler secret put HOP_VALUATION_SYNC_SECRET`,
   `npm install && npm run deploy`. (D1 is already provisioned — see the worker
   README. CI auto-deploys on push once `CLOUDFLARE_API_TOKEN` +
   `CLOUDFLARE_ACCOUNT_ID` repo secrets are added in GitHub.)
2. In Vercel: `HOP_ENABLE_VALUATION_SYNC=1`,
   `HOP_VALUATION_WORKER_URL=<workers.dev URL, no trailing slash>`,
   `HOP_VALUATION_SYNC_SECRET=<the SAME value as the worker secret>`.

**Turn off:** unset `HOP_ENABLE_VALUATION_SYNC`. Telemetry stops POSTing,
`/api/cron/valuation-sync` answers `503 disabled`, and `lib/valuations-live.ts`
falls back to the pure static baseline. Existing Neon overrides go stale and stop
winning once their freshness window lapses.

**Verify:** hit `/api/cron/valuation-sync` with the cron bearer; check the
`hop_valuation_overrides` rows gain fresh `sample_count`.

## Balance sync (paste / email forward)

The AwardWallet-independent syncing seam (`docs/plans/2026-07-05-balance-sync.md`):
paste a statement on `/account`, or forward balance emails to a personal
HMAC-signed sync address. Extraction via the AI Gateway with a deterministic
clamp (a balance must appear verbatim in the source text); no gateway key →
regex fallback. Writes ordinary `hop_manual_balances` rows.

**Turn on (paste rail only):** `HOP_ENABLE_BALANCE_SYNC=1` in Vercel. The
`/account` affordance appears; `AI_GATEWAY_API_KEY` (already set for the
concierge) upgrades extraction from regex to the gateway model
(`HOP_BALANCE_SYNC_MODEL`, default `anthropic/claude-haiku-4-5`).

**Turn on the email rail (worker first):**

1. Deploy the worker: `cd cloudflare/balance-sync-worker && npm install`,
   `openssl rand -hex 32`, `wrangler secret put HOP_BALANCE_INGEST_SECRET`,
   `npm run deploy`; then point the zone's Email Routing catch-all at it
   (worker README).
2. In Vercel: `HOP_BALANCE_INGEST_SECRET=<the SAME value>`.

**Turn off:** unset `HOP_ENABLE_BALANCE_SYNC`. The affordance disappears, the
paste route answers `503`, and the ingest route refuses even a valid secret —
a still-deployed Worker becomes a no-op.

**Verify:** paste a statement email on `/account` → preview shows the read
balances → Save; rows appear in "Your programs".

## Self-improve loop / degradation telemetry (ADR 0007)

Deterministic health detection: `recordDegradation()` rows + the daily
`/api/cron/health-sentinel`. No LLM anywhere in detection.

**Turn on:** `HOP_ENABLE_SELF_IMPROVE=1` — flag-only; detection needs no key.
Off → `recordDegradation()` returns before touching anything, the sentinel
answers `503 disabled`, heartbeat READS degrade to null. Exception: heartbeat
WRITES are deliberately ungated (ADR 0007's exception list).

**Linear filing (the delivery sub-gate):** findings become Linear issues only
when `LINEAR_API_KEY` + `LINEAR_TEAM_ID` are both set
(`lib/linear.ts#isLinearConfigured`). **Currently NOT set in prod** — the loop is
detect-and-record only: findings accumulate in `hop_improvement_findings` and P1s
fall back to the owner email (`HOP_OWNER_EMAIL`). Setting both vars is the one
remaining step to get auto-filed issues. Blast radius of the key: can create
issues in one team; it is never logged.

**Turn off:** unset `HOP_ENABLE_SELF_IMPROVE`. Recorded findings persist.

## Billing (Stripe)

`isBillingEnabled()` needs the flag **and** three Stripe values; the deploy is a
no-op even with keys present until the flag flips.

**Turn on:** `HOP_ENABLE_BILLING=1` + `STRIPE_SECRET_KEY` +
`STRIPE_WEBHOOK_SECRET` (tier writes happen only on signed webhook events) +
`STRIPE_PRICE_ID_PRO_MONTHLY` (yearly id optional; `NEXT_PUBLIC_STRIPE_PRICE_*`
aliases win when set). Point a Stripe webhook at `/api/webhooks/stripe`.
`/api/cron/sync-stripe` (daily) reconciles tiers.

**Turn off:** unset `HOP_ENABLE_BILLING` — /account hides billing, checkout and
webhook routes refuse softly (`{ok:false}`/503), alert-cap copy reverts.

## Checkout (Duffel — TEST ONLY)

Native cash checkout books against the **test** key only; payments must never
touch `DUFFEL_API_KEY_LIVE` (that key is for search pricing).

**Turn on:** `HOP_ENABLE_CHECKOUT=1` + `DUFFEL_API_KEY_TEST=duffel_test_…`.
**Turn off:** unset either — the cash CTA reverts to the Kiwi affiliate deep-link.

## Auth flags

- **Email/password:** `HOP_ENABLE_EMAIL_PASSWORD_AUTH=1` + `RESEND_API_KEY`
  (verification email is load-bearing — without deliverable mail a signup can
  never complete, so the gate requires the key). Off → Google stays the only
  /login option; existing accounts unaffected either way.
- **Passkeys:** `HOP_ENABLE_PASSKEY_AUTH=1` — flag-only, but a deliberate opt-in
  (adds the `passkey` table surface + a client SDK). rpID is locked to
  `hop.flights`; use `HOP_PASSKEY_RP_ID=localhost` for local testing only —
  passkeys never carry across rpIDs.

## MOCK

`MOCK=1` swaps cash/awards/balances for fixtures (`lib/mock.ts`). Local/preview
only — **never set in production**: a real signed-in user with no programs must
see the genuine empty state, not fabricated balances. Only `1|true|yes` count.

## Auth secret

Production must set an explicit `BETTER_AUTH_SECRET`. Resolution order
(`lib/env.ts#resolveAuthSecret`): `BETTER_AUTH_SECRET` → `AUTH_SECRET` → a key
derived from `DATABASE_URL` (logged with a `console.warn`). The derived
fallback keeps a database-only deploy signing sessions, but do **not** rely on
it in prod: rotating `DATABASE_URL` would silently invalidate every session.

**Verify:** `BETTER_AUTH_SECRET` present in Vercel (Production scope) —
`vercel env ls production | grep BETTER_AUTH_SECRET` — and no
`[auth] BETTER_AUTH_SECRET is not set` warning in runtime logs.

## Database backup & bad-migration recovery

Migrations auto-apply during build (`scripts/db-migrate.mjs`, also
`npm run db:migrate`) and there are **no down migrations** — rollback is
restore, not revert. Recovery is Neon point-in-time restore / branch-restore.

Order of operations after a bad migration:

1. Stop deploys (revert or pause) so no new build re-applies the migration.
2. In Neon, restore a branch to a pre-deploy timestamp (point-in-time restore
   creates the restored branch; keep the damaged one for forensics).
3. Repoint `DATABASE_URL` (and `DATABASE_URL_UNPOOLED`) in Vercel at the
   restored branch.
4. Redeploy the previous known-good build (Vercel instant rollback) — it
   matches the restored schema.
5. Fix the migration forward in a new deploy.

Writes between the bad deploy and the restore timestamp are lost — restore
promptly.

## Rate limiting

`lib/rate-limit.ts` defaults to a per-process in-memory token bucket. On
serverless that is per-instance: the effective limit multiplies with
concurrent lambdas (N warm instances ≈ N× the nominal cap) and resets on cold
start. Accepted launch tradeoff — the limiter is abuse-damping, not a hard
quota. A durable cross-instance path already exists: set
`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (or the `KV_REST_API_*`
aliases) and `checkRateLimit` enforces in Upstash, degrading back to the
in-memory bucket on any Redis failure. Revisit (configure the Redis) when
traffic justifies it.

## CI (GitHub Actions — currently disabled)

GitHub Actions is refusing to start jobs on this account ("recent account
payments have failed or your spending limit needs to be increased"), so both
workflows (`.github/workflows/ci.yml`, `deploy-valuations-worker.yml`) are
switched to `workflow_dispatch`-only — every PR was showing a red X unrelated
to the code. Until billing is fixed:

- Pre-ship gate: `npm run check` + `npm run build` locally, plus the Vercel
  build check that still runs on every PR.
- Valuations-worker deploys: `cd cloudflare/valuations-worker && npx wrangler
  deploy` (see its README for secrets).

Re-enable: fix billing under GitHub Settings → Billing & plans, then restore
the original `pull_request`/`push` triggers in both workflow files (they're
preserved in the comments).

## Cron reference (`vercel.json`)

| Route | Schedule | Gate |
| --- | --- | --- |
| `/api/cron/standing-orders` | every 6h | `STANDING_ORDERS_CRON_ENABLED` (off until truthy) |
| `/api/cron/revalidate-seo` | weekly | `SEO_CRON_ENABLED` (defaults ON when unset) |
| `/api/cron/valuation-sync` | daily | `isValuationSyncEnabled()` |
| `/api/cron/sync-stripe` | daily | `isBillingEnabled()` |
| `/api/cron/business-digest` | Mondays | `isEmailEnabled()` (`RESEND_API_KEY`) |
| `/api/cron/health-sentinel` | daily | `isSelfImproveEnabled()` |

All six honor the same `Authorization: Bearer ${CRON_SECRET}` check and record a
liveness heartbeat (`lib/cron-heartbeat.ts`) even when disabled — "off" is an
owner choice, not an outage.
