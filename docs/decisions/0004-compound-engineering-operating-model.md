# 0004. Compound-engineering operating model

Status: Accepted
Date: 2026-06-30

## Context

hop is built largely with agents. Without an operating model, agent work is one-shot: a fix lives
only in a diff, a gotcha is re-derived next quarter, and review is improvised differently every
time. As the surface area grows (the engine, Eve, delivery, multiple channels), the cost of
re-learning what we already knew compounds *against* us.

[Compound engineering](https://every.to/guides/compound-engineering) inverts that: **"each unit of
work should make subsequent work easier,"** and **"teach the system, don't do the work yourself."**
The lever is persistent memory and automatic safety nets, not heroics in review.

## Decision

**Adopt the Plan → Work → Review → Compound loop as how we (humans and agents) build hop, with a
roughly 40% / 10% / 40% / 10% time split, and a 50/50 rule: half the effort ships features, half
improves the system that ships them.** Each lane has a concrete home in the repo:

- **Plan (40%) — "plans are the new code."** Research the codebase + the Next.js 16 docs in
  `node_modules/next/dist/docs/`, then write a blueprint to `docs/plans/` *before* writing code.
  Driven by `.claude/commands/plan.md`. The Eve design doc (`docs/plans/2026-06-30-eve-agent.md`)
  is the model.
- **Work (10%).** Execute the plan. It should be the smallest lane — a good plan makes the work
  mechanical.
- **Review (40%) — "build safety nets, not review processes" and "taste belongs in systems, not in
  review."** `.claude/commands/review-parallel.md` dispatches hop's standing specialized reviewers
  over the same diff, each in its own context, **in parallel**, then merges findings into one
  P1/P2/P3 list and fixes P1s in isolation. The reviewers in `.claude/agents/` are:
  `engine-invariant-reviewer` (ADR 0002), `eve-architecture-reviewer` (ADR 0001/0003),
  `degradation-reviewer`, `copy-voice-reviewer`, `nextjs16-reviewer`, and `security-reviewer`.
- **Compound (10%) — "teach the system."** `.claude/commands/compound.md` turns each lesson into
  persistent memory: a searchable `docs/solutions/<date>-<slug>.md` entry (YAML frontmatter:
  `title`/`date`/`tags`/`severity`/`files`/`reviewer`), and — where the rule is durable — a
  promotion into `CLAUDE.md`, a new ADR here, or a new check in a `.claude/agents/` reviewer so the
  issue auto-catches next time.

**Persistent memory lives in four places**, each with a distinct job: `CLAUDE.md` (always-loaded
rules) · `docs/decisions/` (ADRs — *why* the system is shaped this way) · `docs/solutions/`
(searchable solved problems) · `docs/plans/` (forward blueprints).

## Consequences

- **Every fix pays forward.** A bug fixed in the Work lane is captured in the Compound lane as a
  solution entry and, if durable, as a reviewer check — so the same class of bug is caught
  automatically next time instead of re-debugged.
- **Review is a system, not an opinion.** Adding coverage means adding/strengthening a reviewer in
  `.claude/agents/`, not remembering to look for something by hand. Reviewers run in parallel over
  one captured diff, so a change is judged the same way every time.
- **ADRs are part of the loop, not a side artifact.** The Compound lane promotes durable decisions
  into this folder; the Plan and Review lanes are expected to read the relevant ADR before
  changing a decided area (see `docs/decisions/README.md`).
- **The 50/50 rule is a budget, not a slogan.** Half of effort goes to the meta-system — plans,
  reviewers, solutions, ADRs, CLAUDE.md — because that is what makes the feature half compound.
- **`docs/solutions/` starts empty and grows.** It is the searchable record; greps and agents find
  prior fixes by tag/title. Keeping its entries factual and dated (per `docs/README.md`
  conventions) is what makes the memory useful rather than noisy.
