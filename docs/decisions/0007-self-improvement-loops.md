# 0007. Self-improvement loops

Status: Accepted
Date: 2026-07-02

## Context

hop already had one true closed loop — the ADR 0005 valuation sync (observe → aggregate → trust
gate → override) — and one half-loop, the weekly business digest, which *measures* but generates
no work. Everything else that could rot did so silently: a Vercel cron can die and nobody is
paged; a committed dataset (`lib/place-facts.ts`, `lib/climate-normals.ts`) ages without a
deadline; a `HOP_ENABLE_*` flag can sit "on" while its required key is missing, leaving a seam
that looks live but is silently inert; an upstream can degrade for a week before a human notices
the pattern; the curated `BASELINE_CPP` can drift arbitrarily far from what hop's own first-party
observations say a point is really worth.

The question was how to generalize the ADR 0005 pattern into a system that detects these things
and *generates work* — without violating the two invariants that make hop trustworthy (numbers
are computed, never generated; degrade, never throw), and without opening a new attack or
autonomy surface. The full design is `docs/plans/2026-07-02-self-improvement-loop.md`.

## Decision

### The residual principle

**Self-improvement signals are residuals of computations the engine already performs.** The
health sentinel (`app/api/cron/health-sentinel/route.ts` + the pure detectors in
`lib/health-checks.ts`) invents no judgment: it reads heartbeat ages the crons already stamp,
counts degradation rows `assembleSearch` already knows about (`degraded[]`), compares dataset
date stamps that already exist, checks env presence the seams already require, and diffs the
observed cpp aggregate (ADR 0005, `MIN_SAMPLES_TO_TRUST` reused verbatim) against the curated
baseline. Every number in the system is a counted row, a timestamp difference, or a named
exported constant (`HEARTBEAT_STALE_FACTOR`, `DATASET_STALE_DAYS`, `SPIKE_MIN_EVENTS`,
`SPIKE_FACTOR`, `VALUATION_DRIFT_THRESHOLD`, `WATCH_DEAD_DAYS`, `MAX_ISSUES_PER_RUN`,
`REOPEN_WINDOW_DAYS`). No LLM computes, ranks, or thresholds anything, in any phase.

Detections become **idempotent, fingerprinted findings** (`hop_improvement_findings`, fingerprint
= `kind:subject`, UNIQUE) that are filed as Linear issues from deterministic templates
(`lib/improvement-templates.ts`), auto-resolved when the signal verifiably clears, and reopened —
same row, same issue — when they re-fire within `REOPEN_WINDOW_DAYS`. A degraded input yields
`unknown`, which neither files nor resolves: **no data is never treated as fixed.**

### The (a)/(b)/(c) boundary — a decided invariant

Every loop, present or future, is classified and the classification is load-bearing:

- **(a) No LLM anywhere.** Deterministic detect → template → file. All of Phase 1 (this ADR's
  code) is class (a).
- **(b) An LLM generates the work item; humans/CI gate.** Permitted only downstream of class-(a)
  outputs: an agent may *narrate* findings the engine already computed (allowlisted fields, never
  user free text), with read-only repo access, its output being issue prose a human reads. It
  never merges, never computes a threshold, never writes to `main`.
- **(c) Human-only. No automation may touch it.** Merges, flag flips, env/secret changes,
  migration `apply`, and anything touching money, booking, or auth. Nothing in class (a) or (b)
  may perform, schedule, or auto-approve a class-(c) action.

### The two recorded exceptions

1. **Heartbeat writes are deliberately ungated.** Everything else in this system no-ops
   byte-for-byte when `HOP_ENABLE_SELF_IMPROVE` is off, but `recordHeartbeat`
   (`lib/cron-heartbeat.ts`) always runs on an authorized cron invocation. Gating it would blind
   the cron-liveness detector during flag churn, and liveness *history* must already exist the
   day the flag flips. The writes are inert one-row upserts that no-op via `withDb` when the
   table is absent; heartbeat READS stay gated. Reviewers enforce the flag-gated-seams rule
   *against this exception list* — this stays a decision, not drift.

2. **Secrets placement.** `ANTHROPIC_API_KEY` and `HOP_BOT_TOKEN` (the future data-refresh /
   audit Actions) live **only** in GitHub Actions secrets, never Vercel — the deployed app has no
   path to an LLM key or a repo write, by construction. `LINEAR_API_KEY` (+ `LINEAR_TEAM_ID`) is
   the one runtime pair added to Vercel, because the sentinel files from the app; its blast
   radius is "can create issues in one team", and it is never logged (house `lib/env.ts` rule).

## Consequences

- The digest and the sentinel watch each other (the digest gains a System section in the next
  PR; the sentinel's own heartbeat is in `CRON_JOBS`), so neither can die silently. If Vercel
  cron itself dies, the missing Monday digest is the owner-visible signal — accepted for Phase 1.
- Three new system-scoped tables exist with **no `user_id` column by design**
  (`hop_cron_heartbeats`, `hop_degradation_events`, `hop_improvement_findings`);
  `hop_degradation_events.route` only ever stores a validated `AAA-BBB` IATA pair. This closes
  the future class-(b) prompt-injection surface at the *write*, not the read.
- First-week noise is bounded, not prevented: everything files at P3 except `cron-dead` (P1),
  capped at `MAX_ISSUES_PER_RUN = 3` under an `auto-filed` label. Tuning a threshold is a
  one-line reviewed diff to a named constant in `lib/health-checks.ts`.
- `CRON_JOBS` in `lib/health-checks.ts` duplicates `vercel.json` facts; a vitest asserts paths
  and schedule strings match (the ADR 0006 "two sources of truth" failure class, caught in CI).
- Future loops (the digest System section, dead-watch detection, the data-refresh Action, the
  weekly audit Action, PostHog funnel rules) inherit this taxonomy instead of re-deriving it —
  each must state its class, and class (c) actions stay human forever.
