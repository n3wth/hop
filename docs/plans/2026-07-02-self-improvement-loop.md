# Self-improvement loop — closed loops that make hop better without the owner directing it

> Plan. Status: proposal.
> TL;DR: hop already has one true closed loop (the ADR 0005 valuation sync) and one half-loop (the
> weekly business digest — it *measures* but generates no work). This plan generalizes the pattern
> into a **health sentinel**: deterministic detectors over signals hop already computes (dead
> crons, stale committed datasets, upstream degradation spikes, flag/key drift, observed-vs-
> baseline valuation drift, watches that never fire), each detection becoming an **idempotent,
> fingerprinted finding**, filed as a **Linear issue with exact scope** for any agent to pick up,
> auto-resolved when the signal clears, and reported in the existing digest. The organizing
> principle (ADR 0007): **self-improvement signals are residuals of computations the engine
> already performs** — `degraded[]`, `evaluateOrder` reason codes, observed-vs-baseline cpp
> deltas, the digest's own week-over-week counts. No detector invents judgment. Phase 1 is
> LLM-free in the detect/file path, ships this week as three small sequential PRs, and is
> safe-by-construction: nothing merges, nothing pays, nothing touches a user row, every new seam
> is flag-gated and degrades to a no-op. Written failure-first: every component is specified by
> what happens when it breaks.

---

## 1. Requirements

Done means:

- [ ] **Instrument:** every `vercel.json` cron records a heartbeat (`hop_cron_heartbeats`) as a
  fire-and-forget act on each authorized invocation — after the work on success paths, so a
  fresh `ok` heartbeat means "ran to completion"; disabled runs record `ok:false, note:'disabled'`
  (being off is an owner choice, not an outage). `assembleSearch` records each non-empty
  `degraded[]` outcome (`hop_degradation_events`) — source + validated IATA route pair only,
  **never** a user id, balance, or free text. The mock path (`lib/search.ts:57`) never records.
  The standing-orders cron additionally tallies `evaluateOrder` reason codes per run
  (`no-redemption` / `below-cpp` / `program-ineligible` / `not-enough-seats` /
  `already-notified` — the codes at `lib/standing-orders-model.ts:238-261`) into its heartbeat
  note, so the "why" is on record with zero extra queries.
- [ ] **Detect:** a daily `/api/cron/health-sentinel` runs pure detectors over first-party
  signals: **D1** cron liveness (heartbeat older than 2× its nominal interval), **D2** upstream
  degradation spike (24h degraded count ≥ `max(SPIKE_MIN_EVENTS, SPIKE_FACTOR × prior-week daily
  mean)` per source), **D3** flag/key drift (a `HOP_ENABLE_*` flag on while a required key is
  missing — the "seam looks live but is silently inert" failure), **D4** committed-dataset
  staleness (`GENERATED_AT` stamps in `lib/place-facts.ts` / `lib/climate-normals.ts` older than
  `DATASET_STALE_DAYS`), **D5** valuation drift (`|override.cpp − baseline| / baseline >
  VALUATION_DRIFT_THRESHOLD`, only when `sampleSize ≥ MIN_SAMPLES_TO_TRUST` — ADR 0005's trust
  gate reused verbatim), and (PR 2) **D6** dead watches (active watches ≥ `WATCH_DEAD_DAYS` old
  with zero alerts in the window, counted — never listed). Every threshold is a named exported
  constant; no number is guessed.
- [ ] **Generate work:** each detection upserts a finding keyed by a stable **fingerprint**
  (`kind:subject`, e.g. `cron-dead:valuation-sync`, `valuation-drift:alaska`) into
  `hop_improvement_findings`, then files at most `MAX_ISSUES_PER_RUN = 3` new Linear issues per
  run from deterministic templates (symptom-first body, exact file pointers, acceptance criteria,
  `[hop:<fingerprint>]` title suffix, `auto-filed` label). Re-detection of an open finding bumps
  `last_seen_at` — never a second issue. A finding re-detected within `REOPEN_WINDOW_DAYS = 7` of
  resolving **reopens the same row** (same Linear issue) — a flapping source can never cycle into
  a pile of issues. When Linear is unconfigured or returns `{ok:false}`, a P1-severity finding is
  delivered via the existing `sendOwnerNotification` instead (recorded in `delivered_via`) — the
  owner hears about a dead cron before Monday even with no Linear key.
- [ ] **Verify:** a monthly GitHub Action regenerates the committed datasets
  (`scripts/gen-*.mjs`) and opens a **plain diff PR** when output changed — no LLM writes code.
  Three deterministic guards: a **path restriction** (the run fails if the diff touches anything
  beyond `lib/place-facts.ts`, `lib/climate-normals.ts`, and the single `CONTENT_LAST_MODIFIED`
  line of `lib/seo-routes.ts`), a **standing data-invariant vitest**
  (`lib/__tests__/data-snapshot.test.ts`: destination-set parity with `lib/destinations.ts`,
  currency-code shape, FX rates finite and positive, dates parseable) that fails `npm run check`
  both inside the Action and in CI on the PR, and a **human merge**. The PR is created with a
  fine-grained PAT (`HOP_BOT_TOKEN`) because PRs created with the default `GITHUB_TOKEN` do not
  trigger `pull_request` workflows — CI would silently skip. First activation is a supervised
  `workflow_dispatch` with `dry_run=true` that prints the would-be PR body and creates nothing.
- [ ] **Measure & close:** when a detector runs with **healthy inputs** and reports clear, the
  sentinel marks the finding `resolved` (`resolved_at`); a degraded input yields `unknown`, which
  neither files nor resolves — **no data is never treated as fixed**. The weekly business digest
  gains a "System" section: a "Needs attention" list rendering each open finding's title with its
  number verbatim, a "Resolved since last week" line (from `filed_at`/`resolved_at`), the 7-day
  degradation-event count per source, and the sentinel's own last-run age — the digest watches
  the sentinel, the sentinel watches the digest, so neither can die silently.
- [ ] Everything no-ops cleanly when `HOP_ENABLE_SELF_IMPROVE` is off or keys are absent; the
  sentinel route never 500s; no new code path can degrade a user-facing surface.
- [ ] ADR 0007 written; `.env.example` + `docs/cloud-env.md` updated; Phase 1.5 (the first
  class-(b) loop: a read-only weekly audit Action) and Phase 2 (agent-enriched issues, PostHog
  page signals) are specified here but gated on the deterministic core proving quiet first.

**Non-goals (deliberate):**

- No auto-merge of any PR, ever — including the data-refresh PR. Merging stays human-only.
- No LLM anywhere in Phase 1's detect/file path. The Phase 1.5 audit agent and Phase 2 triage
  agent *find and narrate*; they never merge, never compute a threshold, never write to `main`.
- No per-user data in any loop: no `user_id` columns on the new tables, no user rows in issue
  bodies, no user free text in any future LLM prompt from this system. Dead watches are a count.
- No PostHog *querying* in Phase 1 (page-level signals are Phase 2 behind
  `POSTHOG_PERSONAL_API_KEY`, added to env only when built) — capture-side analytics untouched.
- No changes to `eve/` (separate runtime, ADR 0001), no new Eve schedules, no scraping of
  third-party content (ADR 0005 already rejected that class).
- No money, no booking, no Stripe/Duffel writes — nothing in this system is irreversible.

### Loop catalog — who acts, who gates

Each loop is *instrument → detect → generate → verify → measure*, with its class:
**(a)** runs with no LLM anywhere; **(b)** an LLM generates the work item, humans/CI gate;
**(c)** human-only, no automation may touch it.

| # | Loop | Class | Detect | Generate | Verify/gate | Measure |
|---|------|-------|--------|----------|-------------|---------|
| L1 | **Cron liveness** (D1) | (a) | heartbeat age > 2× interval | Linear issue (template) | human triages | finding auto-resolves; digest counts |
| L2 | **Upstream degradation spike** (D2) | (a) | degraded-event rate vs baseline | Linear issue (template) | human triages | same |
| L3 | **Stale committed data** (D4) | (a) | `GENERATED_AT` age | monthly Action auto-PR (script output, no LLM) | **path guard + data-invariant test + CI + human merge** | stamp resets on merge → finding resolves |
| L4 | **Flag/key drift** (D3) | (a) | flag on, key missing | Linear issue (template) | owner fixes env (env changes are class c) | finding resolves next run |
| L5 | **Valuation drift** (D5) | (a) | \|observed − baseline\| / baseline vs threshold, ≥20 samples | Linear issue: "baseline/sweet-spots copy stale for program X" | human updates `lib/valuations.ts` / content via normal review | drift falls under threshold → resolves |
| L6 | **Dead watches** (D6) | (a) | count of never-firing active watches + reason-code tally | Linear issue (aggregate, no user rows) | human triages (product question) | count falls → resolves |
| L7 | **Valuation sync** (exists, ADR 0005) | (a) | trimmed-mean ≥20 samples | Supabase override | trust gates (`MIN_SAMPLES_TO_TRUST`, freshness, clamp) | live cpp vs baseline |
| L8 | **Business digest** (exists, extended) | (a) | weekly counts | owner email | — | the measurement layer itself |
| L9 | **Weekly invariant audit** (Phase 1.5) | (b) | monthly/weekly read-only `invariant-audit` sweep in Actions | findings → issues (`auto-audit` label, fingerprint dedupe) | `contents: read` + `issues: write` only; adversarial verification (ADR 0006); human | issues resolved over time |
| L10 | **Funnel drop / dead page** (Phase 2) | (b) | deterministic rule over `computeBusinessDigest()`'s own `WeeklyMetric {count, prev}` (one reporting brain) + HogQL for page signals | agent-enriched Linear issue (hypothesis + file pointers) | human triages; agent has no repo write | issue links the metric; digest tracks |
| — | Merges, flag flips, env/secret changes, migrations `apply`, anything touching money/booking/auth | **(c)** | — | — | — | — |

**Why this is self-*improving*, not just self-monitoring:** L3 and L5 target user-visible
content (fresh FX/climate data on destination surfaces, honest point valuations grounding
`/ask` and the sweet-spots copy); L6 targets product value (watches that never pay off); L9
generates net-new improvement work from the codebase itself. L1/L2/L4 keep the loops alive.

## 2. Files to touch

Sequenced as three small PRs this week (+ one next week), per lane discipline — each
independently shippable and revertible.

**PR 1 — telemetry + sentinel + filing (the core loop) + ADR**

| path | change | new? |
|---|---|---|
| `lib/env.ts` | add `LINEAR_API_KEY`, `LINEAR_TEAM_ID` to `EnvKey` + accessors; add `isSelfImproveEnabled()` (flag only, deterministic — the `isObservedOutcomesEnabled` pattern at `lib/env.ts:170`; the Linear keys additionally gate *filing*, mirroring the `isEmailEnabled()` split) | no |
| `lib/cron-heartbeat.ts` | `recordHeartbeat(job: CronJob, ok: boolean, note?: string): void` — fire-and-forget `withDb` upsert keyed by job; swallows everything | **yes** |
| `lib/degradation-telemetry.ts` | `recordDegradation(sources: string[], route?: {from: string; to: string}): void` — same contract as `lib/valuation-telemetry.ts#recordCppObservations` (void, gated, can never throw or reject); persists `route` only when both codes match `/^[A-Z]{3}$/`, else null | **yes** |
| `lib/search.ts` | one call site: after `degraded` is final (beside the return at line 324–334), `if (!useMock && degraded.length > 0) recordDegradation(degraded, {from: params.from, to: params.to})` — mirrors the `recordCppObservations` call at line 220 | no |
| `lib/health-checks.ts` | pure detectors + `CRON_JOBS` table (path, schedule string, `expectedIntervalMs`) + `runHealthChecks(inputs, now): Finding[]`; named exported constants: `HEARTBEAT_STALE_FACTOR = 2`, `DATASET_STALE_DAYS = 120`, `SPIKE_MIN_EVENTS = 5`, `SPIKE_FACTOR = 3`, `VALUATION_DRIFT_THRESHOLD = 0.25`, `WATCH_DEAD_DAYS = 21`, `MAX_ISSUES_PER_RUN = 3`, `REOPEN_WINDOW_DAYS = 7` | **yes** |
| `lib/improvement-findings.ts` | findings store: `upsertFinding` (reopens within `REOPEN_WINDOW_DAYS`), `resolveFinding`, `listOpenFindings`, `markFiled(id, {linearIssueId?, deliveredVia})` — every call `withDb` with a fallback | **yes** |
| `lib/linear.ts` | `fileIssue({title, body, fingerprint}): Promise<LinearResult>` — GraphQL POST, discriminated `{ok}` result, never throws; primary dedupe is the findings table (re-read `linear_issue_id` immediately before create); secondary best-effort title-contains query (see Risks) | **yes** |
| `lib/improvement-templates.ts` | pure text templates per finding kind — symptom first (quote the exact `DegradedNote` line, `components/DegradedNote.tsx:13`, where one exists), then numbers + window, exact file pointers, acceptance criteria; copy-spec voice | **yes** |
| `lib/valuations-live.ts` | `export` the existing `MIN_SAMPLES_TO_TRUST` (line 12) so D5 reuses ADR 0005's trust gate verbatim | no |
| `app/api/cron/health-sentinel/route.ts` | daily cron: CRON_SECRET auth → flag gate (503 disabled — the `valuation-sync` route pattern) → gather inputs (each its own degradable query) → `runHealthChecks` → upsert/reopen/resolve findings → file ≤3 issues (Linear, else owner email for P1) → prune `hop_degradation_events` >30d → record its own heartbeat → JSON status per detector; `export const dynamic = 'force-dynamic'`; never 500s | **yes** |
| `app/api/cron/{standing-orders,revalidate-seo,valuation-sync,business-digest}/route.ts` | append `recordHeartbeat(...)` (ok on completion; `ok:false, note:'disabled'` on the 503-disabled paths); standing-orders additionally tallies `evalResult.reason` codes into the note (the `evalResult` is in hand at line 113) | no |
| `vercel.json` | add `{"path": "/api/cron/health-sentinel", "schedule": "17 11 * * *"}` (offset from the 13:30 valuation-sync) | no |
| `drizzle/0006_self_improvement.sql` | `hop_cron_heartbeats` (job pk, last_run_at, ok, note) · `hop_degradation_events` (id, source, route, created_at; **no user_id by design**) · `hop_improvement_findings` (id, fingerprint UNIQUE, kind, severity, title, body, status, linear_issue_id, linear_identifier, delivered_via, first_seen_at, last_seen_at, **filed_at**, resolved_at) | **yes** |
| `lib/db/schema.ts` + `utils/supabase/admin.ts` | table types for the three tables | no |
| `docs/decisions/0007-self-improvement-loops.md` | ADR: the residual principle; the (a)/(b)/(c) boundary as a decided invariant; the two recorded exceptions — heartbeat writes are deliberately ungated (gating them blinds L1 during flag churn, and history must exist the day the flag flips), and secrets placement (`ANTHROPIC_API_KEY` + `HOP_BOT_TOKEN` live **only** in GitHub Actions secrets, never Vercel — the deployed app has no path to an LLM key or repo write; `LINEAR_API_KEY` is the one runtime key, blast radius = "can create issues in one team", never logged) | **yes** |
| `.env.example`, `docs/cloud-env.md` | `HOP_ENABLE_SELF_IMPROVE`, `LINEAR_API_KEY`, `LINEAR_TEAM_ID` | no |
| `lib/__tests__/health-checks.test.ts`, `lib/__tests__/linear.test.ts`, `lib/__tests__/improvement-findings.test.ts` | see Test plan | **yes** |

**PR 2 — digest System section + dead-watch detector (D6)**

| path | change | new? |
|---|---|---|
| `lib/business-digest.ts` | add `system` section to `BusinessDigest`: open findings (title + number verbatim), resolved-since-last-week count (`resolved_at` in window; filed count from `filed_at`), 7d degradation counts per source, sentinel heartbeat age — four independent null-degrading queries + pure renderer lines ("Needs attention" list; omitted entirely when degraded, never "0" for "unknown") | no |
| `lib/health-checks.ts` | D6 dead-watch rule + boundary tests (inputs: aggregate counts only) | no |
| `lib/__tests__/business-digest.test.ts` | extend: system section rendering; existing sections byte-identical when it's null | no |

**PR 3 — data-refresh loop (L3)**

| path | change | new? |
|---|---|---|
| `scripts/gen-place-facts.mjs`, `scripts/gen-climate-normals.mjs` | emit `export const GENERATED_AT = '<ISO date>'` into their output; re-run once and commit (keyless; **needs network egress** to Wikidata/Open-Meteo/Frankfurter — they run outside the app runtime, not "offline") | no |
| `lib/__tests__/data-snapshot.test.ts` | standing structural invariants over the **committed** datasets: destination-set parity with `lib/destinations.ts`, currency codes match `/^[A-Z]{3}$/` and the curated `CURRENCY` table, FX rates finite and > 0, `date ≥ agoDate`, 12 monthly normals per destination. Runs in every `npm run check` — inside the Action *and* on the PR — so a malformed upstream response can't reach a human eyeball as a plausible diff. Deliberately **no plausibility band** (no ±X% FX check): outlier FX moves are exactly what the human merge is for | **yes** |
| `.github/workflows/data-refresh.yml` | monthly (`0 9 1 * *`) + `workflow_dispatch` with `dry_run` input (default `true` prints the would-be PR body, creates nothing): run both regenerators → bump the single `CONTENT_LAST_MODIFIED` line in `lib/seo-routes.ts` (constrained sed; step fails unless exactly one line matched before and after) so `app/sitemap.ts` `lastModified` stays honest → **hard path guard**: fail if `git diff --name-only` contains anything beyond the three allowed files → `npm run check` → `gh pr create` on fixed branch `bot/data-refresh` (force-pushed; re-runs update one PR). Uses `HOP_BOT_TOKEN` PAT (contents + pull-requests write) so CI triggers on the PR. All third-party actions SHA-pinned | **yes** |

**PR 4 (Phase 1.5, next week, after the deterministic core proves quiet) — first class-(b) loop**

| path | change | new? |
|---|---|---|
| `.github/workflows/weekly-audit.yml` | weekly read-only audit: headless Claude run over the existing `invariant-audit` recipe (`.claude/workflows/invariant-audit.js` prose recipe, adversarial verification per ADR 0006), permissions `contents: read` + `issues: write` **only**, skips cleanly when `ANTHROPIC_API_KEY` secret absent, `workflow_dispatch` `dry_run` prints findings JSON, dedupes by `auto-audit` label + `[hop:audit:<fingerprint>]` title convention. Files GitHub issues (no new Linear plumbing in the Action) | **yes** |

Framework ground truth: cron routes follow
`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — `GET(request:
Request)`, Route Handlers uncached by default; we keep the house `export const dynamic =
'force-dynamic'` belt-and-braces, matching the four existing cron routes.

## 3. Engine hooks

The moat reasserted first: **every number in this system is a counted row, a timestamp
difference, or a named exported constant. No LLM computes, ranks, or thresholds anything, in any
phase.** In Phase 1.5/2, the LLM's only inputs are already-computed findings and
already-aggregated metrics (allowlisted fields, never user free text), and its only output is
issue prose read by a human — numbers enter its prompt from `lib/health-checks.ts` results and
leave unchanged.

- `lib/search.ts#assembleSearch` — the single instrumentation point for degradation; the hook
  mirrors `recordCppObservations` (line 220): fires after `degraded[]` is final, guarded by
  `!useMock` (line 57) and `degraded.length > 0`, void, cannot affect the search result.
  (`degraded` is `string[]` — line 54 — so `recordDegradation` takes `string[]`, not a literal
  union.) **Coverage note, resolved:** `/deals` builds from the static destination dataset
  (`app/deals/page.tsx:74`, `topValue(24)`) — it never calls `assembleSearch`, has no upstream
  fan-out, and needs no degradation coverage.
- `lib/supabase-helpers.ts#withDb` — wraps **every** new query; each returns its stated fallback
  (`null`/`[]`/`false`) on any failure.
- `lib/valuations.ts#listValuations` (already exported) + `lib/valuation-overrides.ts#getValuationOverrides`
  → D5's two inputs; `lib/valuations-live.ts#MIN_SAMPLES_TO_TRUST` (newly exported) is its gate.
  D5 is pure arithmetic over two numbers the engine already computes.
- `lib/standing-orders-model.ts#evaluateOrder` — untouched; its existing `reason` codes are
  tallied (counted) in the standing-orders route where `evalResult` is already in hand (line 113).
- `lib/business-digest.ts#computeBusinessDigest` / `renderBusinessDigest` — extended, contract
  unchanged: resolver degrades per-section to null, formatter stays pure and omits nulls. Any
  future funnel rule (L10) consumes this resolver's `WeeklyMetric {count, prev}` output — one
  reporting brain, never a second set of queries.
- `lib/email.ts#sendOwnerNotification` + `isEmailEnabled()` — unchanged delivery for the digest
  and the P1 fallback channel.
- `lib/env.ts#hasEnv` — the flag-drift detector's only probe for keyed vars (presence checks,
  never values; nothing secret is read or logged). **D3 reads two independent inputs per seam**
  (a `FLAG_REQUIREMENTS` table in `lib/health-checks.ts`: raw `HOP_ENABLE_*` flag name → required
  keys → composite helper): (1) the raw flag state, parsed with the same `1|true|yes` rule the
  helpers use, and (2) key presence via `hasEnv`. Drift = `flagOn && !keysPresent`. It must NOT
  read the composite `is*Enabled()` helpers as its flag source — several fold key presence into
  the boolean (`isCheckoutEnabled()` is `flag && hasEnv('DUFFEL_API_KEY_TEST')`), so in the exact
  drift case the composite reads `false` and the detector would be structurally blind. The
  helpers still keep D3 honest the other way: a consistency assertion (for fused seams,
  `composite === (flagOn && keysPresent)`) is unit-tested so the table can never drift from the
  seams it audits.
- New: `lib/health-checks.ts#runHealthChecks(inputs, now)` (pure — inputs gathered by the route,
  so the logic is unit-testable with zero env), `lib/improvement-findings.ts#{upsertFinding,markFiled,resolveFinding,listOpenFindings}`,
  `lib/linear.ts#fileIssue`, `lib/cron-heartbeat.ts#recordHeartbeat`,
  `lib/degradation-telemetry.ts#recordDegradation`.

## 4. Flags & seams

- **`HOP_ENABLE_SELF_IMPROVE`** (new, `lib/env.ts#isSelfImproveEnabled()`, `1|true|yes` only):
  gates the degradation-telemetry write, the sentinel's detection pass, and heartbeat *reads*.
  Off → `recordDegradation` returns before touching anything, the sentinel answers
  `{ok:false, error:'disabled'}` 503 (the `valuation-sync` route pattern), and the digest's
  system section degrades to null (omitted). The deploy is a byte-for-byte no-op until flipped.
- **Filing sub-gate:** issue filing additionally requires `hasEnv('LINEAR_API_KEY') &&
  hasEnv('LINEAR_TEAM_ID')`. Flag on, no key → detect-and-record: findings accumulate as `open`,
  the digest reports them, P1s fall back to `sendOwnerNotification`, `fileIssue` is never called.
  Detection is free; delivery needs a key — the `isEmailEnabled()` split.
- **Heartbeat writes are deliberately ungated** — a recorded ADR 0007 exception, not an
  oversight: they are inert one-row upserts that no-op via `withDb` when the table doesn't
  exist, gating them would blind D1 during flag churn, and liveness history must already exist
  the day the flag flips. Reviewers enforce the flag-gated-seams rule *against the ADR's
  exception list*, so this stays a decision, not drift.
- **GitHub Actions seams:** `data-refresh.yml` needs the `HOP_BOT_TOKEN` fine-grained PAT
  (contents + pull-requests write on this repo only). Secret absent → the job fails visibly in
  the Actions tab and touches nothing. `weekly-audit.yml` gates the same way on
  `ANTHROPIC_API_KEY` presence (guard step, clean skip). Both start life via `workflow_dispatch
  dry_run=true`.
- **Secrets placement (ADR 0007 consequence):** `ANTHROPIC_API_KEY` and `HOP_BOT_TOKEN` exist
  **only** as GitHub Actions secrets — the deployed app has no path to an LLM key or a repo
  write. `LINEAR_API_KEY`/`LINEAR_TEAM_ID` are the one new runtime pair (Vercel), because the
  sentinel files from the app; blast radius is issue-creation in one team, and the key is never
  logged (house `lib/env.ts` rule).
- All new env keys go through `lib/env.ts` lazy accessors; only the flag helpers read
  `process.env` directly, matching the existing pattern.

## 5. Degradation plan (the failure ledger — every component by how it breaks)

| Failure | Behavior | Why safe |
|---|---|---|
| DB down / table missing | every read/write is `withDb` with fallback; heartbeat + degradation writes are additionally `void` fire-and-forget | host cron / search result never sees it; sentinel reports `detector: 'unknown'` per input in its JSON body |
| `recordDegradation` / `recordHeartbeat` itself fails | `try { void … } catch {}` — identical belt-and-suspenders to `lib/valuation-telemetry.ts:59-72` | a telemetry bug can never fail a user's search or a cron's real work |
| Linear API down / 429 / bad key | `fileIssue` returns `{ok:false, reason:'unconfigured'\|'send-failed'\|'rate-limited'}`; P1 findings fall back to `sendOwnerNotification` (`delivered_via='email'`); others stay `open`, retried next daily run | no throw, no loss — the findings table is the durable queue; Linear and email are just delivery |
| Crash between Linear create and `markFiled` | worst case one duplicate issue; narrowed by re-reading the finding row immediately before create and a best-effort title-contains lookup | duplicates are human-visible and greppable, never silent corruption |
| Detector storm (bad deploy trips everything) | `MAX_ISSUES_PER_RUN = 3`, remainder stays `open` and is listed in the route body; D2 has a min-volume floor; everything files at P3 except cron-dead (P1) | spam bounded; signal drains over subsequent days |
| Flapping source (open → resolve → open) | re-detection within `REOPEN_WINDOW_DAYS = 7` reopens the same finding (same fingerprint row, same Linear issue) | one incident per subject, ever, per episode |
| Sentinel route itself errors | outer `try/catch` returns `{ok:false, reason}` 200 — never 500s (business-digest route pattern, `app/api/cron/business-digest/route.ts:60-69`) | Vercel cron never sees a platform failure from us |
| Sentinel itself dies | its own heartbeat is in `CRON_JOBS`; the **digest** (independent route, independent cron) renders the sentinel's heartbeat age every Monday | the two watchers watch each other; no single silent death |
| `hop_degradation_events` grows unbounded | sentinel prunes rows >30 days each run | table stays small; prune failure degrades to "prune skipped" in the body |
| `vercel.json` and `CRON_JOBS` drift | a vitest imports `vercel.json` and asserts paths **and schedule strings** match the detector's table | the ADR 0006 "two sources of truth" failure class, caught in CI |
| Findings falsely resolve during an outage | resolution requires the detector to run with healthy inputs — a degraded input yields `status:'unknown'` which neither files nor resolves | "no data" is never "fixed" (the digest's null-vs-0 rule, generalized) |
| Regenerator upstream 4xxs / returns garbage | script fails → no PR; structurally broken output fails `lib/__tests__/data-snapshot.test.ts` inside the Action → no PR; staleness (D4) eventually files an issue | the loops back each other up; nothing malformed reaches a human as a plausible diff |
| `sed` bump of `CONTENT_LAST_MODIFIED` misfires | the step asserts exactly one matching line before and after, else fails the run | no free-form automated edit of hand-maintained code |

**Scoping:** all three tables are system-scoped — no `user_id` column exists to mis-scope.
`hop_degradation_events.route` stores only validated `AAA-BBB` IATA pairs (anything else → null),
so no attacker-influenced string can persist — the Phase 1.5/2 prompt-injection surface is closed
at the write, not the read. Templates render from findings only. The digest's queries count
heads, never select user rows.

**Idempotency:** heartbeats upsert by pk; events are append-only counters (duplicates harmless);
findings are unique on fingerprint (re-fire = `UPDATE last_seen_at`; post-window re-fire after
resolve = new row, correctly a new issue after a real regression); filing is at-most-once per
finding lifecycle; the data-refresh PR force-pushes one fixed branch.

**Irreversible actions:** none. The only writes outside hop's own tables are a Linear/GitHub
issue (deletable), an owner email, and a PR (closable). Merges, env changes, flag flips, and
migration `apply` remain human-only — that boundary is the ADR.

## 6. Test plan

Files: `lib/__tests__/health-checks.test.ts`, `lib/__tests__/linear.test.ts`,
`lib/__tests__/improvement-findings.test.ts`, `lib/__tests__/data-snapshot.test.ts`, extend
`lib/__tests__/business-digest.test.ts`. Node env, keyless — every seam passes with zero env set.

- **Threshold boundaries** (the cpp-2.5 discipline): heartbeat age exactly 2× interval → healthy;
  +1ms → stale. Spike: 4 events on zero baseline → nothing; 5 → finding. Dataset exactly
  `DATASET_STALE_DAYS` old → healthy; +1 day → finding. Drift exactly 0.25 → healthy; above →
  finding; drift 0.9 with `sampleSize 19` → **nothing** (trust gate). Dead watches at the count
  floor and window edge.
- **Fingerprint stability:** same failure across runs → same fingerprint; route variance never
  forks `cron-dead:*` or `upstream-spike:cash`.
- **Idempotent re-fire / reopen:** open finding re-fires → `last_seen_at` bump only; `markFiled`
  twice → no-op; resolve then re-detect inside `REOPEN_WINDOW_DAYS` → same row reopened, same
  `linear_issue_id`; outside the window → new finding.
- **Cap + severity routing:** 5 findings, cap 3 → exactly 3 `fileIssue` calls, remainder open
  and reported; Linear `{ok:false}` + P1 finding → `sendOwnerNotification` called,
  `delivered_via='email'`.
- **Unknown ≠ healthy:** degraded detector input → its findings neither file nor resolve.
- **Linear client:** no key → `{ok:false,'unconfigured'}`, fetch never called; fetch rejects /
  non-2xx → `{ok:false}`; never throws (mock `fetch`).
- **Flag-drift detector:** set/unset `process.env` around calls (the lazy-env convention — the
  detector itself only probes via `hasEnv` / `is*Enabled()`): flag on + key absent → finding;
  both absent → none; both present → none.
- **Degradation write hygiene:** mock path never records; `["cash"]` with route `{from:'SFO',
  to:'LAX'}` persists `SFO-LAX`; `{from:'<script>', to:'LAX'}` persists null route.
- **Digest:** system section null → omitted, existing sections byte-identical (regression guard
  on the pure formatter); "Needs attention" renders titles + numbers verbatim; filed/resolved
  counts use `filed_at`/`resolved_at`, never `first_seen_at`.
- **Config sync:** `CRON_JOBS` ↔ `vercel.json` paths and schedule strings.
- **Data snapshot invariants:** dest-set parity with `lib/destinations.ts`, currency-code shape,
  finite positive FX, `date ≥ agoDate`, 12 normals per dest — against the committed data.

```bash
npx vitest run lib/__tests__/health-checks.test.ts lib/__tests__/linear.test.ts \
  lib/__tests__/improvement-findings.test.ts lib/__tests__/data-snapshot.test.ts \
  lib/__tests__/business-digest.test.ts
npm run typecheck && npm run build   # RSC/route surface
npm run check                        # the pre-ship gate
# manual: curl -s localhost:3000/api/cron/health-sentinel | jq
#   (flag off → disabled; flag on, no Linear key → detect-only with findings in the body)
# manual: gh workflow run data-refresh.yml -f dry_run=true   # supervised first activation
```

## 7. Copy & design notes

No UI in Phase 1 — copy lives in the digest email and issue templates, both under
`docs/design/copy-spec.md` voice: state the number, no slop, no emoji.

- Digest system lines:
  - `Needs attention: valuation-sync cron has not completed in 52h · alaska live cpp 2.9 vs baseline 1.8 (61 samples)`
  - `Resolved since last week: 1 · Filed: 2`
  - `Degraded fetches, 7d: 14 (cash 11, awards 3)`
  - `Sentinel last ran 6h ago.`
  - Omitted entirely when the source degraded — never "0" for "unknown".
- Issue template shape (deterministic, symptom-first — a smaller model can triage it):
  - Title: `valuation-sync cron has not completed in 52h [hop:cron-dead:valuation-sync]`
  - Body: **users see** (the exact surface line where one exists, e.g. "Award data is
    unavailable right now — showing cash only." — `components/DegradedNote.tsx:13`) · what was
    observed (numbers + window) · where to look (exact paths: `app/api/cron/valuation-sync/route.ts`,
    `vercel.json`, `lib/health-checks.ts` constants) · acceptance ("heartbeat fresh for 48h; the
    finding auto-resolves") · footer: `Auto-filed by hop's health sentinel. Numbers are counted,
    not guessed.`

## 8. Risks & open questions

- **`GITHUB_TOKEN`-created PRs don't trigger `pull_request` workflows** (documented GitHub
  behavior) — the data-refresh PR would silently skip `ci.yml`. Mitigation: `HOP_BOT_TOKEN`
  fine-grained PAT; the Action also runs `npm run check` itself as a second belt. Creating the
  PAT is the plan's one setup step only the owner can do — class (c) by nature. `/compound` this
  as a `docs/solutions/` entry after merge.
- **Linear GraphQL dedupe query unverified:** the secondary title-contains lookup assumes an
  `issues(filter: {title: {containsIgnoreCase}})` capability — verify against Linear's schema at
  implementation time; if unavailable, drop the secondary check. The findings table remains the
  primary gate either way, so the worst case stays "one rare visible duplicate."
- **First-week noise:** thresholds are untuned. Everything files at P3 (only `cron-dead` is P1),
  capped at 3/run, under an `auto-filed` label the owner can mute; tuning a named constant is a
  one-line reviewed diff. Expect to tune `DATASET_STALE_DAYS` per dataset later (FX quarterly vs
  climate yearly — start uniform at 120d).
- **Valuation-drift threshold is a judgment call:** `VALUATION_DRIFT_THRESHOLD = 0.25` is chosen,
  not derived — a trimmed-mean over ≥20 first-party samples sitting ≥25% off the curated baseline
  means the baseline (and the sweet-spots copy grounded on it) is materially stale. The issue it
  files asks a human to update `lib/valuations.ts`; the pipeline never writes that file (ADR 0005
  keeps it pure).
- **Regenerators need egress** (Wikidata/Open-Meteo/Frankfurter) — fine in Actions; an upstream
  4xx fails the script, no PR opens, and D4 eventually files the staleness issue.
- **Phase 1.5/2 prompt injection:** decided now — agents receive only template-rendered findings
  (allowlisted fields; the route column is IATA-validated at write time, so no free user text
  exists to ingest), run with no repo-write permissions, and their output is issue prose a human
  reads.
- **Self-monitoring:** the sentinel↔digest cross-watch covers both schedulers dying; if *Vercel
  cron itself* dies, the Monday digest's absence is the owner-visible signal — accepted for
  Phase 1 (a GitHub-Actions-side external ping is a cheap Phase 2 add if it ever bites).
- **Open questions:** which Linear team (`LINEAR_TEAM_ID` — owner supplies with the key);
  whether D6's aggregate issue should split per dominant reason code once volume justifies it;
  when to promote the weekly-audit Action from GitHub issues to Linear filing (only if the
  gh-issues lane proves too disconnected).
- Cross-ref: none of the Eve doc's 12 blockers apply — `eve/` is untouched. Nothing here is
  irreversible; the money/booking human-gate is unreached by construction.

## 9. Review hooks

- **degradation-reviewer** — the heart of this diff: six new `withDb`/`{ok:false}` seams, two
  fire-and-forget writers, a never-500 route, unknown-vs-healthy resolution semantics, null-vs-0
  in the digest extension.
- **engine-invariant-reviewer** — no LLM in the detect/file path; every threshold a named
  exported constant; the `assembleSearch` hook cannot alter `degraded[]` or the verdict; D5 reads
  `listValuations()`/`getValuationOverrides()` without touching `lib/valuations.ts` purity; the
  digest formatter stays pure; heartbeat-ungated exception matches ADR 0007's list.
- **security-reviewer** — CRON_SECRET on the new route; Linear key never logged; no user data in
  tables/issues/templates; IATA validation on the route column; PAT scope + SHA-pinned actions in
  both workflows; secrets-placement rule (no LLM/repo-write keys in Vercel); flag-drift detector
  reads presence only.
- **copy-voice-reviewer** — issue templates + digest system lines against copy-spec
  (symptom-first, number-stated, no slop).
- **nextjs16-reviewer** — the new route handler (uncached-by-default semantics, `force-dynamic`
  convention, no static opt-in leaking).
- **eve-architecture-reviewer** — not applicable (no `eve/` changes); re-engage if Phase 2 ever
  proposes Eve schedules.

After merge, `/compound`: a `docs/solutions/` entry for the GITHUB_TOKEN-PR-CI gotcha, one for
the data-invariant-test-as-refresh-guard pattern, and ADR 0007 itself — so the next loop proposal
inherits the residual principle and the (a)/(b)/(c) taxonomy instead of re-deriving them.
