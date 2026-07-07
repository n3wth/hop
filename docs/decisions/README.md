# Architecture Decision Records

This folder holds **ADRs** — short, dated records of the architectural choices that shape hop.
An ADR captures *one* decision: the context that forced it, the choice we made, and the
consequences we now live with. They are the durable memory of *why* the code looks the way it
does, so a future change (human or agent) doesn't silently undo a deliberate trade-off.

These complement, not replace, the other memory surfaces:
- `CLAUDE.md` / `AGENTS.md` — the always-loaded operating rules.
- `docs/plans/` — forward-looking blueprints ("the new code").
- `docs/solutions/` — searchable, dated records of *solved problems* (bug + fix + how it's caught
  next time).
- `docs/decisions/` (here) — the *decided* shape of the system.

## When to write an ADR

Write one when a choice is **load-bearing and hard to reverse**: a boundary between systems, an
invariant the whole product depends on, a build-vs-buy, a "we will always do X / never do Y."
Don't write one for a routine implementation detail — that belongs in a `docs/solutions/` entry
or a code comment.

## Format

Lightweight ADR. Keep it to one page. Use these sections:

```md
# NNNN. Title

Status: Accepted        # Proposed | Accepted | Superseded by NNNN | Deprecated
Date: YYYY-MM-DD

## Context
What forces the decision — the constraints, the seam, the prior state. Reference real files.

## Decision
The choice, stated plainly. "We will / we will not …"

## Consequences
What this makes easy, what it makes hard, what now has to stay true, and the follow-ups it opens.
```

## Numbering

Sequential, zero-padded, never reused: `0001-...`, `0002-...`. A superseded ADR is **kept** (it
records history) — flip its `Status` to `Superseded by NNNN` and write the new one. The filename
slug is a short kebab-case summary of the decision.

## For agents and contributors

**Read the relevant ADR before changing a decided area.** If your change contradicts an accepted
ADR, that is a signal to stop and either (a) reconsider the change or (b) supersede the ADR with a
new one — not to quietly diverge. The specialized reviewers in `.claude/agents/` enforce several
of these decisions automatically (e.g. `engine-invariant-reviewer` guards ADR 0002,
`eve-architecture-reviewer` guards ADR 0001/0003); a green review does not exempt you from the ADR.

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-eve-co-located-in-repo.md) | Eve is co-located in the hop repo | Accepted |
| [0002](0002-engine-is-source-of-truth.md) | The engine is the source of truth; LLMs only narrate | Accepted |
| [0003](0003-notification-delivery-abstraction.md) | Gated, idempotent notification delivery layer | Accepted |
| [0004](0004-compound-engineering-operating-model.md) | Compound-engineering operating model | Accepted |
| [0005](0005-observed-point-valuation-sync.md) | Observed point-valuation sync | Accepted |
| [0006](0006-deterministic-orchestration-workflows.md) | Deterministic multi-agent orchestration lives in `.claude/workflows/` | Accepted |
| [0007](0007-self-improvement-loops.md) | Self-improvement loops | Accepted |
| [0008](0008-docs-canon-in-git-work-state-in-linear.md) | Documentation canon lives in git; Linear owns work state | Accepted |
| [0009](0009-tiered-autonomous-merge.md) | Tiered autonomous merge | Accepted |
| [0010](0010-single-rules-file-agents-md.md) | Single rules file: AGENTS.md is canon, CLAUDE.md imports it | Accepted |
| [0011](0011-platform-stack-rationale.md) | Platform stack: Vercel + Neon + Better Auth + Drizzle + Upstash | Accepted |
