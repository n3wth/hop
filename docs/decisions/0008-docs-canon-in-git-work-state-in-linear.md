# 0008. Documentation canon lives in git; Linear owns work state

Status: Accepted
Date: 2026-07-04

## Context

With the business plan mirrored into Linear (project `hop`, team `n3wth` — phase milestones,
R/B-epic issues with embedded pickup prompts, a project summary document), documentation now
visibly lives in two places, and the obvious question followed: should it all move to Linear as
living documents instead of being split?

The forces, grounded in how this repo actually operates:

- **Coding agents load git docs for free.** `CLAUDE.md`/`AGENTS.md` are injected into every
  session automatically; `docs/plans/`, `docs/solutions/`, `docs/decisions/`, and
  `docs/design/*` are one Grep/Read away in any harness — Claude Code, Cursor, CI, cron.
  Linear docs require a working MCP connection *and* an agent that thinks to query it. This is
  not hypothetical: the session that produced the 2026-07-03 critical-review roadmap could not
  write to Linear at all (its Part 4 mirroring had to ship as a paste-ready prompt), and
  interactively-authenticated MCP servers are routinely absent in headless runs.
- **Git docs change atomically with the code they describe.** A PR that changes cpp tiers can
  update the spec in the same diff, and the reviewer agents in `.claude/agents/` check code
  against the canon (`copy-spec`, the ADRs, `DESIGN-SYSTEM.md`). The repo's known failure mode —
  the canon misdescribing shipped code (see the DESIGN-SYSTEM drift, roadmap R2.5) — gets worse
  in a store with no diffs, no review lane, and no blame.
- **"All in Linear" is unreachable anyway.** `CLAUDE.md`, `AGENTS.md`, `.claude/*`, and
  everything they reference must stay in the repo for the harness to function. Migrating the
  rest would move the seam, not remove it.
- **Linear is genuinely better at work state.** Issues, priorities, `blockedBy` relations,
  milestones — living data that git is bad at, and precisely what the 2026-07-04 mirror put there.

## Decision

- **Git is canon for anything an agent needs to *build correctly*:** plans, ADRs, solutions,
  design/copy canon, runbooks. These are reviewed in PRs and versioned with the code they
  describe.
- **Linear is canon for *work state*:** the queue, priorities, blockers, milestones, status.
  Issue bodies carry pointers, acceptance criteria, and pickup prompts — never the spec itself.
- **References are one-way.** Linear links into git for content (e.g. "source:
  `docs/plans/2026-07-04-business-plan.md` §3"); git names Linear only as "the queue." Where an
  issue duplicates substance for convenience, it must say which repo file governs.
- **Automation flows repo → Linear, not the reverse.** The sanctioned way to make Linear feel
  "living" is generation from repo/ledger state — the ADR 0007 class-(a) pattern already files
  Linear issues from deterministic templates, and a status update generated from engine ledgers
  is the same shape. No process treats a Linear document as the source that repo docs must be
  reconciled against.

## Consequences

- Easy: any agent in any harness can build correctly from a clone alone; docs ride the existing
  review lane; doc drift stays catchable by the reviewers; Linear outages or missing MCP auth
  degrade only *visibility of the queue*, never buildability.
- Hard: the mirror can go stale — when a plan changes materially, the touching PR should update
  the affected Linear issues (or say why not), and the weekly digest is the natural place to
  flag divergence. Accepted cost: convenience copies in issue bodies are second-class and may
  lag; the governs-pointer is the tiebreak.
- Supersede this only if the operating model changes such that most build work no longer happens
  in repo-attached agent sessions — in that world, re-run this trade-off from scratch rather
  than migrating piecemeal.
