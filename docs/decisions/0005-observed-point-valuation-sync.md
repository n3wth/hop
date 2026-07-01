# 0005. Observed point-valuation sync

Status: Accepted
Date: 2026-07-01

## Context

`lib/valuations.ts`'s `BASELINE_CPP` table is hand-curated: cents-per-point per loyalty program,
sourced from published community valuations (TPG, NerdWallet, Upgraded Points) and meant to be
"refreshed quarterly" by a human. It is the last genuinely static, manually-maintained economic
figure left in the product — everything else the engine touches (cash prices, award availability,
balances) is already live.

Getting AwardWallet's partner approval for live **personal balance sync** is unlikely to land. That
is a separate concern from valuations — AwardWallet syncs a user's own balance amounts, not what a
point is worth — but it prompted a broader look at what else in the product could be made to
autonomously self-update instead of waiting on a partner integration.

Three options were considered for keeping `BASELINE_CPP` current without a human in the loop:

- **(a) Scrape users' own loyalty program logins directly.** Rejected. This is exactly what
  AwardWallet exists to do safely and legally under partner agreements. Doing it ourselves means
  storing user credentials, handling MFA/CAPTCHAs per program, and likely violating airline/hotel
  ToS — and it can never be fully autonomous anyway, since it always needs the user's own
  credentials at least once.
- **(b) Scrape third-party published valuation guides** (e.g. TPG's monthly valuations page).
  Rejected. That is copyrighted editorial content; scraping it for a commercial product carries
  real ToS/copyright risk and is fragile against layout changes.
- **(c) Chosen — derive valuations from hop's own first-party data.** `lib/cpp.ts` already computes
  the real cash-vs-award cpp for every option on every live search via
  `lib/search.ts#assembleSearch`. This needs no credentials, scrapes no one else's property, and
  gets *more* accurate as search volume grows.

## Decision

hop instruments `assembleSearch` to emit each computed award option's real cpp as an "observation"
(`lib/valuation-telemetry.ts#recordCppObservations`), fire-and-forget, to a Cloudflare Worker
(`cloudflare/valuations-worker/`) that appends observations to a D1 table. On a Cron Trigger the
Worker aggregates a trimmed-mean cpp per program, gated on a minimum sample size and damped against
single-cycle swings. A Vercel cron (`app/api/cron/valuation-sync/route.ts`) periodically pulls that
aggregate, validates and clamps it, and mirrors it into a Supabase table
(`lib/valuation-overrides.ts`). `lib/valuations-live.ts` merges this on top of the **unchanged**
static baseline in `lib/valuations.ts`, only trusting an override once it has enough samples
(`MIN_SAMPLES_TO_TRUST`) and is fresh enough (`OVERRIDE_FRESHNESS_DAYS`) — degrading completely back
to the static table on any failure, at any stage.

The whole pipeline is flag-gated (`HOP_ENABLE_VALUATION_SYNC`, via `lib/env.ts#isValuationSyncEnabled`)
and is a no-op until the Worker is deployed and its secrets are configured — it ships
inert-but-safe today, the same posture as the Gmail-history and native-checkout seams.
`lib/valuations.ts` itself is not modified: its "pure, no top-level I/O" contract and its asserted
test suite (`lib/__tests__/valuations.test.ts`) are untouched. All new dynamic behavior lives in the
new files layered on top of it.

## Consequences

- The static baseline in `lib/valuations.ts` stops being the *only* source of truth for a point's
  value and becomes the permanent floor/fallback instead — every merge path still resolves to it
  when live data is missing, stale, or under-sampled.
- A new operational dependency exists: the Cloudflare Worker and its D1 database (already
  provisioned — `hop-valuations`, id `d26989d0-b0e1-42bc-87ba-859424f6f5b9`) need one manual deploy
  + secret step, documented in `cloudflare/valuations-worker/README.md`, before any of this does
  anything.
- A natural follow-up — **not built in this change** — is doing the same thing for transfer-partner
  bonus tracking (`lib/transfers.ts`), since bonus availability is also public, first-party-observable
  data.
- `degradation-reviewer` and `engine-invariant-reviewer` cover this seam going forward: no LLM ever
  computes or invents the observed numbers here, it only narrates them once they've cleared the
  trust gate — unchanged from ADR 0002.
