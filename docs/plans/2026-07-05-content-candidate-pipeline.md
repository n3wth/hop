# AI-sourced sweet-spot candidate pipeline

## Decisions (final — resolves the open questions below)

1. **Origin hub set**: ship the proposed `SFO, JFK, ORD, LAX` as designed —
   revisit once a data-driven hub list (real search-log volume) is cheap to
   query.
2. **Rotation window**: ship the proposed daily rotation as designed (8
   destinations/run, full sweep every ~4-5 days over the ~30-destination
   list) — watch upstream call volume for a week, adjust if needed.
3. **Auto-approve threshold**: none in v1. Every auto-sourced candidate
   lands `pending_review` — this is a hard invariant, not a tunable: no
   candidate, however high-confidence, ever skips human review.

Implemented in `lib/sweet-spot-candidates.ts` + `app/api/cron/sweet-spot-candidates/route.ts`,
gated behind `HOP_ENABLE_CONTENT_CANDIDATES` (`lib/env.ts#isContentCandidatesEnabled`).

## 1. Current state (evidence)

- `components/admin/ContentConsole.tsx` + `lib/sweet-spot-drafts.ts`: owner types route/program/
  cabin/miles by hand into `NewDraftForm`; `draftSweetSpotWhy()` (gated by `AI_GATEWAY_API_KEY`,
  `lib/ai-gateway.ts#callGatewayText`) only ever writes the "why" prose, never a number
  (`SWEET_SPOT_WHY_SYSTEM_PROMPT` hard-forbids it; regression-tested in
  `lib/__tests__/sweet-spot-drafts.test.ts`). The queue never fills itself — Oliver's actual
  complaint.
- `lib/valuation-telemetry.ts#recordCppObservations`, called from `lib/search.ts:278` on every
  live `assembleSearch`, reports `{programId, cpp, cashCents, miles}` — **program-level only, no
  route**. The Cloudflare Worker (`cloudflare/valuations-worker/`) stores these in D1
  `observations` (no route/cabin column) and aggregates to `valuation_snapshot` keyed by
  `program_id` alone; `hop_valuation_overrides` (Neon) mirrors that same shape. **Confirmed: no
  route-level observation exists anywhere today.** That pipeline is also the one flagged elsewhere
  as currently broken and is fully inert until the Worker is deployed and
  `HOP_ENABLE_VALUATION_SYNC`+secrets are set (ADR 0005) — building on top of it would inherit that
  outage and a cold-start problem (queue fills only once healthy AND enough real searches hit a
  given route), the opposite of "fills itself with timely new content."
- `assembleSearch(params, userBalances?, prefs?)` (`lib/search.ts:60`) already runs **stateless**:
  `userBalances` is optional and MCP tools (`lib/mcp-tools.ts:94-105`) call it today with `[]` for
  "generic, no-balance" pricing; `cpp()` (`lib/cpp.ts:3`) is pure arithmetic over cash/taxes/miles.
  So a cron can call the same trusted engine functions, for a curated route list, with no live
  user.
- `lib/destinations.ts` is a curated ~30-city dataset (IATA code, region, `bestProgram`), no origin
  field. `lib/sweet-spots.ts`'s `route` values are region strings ("US ↔ Japan"), not airport
  pairs — draft rows accept whatever route string the creator supplies, so "SFO → NRT" is equally
  valid.
- Cron pattern: `vercel.json` + `lib/health-checks.ts#CRON_JOBS` must stay in lockstep (a vitest
  asserts it). `lib/cron-auth.ts#isAuthorizedCron` gates every cron route;
  `lib/cron-heartbeat.ts#recordHeartbeat` fires (ungated) at the end of every run.
  `app/api/cron/valuation-sync/route.ts` is the template: `force-dynamic`, flag → 503, auth → 401,
  degrade-to-200 on upstream failure, heartbeat both paths.
- `app/actions/admin.ts` + `lib/owner.ts`: every content-console mutation is an owner-gated
  server action, `{ok:false}` never throws.

## 2. Data source decision

**Mine `assembleSearch`/`searchAwards` directly for a curated route list — do not extend the
Cloudflare Worker.** The Worker path was considered (add a `route` column to `observations`, a new
`/candidates` endpoint, worker-side aggregation) and rejected: it doubles the runtimes touched, it
depends on a sibling seam that's currently down, and even fixed it can't produce a candidate until
real user traffic accumulates on that exact route — contradicting "the queue should fill itself
with timely new content." Direct engine mining produces candidates on the **first cron run**, with
no dependency on Worker health or search volume, and stays entirely inside the already-trusted
`lib/*` engine (arguably *more* aligned with the compute-never-generate invariant, since the number
comes straight from a real `cpp()` calculation for that exact route).

Concretely: a new module calls `assembleSearch()` (see below — the funnel itself, not raw
primitives) for `{origin} × {destination from lib/destinations.ts} × cabin: 'Business'` over a
small curated **origin hub set** (e.g. `SFO, JFK, ORD, LAX` — 4 major hubs already implicit in
"typical award from the US" language in `destinations.ts`) and a near-future date window (e.g. next
30-60 days, a few sampled dates to dodge single-day availability gaps). **Business only, not
First**: `lib/seatsaero.ts`'s cabin mapping (`requestedCabinKey`, `CABIN_LABEL`) only emits
Y/W/J → Economy/Premium Economy/Business — there is no First-class cabin in a normalized award
option today, so scanning for `'first'` would silently fall through to business-labeled data
(`lib/seatsaero.ts:126-136`). Adding real First support is a separate, larger change to the
seats.aero client and out of scope here; note it as a future expansion once that client change
lands. Bound: ~30 destinations × 4 hubs × 1 cabin × ~3 sample dates = ~360 raw queries/day if run
naively — still too many. Cap it: rotate a slice of destinations per run (e.g. 6-8 per day,
cycling through the full list over ~4-5 days) so daily volume stays in the low hundreds, well
inside Duffel/Seats.aero's existing rate/cost profile (same APIs the live app already calls per
user search).

**Persistence-with-retention, satisfied without touching the Worker:** `hop_sweet_spot_drafts`
already records `route + program_slug + cabin (+status, created_at, reviewed_at)` for every draft
ever created, in any status — that's the dedup history, with retention already implicit (rows are
cheap, never pruned, and old rejections still block re-suggesting the same combo). No new raw
observation table is needed for v1.

**Deferred, not built:** passive route-level mining via the Worker (extending `observations` with
`route`/`cabin`, a `/candidates` endpoint, Worker-side aggregation) — worth doing once
valuation-sync is confirmed healthy, as a second signal layered on top of this one (mirrors ADR
0005's own deferral of transfer-bonus tracking). One-line follow-up in `docs/content-plan.md`, not
built now.

**Use `assembleSearch` itself, not raw `searchAwards`/`lib/cpp.ts` primitives — with telemetry
suppressed.** CLAUDE.md is explicit that `assembleSearch` is the one funnel every number should go
through (party-scaling, best-per-program collapse, degraded-source handling); reimplementing that
join in a second module would fight the "engine is the moat" ADR. Its one side effect,
`recordCppObservations()` (`lib/search.ts:278`), would inject synthetic scan volume into the
program-level valuation telemetry once valuation-sync is healthy again — so give `assembleSearch` a
4th, optional `opts?: { recordTelemetry?: boolean }` (default `true`, every existing call site
unaffected) and gate the existing call on it. Candidate-mining calls
`assembleSearch(params, [], undefined, { recordTelemetry: false })`. ~3-line change, in §4.

**Program coverage is narrower than the seatsaero universe — an accepted v1 limit.**
`createSweetSpotDraft()` hard-rejects any `programSlug` not already in `sweetSpotsByProgram()`
(`lib/sweet-spot-drafts.ts:156`), and today that static table has only **6** distinct slugs:
`virgin-atlantic`, `alaska-atmos`, `aeroplan`, `turkish`, `lifemiles`, `avios`. Seatsaero surfaces
~15 programs whose slugs (`lib/seatsaero.ts#PROGRAM_META`) and `canonicalizeProgram()`-resolved ids
(`lib/programs.ts`, e.g. `alaska`, `avios-ba`) are both **different spellings** from the
sweet-spots page slugs, and there's no existing function bridging the two. The plan adds a small,
hand-maintained `PROGRAM_ID_TO_SWEET_SPOT_SLUG` map (§4) covering only the overlap; any mined
program outside it (United, Delta, etc. — no sweet-spots page today) is silently dropped, matching
the existing owner-typed flow's own rule ("never creates a brand-new program page"). Coverage is
genuinely narrow (6 programs) and grows automatically as `lib/sweet-spots.ts` gains programs.

## 3. Candidate ranking (notability)

For each `{route, program, cabin}` combination priced:
- Compute `cpp = (cashPrice - taxes) * 100 / miles` via the existing `lib/cpp.ts#cpp()` — never a
  new formula.
- Baseline = `lib/valuations.ts` static `BASELINE_CPP` for that program (never the live override —
  keep this seam independent of the Worker entirely, including its degraded state).
- Notable if: `cpp >= POINTS_THRESHOLD_CPP` (2.5, `lib/cpp.ts`'s existing bar) **and**
  `cpp >= baseline * 1.3` (30% above the program's typical value — a fixed, documented constant
  next to the module, same style as `VALUATION_DRIFT_THRESHOLD` in `lib/health-checks.ts`).
- Dedup: skip any `{route, programSlug, cabin}` that already has a row in
  `hop_sweet_spot_drafts` in **any** status (pending/approved/rejected) — the owner already saw
  it — and skip any combo already present in the static `lib/sweet-spots.ts` seed table.
- Rank survivors by `cpp / baseline` descending; cap to `MAX_NEW_CANDIDATES_PER_RUN = 3` (mirrors
  `lib/health-checks.ts`'s `MAX_ISSUES_PER_RUN`) so the queue grows reviewably, not in a flood.

## 4. File-by-file changes

- **`lib/search.ts`** — add a 4th, optional parameter to `assembleSearch(params, userBalances?,
  prefs?, opts?: { recordTelemetry?: boolean })`, defaulting `recordTelemetry` to `true` so every
  existing call site is unaffected; gate the `recordCppObservations(...)` call (line ~278) on it.
  ~3-line change, covered by a new test asserting `recordTelemetry: false` suppresses the call
  (spy/mock `lib/valuation-telemetry.ts`) while the default path still fires it. Implementation
  note: the same flag also gates the degradation-incident telemetry block
  (`recordDegradation`/`captureServerEvent`) a few lines below — a burst of mining calls hitting a
  rate-limited upstream must not read as a live-traffic spike to the health sentinel's D2 detector.
- **`lib/sweet-spot-candidates.ts`** (new) — `findSweetSpotCandidates()` orchestrates the curated
  route/hub/date loop, calling `assembleSearch(params, [], undefined, { recordTelemetry: false })`
  per combo (the real funnel, not reimplemented primitives — §2). For each award option, resolves
  its program via `canonicalizeProgram()` then the hand-maintained `PROGRAM_ID_TO_SWEET_SPOT_SLUG`
  map (§2) and **drops** any candidate outside it. Scores survivors for notability (§3), dedups
  against `listSweetSpotDrafts()` (all statuses) + the static `lib/sweet-spots.ts` table, returns a
  ranked, capped list of `{route, programSlug, program, cabin, milesOw, milesLabel, notes}` —
  `notes` is a **deterministic string** ("Observed ~4.1¢/pt over N sampled dates vs ~2.0¢/pt
  typical for this program"), never LLM text, feeding `draftSweetSpotWhy()`'s existing "restate
  verbatim, never compute" contract unchanged. Exports the rotation window, notability constants,
  and the slug map so tests assert on them directly (mirrors `SWEET_SPOT_WHY_SYSTEM_PROMPT`).
  Also exports `createCandidateDrafts()`: for each candidate, calls the existing (unchanged)
  `createSweetSpotDraft()` with `createdBy: 'auto:content-candidates'` (sentinel, not an owner
  email) then `draftSweetSpotWhy()` + `updateSweetSpotDraftWhy()` to fill the why-line, leaving it
  `pending_review` — never auto-approves. NEVER throws (same withDb/try-catch discipline as every
  lib module here). Only rows actually labeled `cabin === 'Business'` on the returned award option
  are scored — `lib/seatsaero.ts#pickCabin`'s availability fallback can hand back an
  Economy/Premium-Economy row even when Business was requested, and that must never be scored as a
  Business redemption.
- **`lib/env.ts`** — add `isContentCandidatesEnabled()`: explicit flag
  (`HOP_ENABLE_CONTENT_CANDIDATES`) **and** `hasEnv('SEATS_AERO_API_KEY')` **and**
  `hasEnv('DUFFEL_API_KEY_LIVE')` (the live cash-search key, `env.duffelApiKey()` —
  `lib/env.ts:100` — distinct from `DUFFEL_API_KEY_TEST`, which only gates the checkout sandbox
  path) — deliberately independent of `isValuationSyncEnabled()`/the Worker.
- **`app/api/cron/sweet-spot-candidates/route.ts`** (new) — mirrors
  `app/api/cron/valuation-sync/route.ts`'s shape exactly: `force-dynamic`, flag-off → 503 +
  heartbeat(false, 'disabled'), unauthorized → 401, else run `findSweetSpotCandidates()` +
  `createCandidateDrafts()`, `revalidatePath('/admin/content')`, heartbeat(true, `created:N
  skipped:M`), 200 always (degrade to `{ok:true, created:0}` on any upstream pricing failure —
  never 500).
- **`vercel.json`** — add `{ "path": "/api/cron/sweet-spot-candidates", "schedule": "0 12 * * *" }`
  (once daily, off-peak from the other crons).
- **`lib/health-checks.ts`** — add `'sweet-spot-candidates'` to the `CronJob` union and a
  `CRON_JOBS` entry (path/schedule matching vercel.json exactly, `expectedIntervalMs: DAY_MS`) —
  required or `lib/__tests__/health-checks.test.ts`'s lockstep assertion fails.
- **`app/actions/admin.ts`** — add `findSweetSpotCandidatesAction()`: owner-gated, calls the same
  `findSweetSpotCandidates()` + `createCandidateDrafts()` on demand (the "find candidates now"
  button), returns `{ok, created}`.
- **`components/admin/ContentConsole.tsx`** — add a small "Find candidates now" button near the
  queue header (disabled while running, shows "Found N" / error inline, same `GHOST_BTN` style);
  tag cards where `draft.createdBy === 'auto:content-candidates'` with a small "Auto-found" badge
  next to the existing "Soft figure" confidence badge, so the owner can tell provenance at a
  glance.
- **`.env.example`** — document `HOP_ENABLE_CONTENT_CANDIDATES` next to the other `HOP_ENABLE_*`
  lines, one-line comment naming its real dependency (`SEATS_AERO_API_KEY` + cash pricing key).
- **`docs/content-plan.md`** — one-paragraph note under §2 that the sweet-spots table now also
  grows via an automated candidate pipeline (§ cross-ref to the new module), and a one-line
  "deferred: Worker-based passive route mining" follow-up per §2 above.

No schema/migration changes — `hop_sweet_spot_drafts` already has every column this needs
(`createdBy` is free-text, no enum to widen).

## 5. Test plan (`lib/__tests__/sweet-spot-candidates.test.ts`, new)

- Notability scoring is pure: synthetic `{cpp, baseline}` pairs assert the 2.5-floor AND
  1.3x-baseline gate independently near the boundary (both required).
- `PROGRAM_ID_TO_SWEET_SPOT_SLUG`: every value is a real `allPrograms()` slug; a mined program
  absent from the map (e.g. `united`) is dropped, never passed through with a guessed slug.
- `lib/search.ts`: `assembleSearch(params, [], undefined, { recordTelemetry: false })` does not
  call `recordCppObservations` (spy on `lib/valuation-telemetry.ts`), while existing no-4th-arg
  call sites still do — regression guard for "every existing call site unaffected" (§2/§4).
- Dedup: a fake `listSweetSpotDrafts()` list covering pending/approved/rejected for one combo is
  excluded regardless of status; a combo already in `lib/sweet-spots.ts`'s static table is excluded
  even with zero drafts.
- Cap: feed more than `MAX_NEW_CANDIDATES_PER_RUN` notable candidates, assert only the top-N by
  `cpp/baseline` survive, in order.
- Degrade-safe: stub pricing to reject/`{ok:false}` — `findSweetSpotCandidates()` resolves to `[]`,
  never throws (same pattern as `sweet-spot-drafts.test.ts`'s gateway-key handling: unset keys,
  assert clean resolution — no live network calls in the test).
- `createCandidateDrafts()` with no db configured (test-env default): resolves without throwing,
  produces no drafts (mirrors `sweet-spots-live.test.ts`'s "down db → static-only" pattern).
- `isContentCandidatesEnabled()`: table-test the double-lock (flag alone insufficient, keys alone
  insufficient, both required), mirroring `isCheckoutEnabled()`'s test shape.
- `health-checks.test.ts`: no new test needed — its existing lockstep assertion covers the new
  `CRON_JOBS` entry automatically once added.

## 6. Flag strategy

`HOP_ENABLE_CONTENT_CANDIDATES` — off by default, ships inert. Requires
`SEATS_AERO_API_KEY` + the live Duffel cash key already required for real search (no new secrets to
provision — this reuses exactly the upstream credentials the product already needs for `/search` to
work live). Independent of `HOP_ENABLE_VALUATION_SYNC` by design (§2). The cron route and the
"find candidates now" action both check the same flag function, so enabling/disabling is a single
toggle with no drift between the two entry points.

## Open questions (max 3) — resolved, see Decisions above

1. **Origin hub set** — is `SFO, JFK, ORD, LAX` the right curated set, or should it read from
   somewhere more authoritative (e.g. the airports most represented in real user search history,
   once that's queryable)? Proposed: hardcode the 4 for v1, revisit once `hop_travel_history` or
   search-log data makes a data-driven hub list cheap.
2. **Rotation window** — cycling ~6-8 of ~30 destinations per day (full sweep every 4-5 days) is a
   guess at balancing "timely" against upstream call volume/cost; no real cost data exists yet to
   tune it precisely. Proposed: ship the guess, watch Duffel/Seats.aero usage for a week, adjust.
3. **Auto-approve threshold** — should an exceptionally high-confidence candidate (e.g. cpp > 2x
   baseline with many sample dates agreeing) ever skip straight to `approved`, or does every
   auto-sourced row stay `pending_review` forever, no matter how strong? Proposed for v1: always
   `pending_review` — never auto-publish an LLM-touched row without a human look, full stop.
