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
| `review-parallel.js` | Review | one captured diff → six path-gated reviewers in a pipeline → one adversarial skeptic per finding → merged P1/P2/P3 |
| `plan-panel.js` | Plan | three blueprint drafts from forced-diverse lenses → three-judge panel with a deterministic tally → one synthesis written to `docs/plans/` |
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
- **No silent caps.** Every skip, truncation, budget stop, and round backstop is `log()`ed.
- **Pipelines by default, barriers on purpose.** A barrier appears only where a stage truly
  needs *all* prior results (judges comparing drafts, per-round dedup) — each one carries a
  comment saying why.

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
