# 10 — Single source of truth for facts

## Pattern

Doc culture already knows how to solve *rules* duplication: one rules file, everything else
imports it (doc 01; this repo's ADR 0010 — `AGENTS.md` is canon, `CLAUDE.md` imports it). *Facts*
are a different problem. A fact — "the identity system is X," "this cron runs every 6h," "this
env var is required" — legitimately has many natural owners, because each fact is decided or
generated somewhere specific: an ADR for an architecture choice, a scheduler config for a cron
time, a roster file for an org chart. The failure mode isn't having many files. It's a **second**
file *restating* a fact its owner already states, instead of *pointing* at the owner. A
restatement is a fork: the day the fact changes, only the owner gets updated, and every
restatement quietly goes stale until an agent reads one as current truth.

This matters more for agents than it ever did for human readers. A human skimming a stale
paragraph usually has enough tacit context to sense something's off. An agent takes the
paragraph as ground truth, greps for a file it names, and either fails confusingly or — worse —
succeeds at reasoning correctly from a false premise.

## Case study — hop, ADR 0011

When hop replaced Auth0 + Supabase with Better Auth + Neon + Drizzle, the new architecture had
exactly one owner: `docs/decisions/0011-platform-stack-rationale.md`. By the time the drift was
caught, the *same* now-wrong facts — "identity is the Auth0 `sub`," "service-role bypasses RLS,"
"migrations are typed in `utils/supabase/admin.ts`" — had been independently retyped into **four**
other files agents read as live instructions: two `.claude/agents/*` reviewer prompts, the
always-loaded `docs/agent-playbook.md`'s invariants section, and `docs/cloud-env.md`'s
environment-variable template. None cited the ADR; each had copied the fact fresh at the time it
was written and none was touched when the ADR landed. A reviewer subagent invoked months later
went hunting for a file (`middleware.ts`) that had been deliberately deleted, and reasoned about a
security boundary (RLS) that no longer existed. Full writeup:
`docs/solutions/2026-07-09-stale-claude-agent-instructions-after-platform-migration.md`.

## How to tell a restatement from a reference

- **Reference (safe)**: "Identity is Better Auth `user.id` — see ADR 0011." One clause, a
  pointer, no independent claim that can go stale on its own.
- **Restatement (unsafe)**: re-deriving the mechanism in prose that reads standalone — which
  files are involved, which env vars matter, what the security model is. If the sentence could be
  quoted back as evidence months later, independent of the file it's describing, it's a
  restatement.

The test: **could this sentence become wrong without anyone editing the file it's in?** If yes,
this file doesn't own it — it's a stale-dated copy waiting to happen.

## Where restatements hide

Descriptive claims cluster in exactly the doc classes agents read as ambient truth, not code:

- **Rules/judgment files** read fresh every session (`AGENTS.md`, `docs/agent-playbook.md`) —
  highest cost per stale line, because it's consulted unconditionally.
- **Reviewer/agent prompts** (`.claude/agents/*`, or any per-tool equivalent) — a stale prompt
  doesn't just mislead once, it actively directs a search toward files that no longer exist.
- **Environment/setup templates** (`docs/cloud-env.md` and siblings) — stale variable names cost
  real setup time, not just a wrong sentence.
- **Historical plans** (`docs/plans/*.md`) are the deliberate exception: they're dated snapshots
  of what was true when written, not living truth, so they're *allowed* to go stale. Mark the
  doc `Status: executed` / `superseded by <ADR>` and point at the fact's real owner instead of
  editing history in place — see the banner added to `docs/plans/auth-db-migration.md`.

## Fix

1. Find every restatement: grep the old fact's vocabulary (old library/file names, old security
   model terms) across every doc class above — not just the file you started in. A single-file
   fix is exactly how this class of bug survives.
2. Replace each with a one-clause pointer to the fact's actual owner.
3. Add the grep target to whichever rule should have caught this — a reviewer checklist line, an
   `AGENTS.md`/playbook bullet — so the *next* migration doesn't recreate the same fork
   (this repo's instance: the "Multi-agent hygiene" bullet in `AGENTS.md`).

## Porting to a google3-style stack

The analogous failure is a design doc or onboarding wiki page that re-explains a system already
documented in its own g3doc, instead of linking it — common because wiki search surfaces the
copy, not the canonical page, and nobody owns cross-doc consistency. The fix ports directly:
treat "no independent claims that could go stale alone" as a review norm (a CL that re-explains
another system's internals instead of linking its g3doc gets a review comment), and require a
migration CL's author to grep the old system's name across the wiki/g3doc tree in the same CL —
the same discipline this repo's `AGENTS.md` now requires for `.claude/` on every superseding ADR.
