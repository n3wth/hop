# 0006. Deterministic multi-agent orchestration lives in .claude/workflows/

Status: Accepted
Date: 2026-07-01

## Context

ADR 0004 made the Plan → Work → Review → Compound loop the operating model, and its heavy lanes
are multi-agent by design: `/review-parallel` fans six reviewers over one diff,
`/plan` benefits from competing drafts when the solution space is wide. But those fan-outs
existed only as **prose instructions** in `.claude/commands/*` — every session re-interpreted
who to dispatch, what each agent should see, how to merge severities, and when to stop. That is
model-driven orchestration, and it drifts: a session skips a reviewer it shouldn't, merges
duplicates differently, or accepts a plausible-but-wrong finding because nothing forced a
verification pass. Meanwhile the harness now has a Workflow tool: deterministic scripts
(`agent()`/`pipeline()`/`parallel()`, schema-forced agent outputs, resumable runs) with a
registry at `.claude/workflows/`.

hop already decided this exact question once, for the product: ADR 0002 — numbers are computed
by `lib/*`, LLMs only narrate. The dev loop had no equivalent.

## Decision

**Apply ADR 0002 to the loop itself: agents supply judgment inside each node; everything
between the nodes is computed by a checked-in workflow script.** Concretely:

- The loop's fan-out patterns live as executable scripts in `.claude/workflows/`
  (`review-parallel.js`, `plan-panel.js`, `invariant-audit.js`), run via the Workflow tool.
- Orchestration rules are **code, not instructions**: reviewer applicability is a path regex,
  outputs come back through JSON Schemas, dedup is a `file:line` map, severity ranking is an
  enum, a plan winner is a vote tally, discovery loops end on a counted dry-round exit.
- **No finding reaches a human un-refuted.** Review and audit workflows attach an adversarial
  verification stage (skeptics defaulting to "refuted") — the safety net against
  plausible-but-wrong agent findings, built into the pipeline rather than left to discipline.
- The `.claude/commands/*` files stay authoritative for *process* and double as the **manual
  fallback** on harnesses without the Workflow tool — same loop, degraded gracefully (the house
  style, applied to tooling). Commands point to their workflow; workflows note their command.
- Scripts follow the constraints documented in `.claude/workflows/README.md` (pure-JS sandbox,
  injected globals, no wall-clock/randomness) and `.claude/**` is excluded from the app's
  ESLint graph, mirroring the `eve/**` and `cloudflare/**` build-isolation precedent.

## Consequences

- **A change is judged the same way every time.** Reviewer selection, verification, and merge
  order no longer depend on which session runs the review — improving review means editing the
  script or a reviewer, which is a reviewable diff (taste keeps moving into systems).
- **The Compound lane gains a fourth promotion target.** A lesson can now become a solutions
  entry, a CLAUDE.md rule, a reviewer check, an ADR — or an orchestration rule in a workflow
  (e.g. a new path gate, a stricter skeptic angle).
- **The loop is model-portable by construction.** Because taste lives in checklists and rules
  live in scripts, the driving model only fills judgment nodes: reviewers are pinned to
  `sonnet` in their frontmatter, mechanical nodes run at low effort, verify/judge nodes inherit
  the session model at high effort, and rigor scales via vote count (`args.skeptics`), never
  via a hardcoded model escalation. Running the loop on Sonnet 5 — or following the
  `.claude/commands/*` recipes from a non-Claude agent via `AGENTS.md` — changes cost, not
  shape (see `.claude/workflows/README.md` §Model portability).
- **Two sources of truth must not drift.** A command and its workflow describe the same
  process; changing one without the other reintroduces the improvisation this ADR removes.
  `invariant-audit.js`'s memory lens checks doc/code drift for exactly this class of problem.
- Workflow scripts are a third runtime with real gotchas (top-level return, injected globals,
  no `Date.now()`) — captured in
  `docs/solutions/2026-07-01-workflow-scripts-are-a-third-runtime.md`.
