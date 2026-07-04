# hop autonomy runbook — how unattended sessions build this product

> Governs every autonomous run (Claude Code routines, delegated agents). Routine prompts point
> here; **this file is the routine's brain, and amending it is how the loop self-improves.**
> Canon rules: ADR 0008 (docs canon in git, Linear owns work state), ADR 0007 (the (a)/(b)/(c)
> automation boundary), ADR 0004 (compound loop). The work queue is the Linear `hop` project,
> mirrored from `docs/plans/2026-07-04-business-plan.md` §7.

## The fleet

| Agent | Role | Trigger |
|---|---|---|
| **Claude Code routine "hop autonomous dev"** | Default builder: picks the top queue item, ships one PR per run | Cron, every 6h, fresh session |
| **Claude Code routine "hop weekly invariant audit"** | Standing `/audit` sweep; fix-or-file drift | Cron, weekly (Sun 14:00 UTC), fresh session |
| **Cursor (Linear agent)** | Mechanical, well-specced items — delegated by setting the Linear issue's delegate | Manual/interactive dispatch |
| **Copilot coding agent** | Tiny repo-visible chores when a GitHub issue exists | Manual/interactive dispatch |
| **charliecreates / vercel-agent** | Automatic PR review + preview screenshots | On every PR (already wired) |
| **Owner (human)** | Merges. Flag flips, env/secrets, money, partnerships, legal | — |

## Queue rules (which item a run may pick)

1. **Source of order**: the Linear `hop` project — highest priority open, unblocked issue in the
   lowest open phase milestone. If Linear is unreachable (headless sessions may lack the
   connector and `LINEAR_API_KEY` is not in the environment), fall back to the phase order in
   `docs/plans/2026-07-04-business-plan.md` §7, cross-checking open/merged PRs on `n3wth/hop`
   so finished items aren't redone.
2. **Never pick**: owner-only items (N-300, N-320 track 1, N-322 track 1, N-323, N-327); the
   kill/freeze list (N-326 — eve/, hotels, memory axes, /compare, new planner-shaped surfaces);
   anything whose `blockedBy` or business-plan gate is unmet (billing flip = N-321's four
   gates); anything another agent is already working (open PR or Linear In Progress/delegated).
3. **One item per run.** If the item won't fit one cohesive PR, do the first shippable slice
   and leave a handoff note in the log.

## Run procedure (dev routine)

1. Read `CLAUDE.md`, `AGENTS.md`, this file, and the picked item's spec/prompt.
2. **Triage before building**: open PRs from prior autonomous runs with failing CI or conflicts
   are the work item for this run — fix them first.
3. Implement in the house style (engine-computed numbers, `withDb` degradation, flag-gated
   seams, copy-spec voice). Run the review workflows (`review-parallel`) when the Workflow tool
   exists; otherwise follow `.claude/commands/*` as prose.
4. Verify: `npm run check` and `npm run build`, plus the item's own test plan.
5. Push the session's designated branch; open **one ready-for-review PR** titled with the item
   id (e.g. `N-297 R0.1 …`). **Never merge** — merging is class (c), human-only.
6. Sync work state: update the Linear issue if tools are reachable; otherwise put
   `Linear sync needed: <id> → <state>` in the PR body (the next interactive session applies it).
7. **Compound (mandatory)**: append a dated entry to `docs/autonomy-log.md` (item, outcome, PR,
   surprises). Non-obvious fixes → `docs/solutions/`. If a rule would have prevented a problem
   this run hit, amend **this file** in the same PR under Amendments.

## Hard guardrails (violating any is a defect, not initiative)

- **Never merge a PR.** Never enable auto-merge.
- **Never** flip `HOP_ENABLE_*` flags, edit env/secrets, run migrations against prod, or touch
  payment/booking/auth beyond the picked item's written spec. The live Duffel key is untouchable.
- **Never** generate an economic number; never weaken the never-throw or user-scoping invariants.
- Spend discipline: one item per run; if scope balloons, ship the slice and stop.
- Blocked or ambiguous → do **not** guess: file the blocker in the log (docs-only PR is fine)
  and end the run.

## Dispatch to other agents (interactive sessions only)

Sessions with Linear/GitHub tools may fan work out instead of building:
- **Cursor**: set the Linear issue's delegate to Cursor for mechanical items with a complete
  spec (tests, codemods, pattern-clones). Verify its PR passes `npm run check` before the owner
  merges; the routine's triage step treats a red Cursor PR like any other.
- **Copilot**: assign to a GitHub issue for one-file chores. Same review bar.
- Headless routine runs do not dispatch (connectors may be absent); they build.

## Owner setup that upgrades the loop (optional, any time)

- Add `LINEAR_API_KEY` + `LINEAR_TEAM_ID` to the Claude Code cloud environment → headless runs
  get first-class Linear sync (the repo already has the env seam, `lib/env.ts:127`).
- Pause/tune the routines in the claude.ai Routines UI, or ask any session to `update_trigger`.

## Amendments

*(Runs append here — rule, date, one-line reason. Keep newest first.)*

- 2026-07-04 · Initial version, adopted with the business plan + ADR 0008.
