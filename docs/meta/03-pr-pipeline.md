# 03 — PR pipeline

## Pattern

The PR (CL, in monorepo terms) is the unit of change and the audit log. Every task ends in
exactly one PR, and every PR automatically gets:

1. **CI**: the same gate agents run locally (lint + typecheck + tests) plus a production
   build. The build step matters more for agents than for humans: it catches integration
   errors (routing, server/client boundaries, codegen drift) that unit tests miss and that
   agents introduce often.
2. **A preview deployment**: a real deployment of the PR head at a stable URL, posted on
   the PR. Reviewers review behavior, not only the diff.
3. **Machine review**: the reviewer pipeline from doc 04, plus any commercial PR-review
   bots, posting findings as review threads before a human is expected to look.
4. **A merge decision**: autonomous under the tiered policy (doc 05), or held with the
   reason stated on the PR.

The PR body is structured: work-item ID in the title, a scope statement (consumed by the
merge policy's in-scope check), a test plan, and state-sync notes for the external tracker.

## Rules

- **One task per PR, one PR per task.** If the item won't fit one cohesive PR, ship the first
  slice and leave a handoff note. Agents scope up under momentum; the rule has to be explicit
  and checkable.
- **No drive-by fixes.** An unrelated change disqualifies the PR from auto-merge. Unrelated
  improvements become filed work items.
- **Local gate = CI gate.** One command is the pre-ship gate everywhere; CI adds only a clean
  machine and the build. If the gates diverge, agents learn to push and hope.
- **PRs carry provenance**: which agent run, which work item, commit-trailer attribution.
- **Agent-authored PRs get the same bots as human ones.** Review agents and screenshot bots
  run regardless of author.
- **Red PRs are inventory.** An open PR with failing CI or conflicts from a prior autonomous
  run is the next run's first work item (triage-before-building, doc 08).

## Preview deployments

The most stack-dependent piece:

- **Web apps**: platform previews (Vercel/Netlify) or a namespace-per-PR on Kubernetes. The
  preview needs honest backing services (seed data, fake payment mode, flags mirrored from a
  template) or reviewers are reviewing fiction.
- **Services**: deploy the PR build to an ephemeral instance; run smoke and contract tests
  against it; post the endpoint on the PR.
- **Libraries**: publish a PR-tagged package and run downstream consumers' tests against it.
- **UI work**: a screenshot bot visits the preview and posts captures at standard
  breakpoints. hop pairs this with a local script (build + headless Chromium) so agents
  self-verify before pushing.

## Failure modes

| Failure | Countermeasure |
|---|---|
| Agent pushes without running the gate | CI is required for merge; red = held |
| PR bundles unrelated WIP | Fresh-workspace rule (doc 02) + scope check (doc 05) |
| Preview shows mock data only | Env tiers: mock for dev, seeded/honest for preview |
| Bot threads pile up unresolved | Merge policy requires zero unresolved threads |
| Two agents pick the same task | Work-item locking: an item with an open PR or in-progress ticket is never picked |

## Porting to a google3-style stack

Mostly 1:1, since this layer is what large companies already have. PR → CL, CI → presubmit,
machine review → analyzers/robot comments plus LLM reviewers posting the same way, preview →
per-CL staging jobs or experiment configs. The agent-specific additions:

- provenance metadata on agent-authored CLs (run ID, ticket);
- triage-first wired into the agent scheduler (query open agent CLs with failing presubmit
  before taking new work);
- a scope analyzer comparing changed files against the ticket's declared surface;
- findings routed back to a fixer agent before a human reviewer is assigned (doc 04).
