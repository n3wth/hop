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

## Current production state (2026-07-04)

| Capability | State |
| --- | --- |
| Self-improve loop (`HOP_ENABLE_SELF_IMPROVE`) | **ON — just enabled.** Degradation telemetry is recording (cash degraded 4x in the last 24h) but with **no recorded reasons** — `recordDegradation()` doesn't capture a reason yet; being fixed in a parallel branch. |
| Linear filing (`LINEAR_API_KEY` + `LINEAR_TEAM_ID`) | **NOT set.** This is the missing link for auto-filed issues: the sentinel detects and records findings, but P1s fall back to the owner email and nothing lands in Linear. |
| Valuation sync (`HOP_ENABLE_VALUATION_SYNC`) | **OFF — worker NOT deployed.** `cloudflare/valuations-worker/` has never been deployed; the whole seam is inert. |
| Standing-order alerts | Cron wired in `vercel.json`; delivery depends on `RESEND_API_KEY` + verified DKIM (see below). |
| Billing / checkout | Off (flags unset). |

## Alerts / standing orders

The "verdict that watches" — `/api/cron/standing-orders` (every 6h, `vercel.json`)
re-runs `assembleSearch` per active watch and records + emails crossings.

**Turn on:**

1. `STANDING_ORDERS_CRON_ENABLED=1` — the route is `503 disabled` until truthy.
2. `CRON_SECRET=<random>` — Vercel Cron sends it as `Authorization: Bearer`;
   **unset means any caller can hit every cron route**, so always set it in prod.
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
aliases win when set). Point a Stripe webhook at `/api/billing/webhook`.
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
