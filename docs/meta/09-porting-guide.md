# 09 — Porting guide: standing this up on any stack

Adopt in stages. Each stage is useful on its own, and each one's telemetry justifies (or
kills) the next. Skipping ahead — turning on auto-merge before machine review has an
uphold-rate track record — is how these systems lose organizational trust.

## Stage 0 — Prerequisites

Without these, agents flail; fix them first. They're also just good engineering, so this
stage needs no AI buy-in.

- **One-command gate**: a single command runs lint + typecheck + tests, identical locally
  and in CI. Add a production build to CI.
- **Hermetic dev setup**: a checked-in script from clean checkout to working environment,
  defaulting to mock/fake backends. No credentials needed for the common path.
- **Trunk protection**: required checks, no direct pushes, plus a local hook.
- **Rules file**: an `AGENTS.md` (with a `CLAUDE.md` containing `@AGENTS.md` for Claude Code) stating the invariants,
  the commands, and the gotchas. Start small; the compound step grows it.
- **Vendored/pinned docs for fast-moving dependencies**: agents write code for the framework
  in their training data unless pointed at the installed version's docs.

## Stage 1 — The worktree → PR → preview loop (docs 02, 03)

- Adopt fresh-workspace-per-task for humans and agents alike.
- Structure PR bodies: work-item ID, scope statement, test plan.
- Stand up preview deployments per PR, honest enough to review against (seed data, fake
  payment mode).
- Add commercial PR-review and screenshot bots — cheap signal while you build your own
  reviewers.
- Write the dirty-checkout rule and the explicit-refs rule into the rules file.

Exit criterion: a task can go from assignment to reviewed, previewed PR without anyone
ssh-ing into anything.

## Stage 2 — Machine review + memory (docs 04, 07)

- Derive 3–6 specialized reviewers from your last quarter's incident reports and recurring
  review comments. Checklists with grep targets and severity rubrics, not vibes.
- Encode the orchestration as a checked-in script: path gates, schema outputs, file:line
  dedup, skeptic verification. Keep a prose fallback in lockstep.
- Create the memory surfaces: solutions library with frontmatter, ADR directory, plans
  directory. Make the compound step a required checklist item on agent PRs.
- Start measuring per-reviewer uphold rate (findings upheld by skeptics / findings raised).

Exit criterion: humans review verified findings and previews, not raw diffs; recurring bug
classes each have a checklist line.

## Stage 3 — Scheduled autonomy + tiered merge (docs 05, 06, 08)

- Write the runbook: fleet table, queue rules (with a tracker-down fallback), run procedure
  with triage-first, guardrails, amendments section.
- Schedule the builder (e.g. every 6h) and the audit (weekly). Pin scheduled runs to a
  mid-tier model.
- Define the hold list; start with **docs and tests as the only auto-tier**. Turn on
  auto-merge with the kill-switch line in place and the revert-flip-amend protocol written.
- Add the class-(a) detectors over signals you already have; file fingerprinted issues.
- Widen the auto-tier directory by directory, justified by uphold-rate and revert-rate data.

Exit criterion: the system runs for a week unattended, ships in-scope work, holds everything
doubtful, and the run log shows blockers filed rather than guessed at.

## google3-style mapping (one table)

| This library | google3-style equivalent | Net-new work |
|---|---|---|
| Worktree per task (02) | citc client per task | agent env tier with no prod credentials |
| PR + CI + preview (03) | CL + TAP presubmit + per-CL staging | provenance metadata on agent CLs; scope analyzer |
| Reviewer fan-out (04) | Tricorder-style analyzers | LLM reviewers as analyzers; skeptic second-pass; uphold-rate metric |
| Fix pass (04) | auto-fix service | fixer agent dispatched on upheld findings before human review |
| Tiered merge (05) | submit rules + per-directory metadata | `risk_tier` directory attribute; kill-switch file read by scheduler |
| Runbook (06) | team policy g3doc | read-at-run-start contract; amendments discipline |
| Memory (07) | g3doc, design docs, postmortems | agent-legible read path (auto-injected per-directory rules; mandated lessons search) |
| Detectors (08) | monitoring + bug templates | fingerprinted file-once/auto-resolve/reopen contract |
| Triage-first (08) | — | scheduler queries open agent CLs with red presubmit before assigning work |

## What kills these systems

Observed failure modes, in rough order of frequency:

1. **Skipping the compound step.** Without it the system never gets smarter and the agents
   plateau at "fast junior".
2. **Auto-merge before review credibility.** One bad early merge and the whole program gets
   rolled back; earn the tier widening with data.
3. **Local gate ≠ CI gate.** Agents learn to push and hope; every red PR costs a triage run.
4. **Prose-only process.** If orchestration lives in instructions rather than scripts, every
   session re-improvises it and quality varies by run.
5. **Letting agents touch the gate.** CI config, merge policy, and the runbook's guardrails
   must be hold-tier, or the predicate is decorative.
6. **Unverified findings reaching humans.** Review fatigue from plausible-but-wrong findings
   destroys trust faster than missed bugs do.
