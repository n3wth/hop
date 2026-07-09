---
title: .claude/ reviewer subagents kept describing the pre-migration stack after ADR 0011
date: 2026-07-09
tags: [agents, claude-code, security-reviewer, nextjs16-reviewer, degradation-reviewer, migration, drift, adr-0011, better-auth, drizzle]
files: [.claude/agents/security-reviewer.md, .claude/agents/nextjs16-reviewer.md, .claude/agents/degradation-reviewer.md, .claude/commands/plan.md, .claude/commands/review-parallel.md, .claude/commands/add-eve-workflow.md, .claude/workflows/review-parallel.js, docs/plans/auth-db-migration.md]
status: solved
---

## Problem

After ADR 0011 shipped (Auth0 + Supabase → Better Auth + Neon + Drizzle), several `.claude/`
reviewer/command/workflow files still described the old stack: `security-reviewer.md` told the
reviewer to read `middleware.ts` and `utils/supabase/admin.ts` (neither exists) and framed
identity as "Auth0 `sub`" with "service-role bypasses RLS"; `nextjs16-reviewer.md`'s "Middleware
vs proxy" check assumed a `middleware.ts` matcher that was deliberately removed;
`degradation-reviewer.md` told the reviewer to grep for Supabase `createClient`/`.from(` calls,
which can't appear — there's no `@supabase/supabase-js` in `package.json` at all anymore.

## Symptoms

None of this is caught by `npm run check` or CI — these are prose instruction files, not code.
A reviewer subagent invoked on an unrelated diff would waste a turn reading files that don't
exist and reasoning about a threat model (RLS bypassed by a service-role key) that no longer
applies to a plain Neon/Drizzle database, and could produce confused or wrong findings as a
result. Nothing flags this until a human (or a careful agent) notices the reviewer citing a file
that `ls` can't find.

## Root cause

A platform migration (ADR 0011) changes the underlying architecture, but nothing forces
`.claude/agents/*`, `.claude/commands/*`, `.claude/workflows/*.js` to be re-audited against the
new decision — they're natural-language instructions to LLM agents, so no compiler, typecheck,
or test suite catches drift the way it would in application code.

## Solution

Rewrote the affected sections to match Better Auth + Neon/Drizzle, citing
`docs/decisions/0011-platform-stack-rationale.md` as ground truth: identity is the Better Auth
`user.id` (`lib/session.ts#getUserId`, with `lib/auth0.ts` as a documented compat shim), there is
no `middleware.ts` (`app/api/auth/[...all]/route.ts` serves the whole auth surface), and DB
scoping has no RLS to fall back on because there's no Supabase client — `withDb`
(`lib/supabase-helpers.ts`) is the only chokepoint. Also flagged
`docs/plans/auth-db-migration.md` (Status: planned) as executed/superseded so it stops being
cited as the current architecture. (PR #276.)

## How this compounds

Added a line to `AGENTS.md`'s "Multi-agent hygiene" bullet: when an ADR supersedes a platform or
architecture decision, grep `.claude/agents/`, `.claude/commands/`, and `.claude/workflows/` for
the old stack's terms and update reviewer instructions in the same PR that lands the ADR.

**Residual risk**: this is a documented convention, not an automated safety net — no code path
can verify prose against reality. The `/audit` sweep (`invariant-audit.js`) already checks
"AGENTS.md claims gone stale" against the memory surfaces; if this recurs, extend that sweep to
also grep `.claude/agents/*` and `.claude/commands/*` for terms tied to a superseded ADR.
