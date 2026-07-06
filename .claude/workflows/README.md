# Workflows — deterministic multi-agent orchestration

This folder holds hop's **saved workflow scripts**: the compound-engineering loop's fan-out
patterns, written down as executable orchestration instead of prose a session re-improvises.
The principle is ADR 0006, which is ADR 0002 applied to the dev loop itself: **agents supply
judgment inside each node; the script computes everything between the nodes** — who runs, what
they see, how findings dedupe, what severity wins, when a loop is done.

Run them by name via the Workflow tool on any harness that has it (Claude Code with subagent
orchestration): `Workflow({ name: 'review-parallel', args: { base: 'main' } })`. On a harness
without the Workflow tool, the `.claude/commands/*` files describe the manual fallback — the
workflows and the commands encode the *same* process, so the loop degrades gracefully instead
of disappearing (house style, applied to tooling).

## The roster

| Workflow | Lane | Shape |
|---|---|---|
| `review-parallel.js` | Review | one captured diff → six path-gated reviewers in a pipeline → one adversarial skeptic per finding → contested P1s adjudicated → merged P1/P2/P3 |
| `plan-panel.js` | Plan | three blueprint drafts from forced-diverse lenses → three-judge panel with a deterministic tally → one synthesis written to `docs/plans/` |
| `pr-merge-pipeline.js` | Ship | a PR number → three fixed-lens reviewers → contested P1s adjudicated → P1 fix pass on the PR branch (only if needed) → branch update + CI wait + squash-merge |
| `invariant-audit.js` | standing | seven codebase-wide finder lenses → loop until two consecutive dry rounds → 2-of-3 skeptic majority per finding |

## House patterns (reuse these when adding a workflow)

- **Schema-forced outputs.** Every agent that feeds the script returns through a JSON Schema
  (`{schema}`), never parsed prose. The severity enum lives in the schema, not in hope.
- **Adversarial verify.** No finding reaches the user un-refuted: a skeptic (or a
  perspective-diverse panel) is prompted to *kill* the finding, defaulting to refuted.
  Plausible-but-wrong is the failure mode of agent review; this is the guardrail.
- **Deterministic gates and merges.** Reviewer applicability is a path regex; dedup is a
  `file:line` map; the winner is a vote tally. If a rule matters, it is code here, not an
  instruction to a model.
- **Contradictions get adjudicated, never silently merged or picked.** Two lenses landing on
  the same `file:line` with materially different claims is a contradiction, not a duplicate —
  collapsing it into "keep the higher severity" (or, worse, concatenating both into the
  findings list, as `pr-merge-pipeline.js` did before this rule existed) either destroys one
  reviewer's evidence or ships two unreconciled claims to whoever fixes them. Any workflow that
  merges findings from more than one independent lens must detect same-location disagreement
  and run exactly one extra adjudicating pass — fresh evidence (re-read the file/diff as it
  exists now), not a re-argument of the original claims — before merging. `review-parallel.js`
  and `pr-merge-pipeline.js` both implement this; copy their pattern rather than reintroducing
  a bare `flatMap`/overwrite merge in a new workflow.
- **No silent caps.** Every skip, truncation, budget stop, and round backstop is `log()`ed.
- **Pipelines by default, barriers on purpose.** A barrier appears only where a stage truly
  needs *all* prior results (judges comparing drafts, per-round dedup) — each one carries a
  comment saying why.

## Model portability — the loop must not need a frontier driver

The system is built so the *structure* carries the quality, and the driving model only supplies
local judgment. That is what makes it portable: run the session on Sonnet 5 (or smaller) and
the loop degrades in cost, not in shape.

- **Taste is externalized.** The reviewers' judgment lives in their `.claude/agents/*.md`
  checklists (grep targets, severity tables, exact invariants), not in model capability — so
  they are pinned to `model: sonnet` in their frontmatter. Wide fan-out is always cheap,
  whatever drives the session.
- **Effort is routed, models are not.** Mechanical nodes (the scope scout) run at
  `effort: 'low'`; the hardest judgment nodes (skeptics, plan judges) inherit the session model
  at `effort: 'high'`. Scripts never hardcode a model escalation — a session without access to
  a bigger model must still run everything. Cheap wide, strong narrow.
- **Rigor is a knob, not a model.** A smaller driver compensates with more independent
  verification, not a bigger brain: `review-parallel` takes `args.skeptics` (1–3, strict
  majority must uphold); `invariant-audit` always uses a 2-of-3 panel. Schemas, path gates,
  vote tallies, and dry-round exits hold regardless of who fills the nodes.
- **Non-Claude agents get the same process.** `AGENTS.md` is the cross-tool entry point, and
  every workflow's `.claude/commands/*` counterpart is a plain-prose recipe of the identical
  loop — a harness with no Workflow tool (Cursor, Codex, anything reading `AGENTS.md`) follows
  the command manually. Same lanes, same severity bars, same memory surfaces.

Rule of thumb when adding nodes: put every rule you can into script + checklist (works on any
model), spend `effort` on verify/judge nodes (works on any Claude model), and treat model
pinning as a last resort that must never pin *upward* past `sonnet`.

## Constraints (these scripts are a third runtime)

Workflow scripts execute in the Workflow tool's sandbox — not in Node, not in the Next.js app
(see `docs/solutions/2026-07-01-workflow-scripts-are-a-third-runtime.md`):

- Plain **JavaScript only** — no TypeScript syntax; `export const meta = {...}` must be a pure
  literal (no computed values).
- Globals `agent`, `parallel`, `pipeline`, `phase`, `log`, `args`, `budget`, `workflow` are
  injected at run time — which is why `.claude/**` is excluded in `eslint.config.mjs` (the app
  linter would flag them all as `no-undef`).
- **No wall-clock or randomness** — `Date.now()`, `new Date()`, and `Math.random()` throw
  (they would break record/replay resume). Agents may run `date +%F` themselves; pass any
  needed timestamp in via `args`.
- No filesystem access from the script body; only agents touch the repo.
- `agent()` returns `null` when a node is skipped or dies — always `.filter(Boolean)`.
- **`args` may arrive as a JSON-encoded string** depending on the caller — parse defensively
  at the top of every script (see the `input` block in any roster script) or every knob
  silently falls back to its default. Caught live: a run invoked with `{base: 'main~3'}`
  reviewed against `main` because `args.base` was undefined on a stringified payload.
- The body runs inside an async function, so top-level `return`/`await` are fine — which also
  means a bare `node --check` rejects these files. Syntax-check by mimicking the wrapper:

```bash
node -e "const s=require('fs').readFileSync('.claude/workflows/<name>.js','utf8').replace('export const meta','const meta');new (Object.getPrototypeOf(async function(){}).constructor)('agent','parallel','pipeline','phase','log','args','budget','workflow',s);console.log('OK')"
```

## Adding a workflow

A new workflow is a Compound-lane artifact — it must make the *next* task cheaper, not just
this one. Checklist:

1. Name it after the job (`<verb-or-lane>.js`), start from the roster script nearest in shape.
2. Encode every rule you'd otherwise write as reviewer prose into the script: gates, schemas,
   tallies, dry-run exits.
3. Syntax-check it (above), then execute it once end-to-end via
   `Workflow({ scriptPath: '.claude/workflows/<name>.js' })` before relying on the name form.
4. Add it to the roster table here, and note the manual fallback in the matching
   `.claude/commands/*` file so the process survives harnesses without the Workflow tool.
