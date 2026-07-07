# Starters — drop-in kits for the agentic process

Three reference implementations of the pattern library (docs 01–09), packaged as files you
copy into an existing project. They are process kits, not app scaffolds: each contains the
rules file, autonomy runbook, worktree setup script, CI gate, mechanical merge-gate check,
and starter reviewer checklists, tuned to the stack's conventions.

| Starter | Stack | Merge gate | Preview |
|---|---|---|---|
| [`nextjs-vercel/`](nextjs-vercel/) | Next.js App Router, TypeScript, Vercel, GitHub Actions | `scripts/merge-gate.mjs` + branch protection | Vercel preview per PR |
| [`fastapi-postgres/`](fastapi-postgres/) | Python 3.12, FastAPI, Postgres/Alembic, GitHub Actions | `scripts/merge_gate.py` + branch protection | ephemeral container per PR (your platform) |
| [`google3/`](google3/) | illustrative google3-style monorepo | submit rule over per-directory `risk_tier` | per-CL staging job |

## Installing an OSS starter

1. Copy the starter's contents into your repo root (merge `.github/workflows/` with what you
   have; don't overwrite an existing `AGENTS.md`, fold the sections in).
2. Fill every `TODO(project)` marker — hold-list paths, tracker name, gate command.
3. Wire branch protection: require the `check` workflow; block direct pushes to the default
   branch.
4. Run `scripts/setup-worktree.sh` once yourself to confirm the mock-mode path works with no
   credentials.
5. Delete reviewer checklists that don't apply; write one that does, from your last
   quarter's recurring review comments.

Adopt in the order of the porting guide (doc 09): loop first, machine review second,
scheduled autonomy and auto-merge last. The runbook ships with `Auto-merge: off`.

## The google3 starter

Internal infrastructure isn't reproducible in public files, so `google3/` is an annotated
example rather than runnable config: what each artifact maps to (dir metadata, presubmit
analyzers, the team policy g3doc) and worked examples of each in plausible syntax. Treat it
as a design sketch to hand your infra team alongside doc 09's mapping table.
