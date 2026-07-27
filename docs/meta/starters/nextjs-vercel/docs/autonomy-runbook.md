# Autonomy runbook · TODO(project): <repo name>

> Every unattended run reads this file first. Amending it changes agent behavior on the
> next run; the Amendments section is its changelog. See the pattern library, doc 06.

## Fleet

| Agent | Role | Trigger |
|---|---|---|
| scheduled builder | picks the top queue item, ships one PR per run | TODO(project): cron |
| weekly audit | whole-codebase invariant sweep; fix-or-file | TODO(project): cron |
| PR review bots | machine review on every PR | on PR |
| owner (human) | merges the hold list; flags, env/secrets, migrations | — |

## Queue rules

1. Source of order: TODO(project) — tracker project, or the plan doc's phase order as the
   fallback when the tracker is unreachable (cross-check open/merged PRs so finished work
   isn't redone).
2. Never pick: human-only items; items with unmet blockers; anything another agent is
   already working (open PR or in-progress ticket).
3. One item per run. Too big for one cohesive PR → ship the first slice, leave a handoff
   note in the log.

## Run procedure

1. Read `AGENTS.md` and this file.
2. Triage first: open PRs from prior runs with failing CI or conflicts are this run's work
   item.
3. Implement per `AGENTS.md`. Verify: `npm run check` and `npm run build`.
4. One ready-for-review PR, titled with the item ID, body carrying scope + test plan.
5. Merge only per the policy below.
6. Waste guard: nothing actionable → end with no PR; never re-file a blocker already in the
   log.
7. Compound (mandatory): dated entry in `docs/autonomy-log.md`; non-obvious fixes →
   `docs/solutions/`; a rule that would have prevented this run's problem → amend this file
   in the same PR.

## Merge policy

**Auto-merge: off**  *(kill switch: flip to `on` only after machine review has a
track record; flip to `off` in one docs commit to stop all autonomous merging)*

Merge only when ALL hold: CI green on the head commit · zero unresolved review threads and
no unaddressed bot findings · diff entirely within the item's written scope · every changed
path passes `scripts/merge-gate.mjs` (the hold list lives there). A partially-held PR is
entirely held. Doubt → hold with a PR comment saying why; a held PR is a success.

Incident protocol: one bad autonomous merge → revert, flip the switch off, record the lesson
here as an amendment before re-enabling.

## Hard guardrails (violating any is a defect, not initiative)

- Never merge outside the policy above, including when Auto-merge is off.
- Never flip feature flags, edit env/secrets, or run migrations against production.
- Never touch payments/auth/identity beyond the picked item's written spec.
- Never generate an output-of-record number.
- Blocked or ambiguous → file the blocker in the log and end the run. Do not guess.

## Amendments

*(append here: rule, date, one-line reason; newest first)*

- YYYY-MM-DD · Initial version.
