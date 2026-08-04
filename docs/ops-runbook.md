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
| Gmail travel-history (`HOP_ENABLE_GMAIL_HISTORY`) | **OFF.** Code + UI are complete but un-provisioned — no `GOOGLE_OAUTH_CLIENT_ID/SECRET` set, and `gmail.readonly` is a Google restricted scope requiring OAuth verification before wide rollout (owner-only testing until then). See the Gmail section below. |
| `MOCK` | Removed from production env (live upstreams). |
| GitHub Actions CI | **Disabled** (billing broken — see the CI section below). Required PR check is the Vercel build. |
| Newsletter digest (`HOP_ENABLE_NEWSLETTER`) | Flag-gated, off by default — needs the flag + `RESEND_API_KEY`; sends real weekly emails to subscribers (`lib/email.ts#sendWeeklyDigestEmail`) once on. Check `/admin/ops` for current state before assuming either way. |
| Share receipts (`HOP_ENABLE_SHARE_RECEIPTS`) | Flag-gated, off by default. Check `/admin/ops` for current state before assuming either way. |
| Team view live PRs (`GITHUB_TOKEN`) | **OFF** (unset). `/admin/team` renders fully without it; a read-only PAT ("Pull requests: read") lights up each agent's open-PR list. |

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

## Email sender branding (BIMI)

BIMI (Brand Indicators for Message Identification) shows a logo next to hop's
sender name in a recipient's inbox. It's discovered by the mailbox provider at
`default._bimi.<domain-in-the-From-header>`, so it only ever applies to the
exact domain a message's `RFC5322.From` uses — **not** any domain sends merely
pass through (SPF/Return-Path, DKIM signing host, etc.).

**What's live now:**

- All Resend-sent mail (`lib/email.ts` — alerts, the business digest, support
  replies, auth verification/reset) sends From `@hop.flights`
  (`fromAddress()` / `supportFromAddress()`), and DKIM signs with
  `d=hop.flights` (`resend._domainkey.hop.flights`). **`hop.flights` — the
  apex, not `send.hop.flights`** — is therefore the correct BIMI domain: it
  already has `_dmarc.hop.flights` at `p=reject; adkim=s; aspf=s`, which is
  enforcing and DKIM-aligned (SPF doesn't align under `aspf=s` since Resend's
  envelope/Return-Path domain is `send.hop.flights`, the SES custom
  MAIL FROM — but DKIM alignment alone satisfies DMARC and BIMI's
  precondition). `send.hop.flights` never appears in a From header, so a BIMI
  record there would be inert — it is **not** used.
- The logo: `public/bimi-logo.svg` — hop's bunny mark on the brand teal
  (`#0d6e6e` background, `#f3f1ec` bunny), full-bleed square, single silhouette
  path kept inside the safe zone so a circular or rounded-square crop never
  clips it (same treatment as `app/maskable-icon.tsx`). Authored directly to
  the SVG Tiny PS profile BIMI requires (`version="1.2"
  baseProfile="tiny-ps"`, no scripts/CSS/external refs/raster images, no
  `x`/`y` on the root `<svg>`, `<title>`/`<desc>` present, ~2.3 KB, well under
  the 32 KB cap). It validates as well-formed XML (`xmllint`); a full
  Tiny-PS-profile validator (e.g. the BIMI Group RNC schema, or a tool like
  sequenzy's/powerdmarc's BIMI SVG validator) needs a browser or `jing`,
  neither available in this environment — **run one before or right after
  deploy** to catch anything this can't check.
- DNS: `default._bimi.hop.flights TXT "v=BIMI1;
  l=https://hop.flights/bimi-logo.svg;"` is live in Cloudflare (no `a=` tag —
  no VMC exists). The `l=` URL 404s until this PR's `public/bimi-logo.svg`
  deploys; harmless in the meantime (BIMI just won't validate — mail delivery
  is untouched since DMARC enforcement doesn't depend on BIMI).

**What shows where, right now (no VMC):**

| Client | Shows the bunny? |
| --- | --- |
| Yahoo / AOL | Yes — these render a BIMI logo off DMARC + the SVG alone. |
| Gmail | **No.** Gmail additionally requires a **Verified Mark Certificate** (VMC) — see below. |
| Outlook, Apple Mail | No native BIMI support as of this writing; unaffected either way. |

**To unlock Gmail: buy a VMC.** [Founder decision — ~$1500+/yr, some CAs
require a registered trademark on the mark being certified.] A VMC is issued
by an authorized CA (DigiCert, Entrust) after verifying trademark ownership,
and its certificate URL goes in the DNS record's `a=` tag. Not pursued in this
PR — no money spent, nothing implies one was purchased.

**Not covered by this (follow-up if wanted):** Elizabeth's finance desk sends
from AgentMail (`finance-hop@agentmail.to`, eventually `agents.hop.flights`),
a separate domain from `hop.flights` with its own DNS/DMARC — BIMI there would
need its own from-scratch setup (logo record + DMARC enforcement on that
domain) and can't be configured from this repo. Two options if it's ever
prioritized:
1. Real BIMI on `agents.hop.flights` once that domain exists and has DMARC
   enforcement — same recipe as above.
2. A free, low-effort partial fallback: some mail clients show a
   [Gravatar](https://gravatar.com) image keyed to the sender address's email
   hash even without BIMI. Creating a Gravatar account for
   `finance-hop@agentmail.to` and uploading the bunny mark is a ~2-minute
   founder to-do (needs an actual login to Gravatar — not scriptable from
   here) with no guarantee of coverage, since support for this varies by
   client and isn't a formal standard the way BIMI is.

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

**Rotating `HOP_VALUATION_SYNC_SECRET` (or any paired Worker secret —
`HOP_BALANCE_INGEST_SECRET`, `HOP_SUPPORT_INGEST_SECRET`):** update the Worker
side (`wrangler secret put`) **and** the Vercel side to the identical value
**and** verify end-to-end in the same sitting — don't wait for the next
scheduled cron to discover a mismatch. A stale secret on either side doesn't
fail at rotation time; it fails silently as a generic `worker-unreachable` at
the next run (see `docs/solutions/2026-07-05-paired-secret-rotation.md`).

## Content candidate pipeline (`docs/plans/2026-07-05-content-candidate-pipeline.md`)

Mines `assembleSearch` directly (not the valuation Worker) over a curated
4-hub × rotating-destination × sampled-date grid for notable Business-cabin
award redemptions, and drops up to 3/run into the existing
`hop_sweet_spot_drafts` review queue as `pending_review` — never
auto-approved. Deliberately independent of valuation sync/the Worker.

**Turn on:** `HOP_ENABLE_CONTENT_CANDIDATES=1` — no new secret; it reuses the
live pricing keys `/search` already needs (`SEATS_AERO_API_KEY` +
`DUFFEL_API_KEY_LIVE`). Off → `/api/cron/sweet-spot-candidates` answers
`503 disabled` and the owner's "Find candidates now" button
(`/admin/content`) refuses softly.

**Turn off:** unset `HOP_ENABLE_CONTENT_CANDIDATES`. Existing drafts are
unaffected; the queue just stops filling itself.

**Verify:** hit `/api/cron/sweet-spot-candidates` with the cron bearer, or
click "Find candidates now" as the owner; check `/admin/content` for new rows
tagged "Auto-found".

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

## Gmail travel-history

Optional consent-based seam: connect Gmail on `/account` and hop reads ONLY
travel-confirmation emails (`lib/gmail.ts` `CONFIRMATION_QUERY` — subject
keywords + a curated airline/hotel/OTA domain list, `newer_than:3y`), parses
them into normalized trip facts (`lib/gmail-parser.ts`), and stores ONLY those
facts — never raw email bodies — in `hop_travel_history`. The concierge cites
the derived patterns (usual travel months, favorite regions, typical cabin).
Code, routes, UI, and privacy copy are all already built and tested
(`lib/__tests__/gmail-parser.test.ts`, `lib/__tests__/travel-history.test.ts`,
`lib/__tests__/travel-history-sync.test.ts`); the seam is gated **off**.

**Before turning on for anyone but the owner:** `gmail.readonly` is a Google
**restricted scope**. Real external users require Google OAuth app
verification (domain/brand verification, a scope-justification writeup, a demo
video, and — depending on user count/data sensitivity — an annual CASA
security assessment) before the consent screen stops showing an "unverified
app" warning and refresh tokens survive past ~7 days. This is a weeks-to-months
Google-side review, not a Vercel env-var flip. Confirm in Google Cloud Console:
(1) the OAuth client's publishing status (Testing vs. In production — Testing
means every connected user's refresh token dies after ~7 days) and (2) the
intended audience (owner-only vs. all signed-in users), before committing to a
rollout date. Until verification is done, keep the flag off for everyone but a
small owner/test-user list added to the OAuth client in Testing mode.

**Turn on:**

1. Register a **separate** OAuth client in Google Cloud Console scoped to
   `gmail.readonly` + `userinfo.email` only — deliberately distinct from the
   Better Auth sign-in client (`GOOGLE_CLIENT_ID/SECRET` / `GOOGLE_ID/SECRET`),
   so sign-in never carries a Gmail-read grant.
2. Add `{APP_BASE_URL}/auth/gmail/callback` as an authorized redirect URI on
   that client. If the client stays in "Testing" mode, add each test user's
   Google account under "Test users" on the consent screen (required — Testing
   clients reject anyone not on that list).
3. Set `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` in Vercel
   (Production) — the seam stays off until the flag is also set.
4. Set `HOP_ENABLE_GMAIL_HISTORY=1`. The "Connect Gmail" affordance appears on
   `/account` and the `/ask` hero/A2UI block drop their "Soon" pill.

**Turn off:** unset `HOP_ENABLE_GMAIL_HISTORY` (or either `GOOGLE_OAUTH_*`
var). `isGmailHistoryEnabled()` requires both the flag AND both credentials, so
any one missing reverts every surface to the "coming soon" state —
`getTravelHistory` degrades to the not-connected empty history, the OAuth
start route redirects to `/account?gmail=unconfigured`. Already-connected rows
are untouched (no data loss); they simply stop syncing until re-enabled.

**Staleness:** a dead/revoked refresh token (7-day Testing-mode expiry,
explicit revocation from the user's Google Account, or a failed Gmail API
call) is detected on the next sync attempt and stamped as `syncFailedAt`
inside the row's `trips` jsonb (no schema migration — an additive field on the
existing payload). `/account` then shows "Reconnect needed" instead of a
falsely-eternal "Connected", with a one-click reconnect (re-consent mints a
fresh refresh token). Re-sync is manual-only today (the "Sync" button /
initial connect) — there is no cron; a stale connection is only caught the
next time the user opens `/account` or hits Sync.

**Verify:** with credentials + flag set, `npm run dev` → `/account` → Connect
Gmail → OAuth consent (as a test user, if the client is in Testing mode) →
redirected back with trips parsed → Sync re-reads → Disconnect deletes the row
and revokes the token upstream.

## Credential auto-sync (hop signs in and reads your balance)

Credential-based rail on top of paste/forward (`docs/plans/2026-07-05-credential-sync.md`):
the user stores a program login, a daily cron signs in via Cloudflare Browser
Rendering and reads the balance through the same extraction clamp. **Honest by
design** — only programs with a verified recipe sync; everything else shows
`unsupported`, and each login carries a truthful `pending/ok/failed/unsupported`
status. Paste/forward stay the always-works fallback.

**Turn on the vault (storage only):** generate a key `openssl rand -hex 32`,
set `HOP_CREDENTIAL_KEY=<that>` and `HOP_ENABLE_CREDENTIAL_SYNC=1` in Vercel.
Users can now save logins; they sit `pending` until the fetch worker is live.

**Turn on scheduled fetch (worker):**

1. Enable Browser Rendering on the Cloudflare account. Deploy the worker:
   `cd cloudflare/balance-fetch-worker && npm install`, `openssl rand -hex 32`,
   `wrangler secret put HOP_BALANCE_FETCH_SECRET`, `npm run deploy`.
2. In Vercel: `HOP_BALANCE_FETCH_WORKER_URL=<workers.dev URL, no trailing slash>`
   and `HOP_BALANCE_FETCH_SECRET=<the SAME value>`.
3. Add verified `RECIPES` entries in the worker per program (empty by default —
   nothing syncs until a recipe exists and is tested live). In the SAME change,
   add the program's canonical id to `RECIPE_SUPPORTED_PROGRAMS` in
   `lib/credential-vault.ts` — otherwise rows already stamped `unsupported`
   for that program stay excluded forever instead of retrying.

**Turn off:** unset `HOP_ENABLE_CREDENTIAL_SYNC`. The affordance disappears,
credential actions refuse softly, and `/api/cron/balance-autosync` answers
`503 disabled`. Stored blobs are unreadable without the key.

**Key rotation:** rotating `HOP_CREDENTIAL_KEY` makes existing blobs
undecryptable → those logins flip to `failed` ("re-save the login") on next
sync. Rotate only deliberately; there is no re-encryption path by design.

**Verify:** save a login on `/account`; run `/api/cron/balance-autosync` with
the cron bearer; the row's status moves to `ok` (recipe exists) or a truthful
`failed`/`unsupported`.

## AwardWallet (live balance auto-sync)

Optional auto-sync on top of manual balances (`lib/awardwallet.ts`,
`lib/accounts.ts`). `getUserBalances()` never calls AwardWallet live — every
read is a `hop_user_accounts.cached_balances` snapshot, refreshed only by
connect-time bootstrap, the `/account` "Refresh" button, and the periodic
cron below. This split (cache read vs. the three write paths) is deliberate:
a dead AwardWallet link degrades to the last-known-good snapshot with an
honest staleness note, instead of a live call blocking a page render.

**Engineering-owned, ready to flip:**

1. `AWARDWALLET_API_KEY` + `AWARDWALLET_USER_ID` (business-account
   credentials) — already required for the manual-ID connect path
   (`ProgramsManager`'s "Advanced: paste a connected-user ID") to do anything.
2. `AWARDWALLET_SYNC_CRON_ENABLED=1` — gates `/api/cron/awardwallet-sync`
   (every 6h, offset from `standing-orders`). **Not required** for balances to
   populate: bootstrap-on-connect and manual Refresh both call
   `refreshAwCache` directly, so the cache works before this flag is ever
   set — flip it once `npm run check`/`build` are green and Refresh has been
   exercised against a real connected account.

**Turn off:** unset `AWARDWALLET_SYNC_CRON_ENABLED`. The cron answers
`503 disabled`; bootstrap and manual Refresh keep working (a byte-for-byte
no-op otherwise).

**Owner-blocked (do not attempt without AwardWallet business-dashboard
access):**

- `AWARDWALLET_CONNECT_URL` — the hosted "Connect Users" URL for the OAuth-
  style connect flow (`app/auth/awardwallet/start|callback`). Absent → the
  primary "Connect AwardWallet" CTA is a dead link; the manual-ID escape
  hatch still works regardless.
- The exact callback param name AwardWallet returns the connected-user id
  under — `app/auth/awardwallet/callback/route.ts` currently tries four
  plausible names (`userId`/`connectedUserId`/`connectedUser`/`id`).
  Confirm against the real dashboard before relying on the OAuth path.

**Verify:** connect via the manual-ID field on `/account` → balances and a
"synced <time>" note appear immediately (bootstrap). Click Refresh → the
synced time updates. `curl -H "Authorization: Bearer $CRON_SECRET"
https://hop.flights/api/cron/awardwallet-sync` returns a refreshed/failed
summary (or `{"ok":false,"disabled":true}` while the flag is off).

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

**Gate status (business-plan.md §3.1 — all four required before enabling billing):**
1. Multi-pax cpp fixed (R0.1) — **Passed**
2. Single tested Stripe lane with real purchase (R0.2) — **Passed**
3. Alerts firing reliably (R0.4 + R1.3) — **Passed**
4. seats.aero written commercial terms (R3.1) — **Pending / Blocked** (awaiting commercial response or fallback award source)

## Resend webhooks (deliverability / suppression list)

`app/api/webhooks/resend/route.ts` receives Resend's email-event webhook
(endpoint id `5ed0155c-869a-49f2-bf0b-e7594ba1ab57`, pointed at
`https://hop.flights/api/webhooks/resend`), subscribed to: `email.bounced`,
`email.complained`, `email.delivered`, `email.delivery_delayed`,
`email.opened`, `email.clicked`. Resend signs deliveries the Svix way
(`svix-id`/`svix-timestamp`/`svix-signature` headers), verified with the
`svix` package against `RESEND_WEBHOOK_SECRET` (a `whsec_…` secret — see
`lib/resend-webhook.ts`).

`email.bounced` / `email.complained` upsert the recipient into
`hop_email_suppressions` (`lib/email-suppressions.ts`) — this protects Resend
sending-domain reputation/deliverability: repeatedly sending to a bounced or
complained address risks the domain being throttled or suspended. Any future
outbound-mail path (alerts, newsletter) **must** call `isSuppressed(email)`
before sending; it fails OPEN (returns `false`) on a DB error so a transient
blip never silently blocks a real send.

`email.delivered` / `email.opened` / `email.clicked` / `email.delivery_delayed`
are logged only — no existing table is a cheap fit for per-message engagement
signals, and none is added speculatively. Persist them once there's a real
consumer.

**Missing `RESEND_WEBHOOK_SECRET`:** the route still exists (won't crash a
build/deploy) but logs a warning and 200-acks every delivery without
verifying or processing it — this is the dev/local state.

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

## Newsletter unsubscribe secret

The newsletter (`lib/newsletter.ts`) derives each subscriber's unsubscribe-link
token as `HMAC-SHA256(secret, email)` and stores only its hash — the plaintext
is recomputed from the email whenever a digest needs to embed it in a link,
never stored random. That means the secret has to keep producing the exact
same value for a given email for as long as any previously-sent unsubscribe
link might still be clicked, which is not a property the session-signing
secret can promise: `BETTER_AUTH_SECRET`/`AUTH_SECRET` gets rotated for
reasons that have nothing to do with the newsletter (see "Auth secret" above).

`NEWSLETTER_UNSUBSCRIBE_SECRET` (`lib/env.ts#resolveNewsletterUnsubscribeSecret`)
decouples the two:

- **Set** → rotating `BETTER_AUTH_SECRET`/`AUTH_SECRET` is safe for the
  newsletter. Every outstanding unsubscribe link keeps working across the
  rotation because its HMAC key never changed.
- **Not set** (the accessor falls back to `resolveAuthSecret()`'s own chain,
  so nothing breaks today with zero config) → rotating
  `BETTER_AUTH_SECRET`/`AUTH_SECRET` **will** silently invalidate every
  unsubscribe link already emailed to a real subscriber. The presented token
  no longer hashes to what's stored, `unsubscribeNewsletter()` reports a
  zero-row match and logs a `[newsletter] unsubscribe token matched zero
  rows…` warning, but the click still lands on the same "you're unsubscribed"
  confirmation page (by design — see the route's comment) with no user-facing
  signal that anything went wrong. Watch runtime logs for that warning after
  any auth-secret rotation if this var isn't set.

**Before this matters in practice:** the newsletter is gated off by default
(`isNewsletterEnabled()` needs both `HOP_ENABLE_NEWSLETTER` and
`RESEND_API_KEY`), so as of this writing there are no real subscribers and no
outstanding links. Set `NEWSLETTER_UNSUBSCRIBE_SECRET` before or shortly after
turning the newsletter on for real — it costs nothing (`openssl rand -hex 32`)
and is the difference between "rotate the auth secret whenever" and "rotating
the auth secret breaks every unsubscribe link that's already out in inboxes."

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
| `/api/cron/balance-autosync` | daily | `isCredentialAutosyncLive()` |
| `/api/cron/sweet-spot-candidates` | daily | `isContentCandidatesEnabled()` |
| `/api/cron/awardwallet-sync` | every 6h (offset from standing-orders) | `isAwardWalletSyncCronLive()` (`AWARDWALLET_SYNC_CRON_ENABLED`) |
| `/api/cron/newsletter-digest` | weekly (Mondays) | `isNewsletterEnabled()` (`HOP_ENABLE_NEWSLETTER` + `RESEND_API_KEY`) |

All honor the same `Authorization: Bearer ${CRON_SECRET}` check and record a
liveness heartbeat (`lib/cron-heartbeat.ts`) even when disabled — "off" is an
owner choice, not an outage.
