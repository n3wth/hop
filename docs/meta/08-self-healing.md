# 08 — Self-healing: auto analysis and fixes

## Pattern

"Auto analysis and fixes" decomposes into three loops with different trust levels, matching
the (a)/(b)/(c) classes from doc 01:

1. **Detection (class a, no LLM)**: deterministic health checks that turn existing signals
   into filed work items.
2. **Triage-before-building (agent, gated by CI + policy)**: every scheduled run fixes
   broken inventory before starting new work.
3. **Standing audit (agents, human-consumed)**: a periodic whole-codebase sweep for
   invariant drift, findings skeptic-verified before anyone sees them.

## Loop 1 — Detection from residuals

The design rule (hop's ADR 0007): health signals are residuals of computations the system
already performs. The detector invents no judgment. It reads heartbeat timestamps crons
already stamp, counts degradation events the request path already records, compares
date-stamps committed datasets already carry, checks env presence feature seams already
require, and diffs an observed aggregate against a curated baseline. Every threshold is a
named exported constant, so tuning is a one-line reviewed diff.

Detections become idempotent, fingerprinted findings (fingerprint = `kind:subject`,
unique-constrained) filed as tracker issues from deterministic templates:

- re-firing an open finding does not file a duplicate;
- a finding auto-resolves when the signal verifiably clears;
- it reopens (same row, same issue) if it re-fires within a window;
- a degraded input yields `unknown`, which neither files nor resolves. No data is never
  treated as healthy.

Noise is bounded, not prevented: new detectors file at low priority under an `auto-filed`
label, capped per run, except the genuinely-urgent kinds. Watch a detector's signal quality
before letting it page anyone.

Two structural details that carry over to any implementation:

- **Watchers watch each other.** The sentinel's own heartbeat is in the checked set, and a
  human-visible artifact (a weekly digest) fails loudly if the scheduler itself dies.
- **Duplicated facts get a test.** Where the detector must duplicate config facts (cron
  paths and schedules), a unit test asserts the copies match: the "two sources of truth"
  failure class, caught in CI rather than by discipline.

## Loop 2 — Triage before building

From the runbook's run procedure: at the start of every scheduled run, open PRs from prior
autonomous runs with failing CI or merge conflicts are the work item for this run. Fix
them before picking anything new. Effects:

- abandoned agent work becomes a queue instead of waste;
- broken inventory can't accumulate past one run's capacity;
- the system prefers finishing to starting, which is the opposite of agents' natural bias.

The companion waste guard: if triage finds nothing actionable and no eligible queue item
exists, the run ends with no PR, and never re-files a blocker already recorded in the run
log.

The per-PR version of the same idea is the fix pass in the merge pipeline (doc 04): verified
P1 findings are fixed by an agent on the PR branch before a human sees the PR at all.

## Loop 3 — Standing audit

A scheduled whole-codebase sweep, not a diff review, for invariant drift: the same
reviewer lenses as machine review plus a memory lens (do the docs still match the code? do
the command recipes still match the workflow scripts?). Shape (hop:
`invariant-audit`): finder lenses run in rounds until two consecutive rounds surface nothing
new; every finding faces a skeptic panel (2-of-3 must uphold); upheld findings are fixed if
small or filed if not.

The audit also re-reviews the week's autonomously-merged diffs. This is the compensating
control that makes tiered auto-merge (doc 05) acceptable: everything that shipped unattended
gets a second look on a schedule, decoupled from merge-time pressure.

## What stays human

Fixes flow through the same PR pipeline as everything else — detection files issues, agents
fix on branches, CI and the merge policy gate. Class (c) stays closed: no self-healing loop
flips a flag, edits a secret, runs a production migration, or merges outside policy. A loop
that "fixes" by doing any of those is a defect (runbook guardrails, doc 06).

## Porting to a google3-style stack

Loop 1 is standard monitoring discipline pointed at a new target: implement detectors as
periodic jobs over signals you already have (borg task health, error budgets, dataset
freshness metadata, flag-vs-dependency consistency), filing fingerprinted tracker bugs from
templates. The idempotency contract (file-once, auto-resolve, reopen-same-bug) matters more
than the detector sophistication; it's what keeps the tracker trustworthy. Loop 2 is a
scheduler rule: query the agent fleet's open CLs with failing presubmit before assigning new
work. Loop 3 is a scheduled analyzer sweep over HEAD rather than over diffs, with the
skeptic stage from doc 04 and a standing lens over the week's auto-submitted CLs.
