# Agentic development — a portable pattern library

These docs describe how this repo develops itself, written as stack-agnostic patterns so the
same process can be implemented elsewhere — anywhere from a single git repo to a
google3-style monorepo. The patterns come from hop's working system (ADRs 0002, 0004,
0006–0009). Each doc states the pattern, shows hop's concrete instance, and ends with notes
on porting it to conventional large-company infrastructure.

## Summary

Agents do most of the coding. Each task runs in an isolated workspace branched from trunk and
produces one PR, which gets CI, a preview deployment, and machine review (specialized
reviewer agents dispatched by a checked-in script, findings verified by a skeptic pass before
a human sees them). PRs merge autonomously only when a mechanical predicate passes and no
changed path is on a hold list; irreversible surfaces (money, auth, schema, secrets, CI
config, dependencies) always wait for a human. Every run ends by writing what it learned back
into the repo — docs, rules, reviewer checks — so later runs start from a better baseline.
The rule underneath all of it: agents fill judgment nodes; checked-in code computes
everything between them.

## The documents

| Doc | Covers |
|---|---|
| [01-principles.md](01-principles.md) | The two rules the rest derives from: compound the lessons; compute everything between judgments. |
| [02-isolated-workspaces.md](02-isolated-workspaces.md) | One task, one disposable workspace off trunk. Never commit to trunk. |
| [03-pr-pipeline.md](03-pr-pipeline.md) | One task → one PR, with CI, preview deployment, and machine review attached automatically. |
| [04-machine-review.md](04-machine-review.md) | Specialized reviewers selected by path rules, schema-typed findings, skeptic verification. |
| [05-tiered-auto-merge.md](05-tiered-auto-merge.md) | The merge predicate, the path hold list, the kill switch. |
| [06-autonomy-runbook.md](06-autonomy-runbook.md) | The runbook unattended runs read every time, and how amending it improves the loop. |
| [07-compounding-memory.md](07-compounding-memory.md) | Where lessons go: solutions library, ADRs, rules files, logs. |
| [08-self-healing.md](08-self-healing.md) | Health detection from existing computations; auto-filed work items; triage-before-building. |
| [09-porting-guide.md](09-porting-guide.md) | Staged adoption path for a new codebase, including a google3 mapping. |
| [starters/](starters/README.md) | Drop-in kits implementing the library: `nextjs-vercel/`, `fastapi-postgres/`, and an illustrative `google3/`. |

## Provenance

hop is the reference implementation. Decisions: `docs/decisions/` (0002, 0004, 0006, 0007,
0008, 0009). Operating procedure: `docs/autonomy-runbook.md`. Executable orchestration:
`.claude/workflows/`. Where these docs and an ADR disagree, the ADR wins for hop; these docs
are the generalization.
