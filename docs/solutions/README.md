# Solved Problems

A searchable log of problems hop has already solved — the bug or seam, the root cause, the fix
(with code pointers), and **how the fix now auto-prevents the problem from coming back**. This is
the "don't solve it twice" memory surface. The point of compound engineering: each entry makes the
next agent faster, because the answer (and the guardrail) is already on disk.

This complements the other memory surfaces:
- `CLAUDE.md` / `AGENTS.md` — always-loaded operating rules.
- `docs/plans/` — forward-looking blueprints (the new code).
- `docs/decisions/` — ADRs, the *decided* shape of the system and *why*.
- `docs/solutions/` (here) — *solved problems*, so a recurrence is a grep away, not a re-debug.

## Search this directory FIRST

Before debugging or designing something that feels familiar, **grep here before you start**. The
frontmatter is built for this — `tags` and `files` are the index.

```bash
# Does a solution already touch the file I'm about to change?
grep -rl "lib/email.ts" docs/solutions/

# Search by keyword (delivery, idempotent, gated, build-isolation, …)
grep -rin "idempotent" docs/solutions/

# List every solution and its tags at a glance
grep -rA4 '^tags:' docs/solutions/*.md
```

If a match exists, read it before writing code. If your fix differs from what's recorded, either
the old entry is now wrong (update it) or you're about to reintroduce a problem it warns about.

## Frontmatter schema

Every solution file opens with this YAML block, then the prose sections:

```md
---
title: <short one-line summary of the problem solved>
date: YYYY-MM-DD
tags: [<searchable keywords — symptoms, subsystem, file stems, concepts>]
files: [<key files the solution touches, repo-relative>]
status: solved          # solved | partial | superseded
---

## Problem
What was broken or missing, in one or two sentences.

## Symptoms
The observable signal — error, no-op, failing test, wrong number, missing behavior.

## Root cause
Why it happened. The actual mechanism, not the surface.

## Solution
The approach taken, with concrete code pointers (file + function/symbol).

## How this compounds
What now auto-prevents recurrence — a reviewer agent, a test, a gate, a config exclusion,
a documented seam. The guardrail, not just the patch.
```

## Conventions

- One problem per file. Filename: `YYYY-MM-DD-kebab-slug.md`.
- `tags` carry the symptoms and subsystem so a future agent finds the entry by what they *observe*,
  not by what they already know to call it. Over-tag rather than under-tag.
- `files` lists the load-bearing paths so `grep -rl <path> docs/solutions/` surfaces the entry the
  moment someone opens that file.
- Keep it terse and factual. Point at code; don't paste large blocks. State the number/behavior.
- When a later change supersedes a solution, flip `status: superseded` and link the entry that
  replaces it — keep the old file (it records history).

## Index

| Date | Title | Tags |
|---|---|---|
| 2026-06-30 | [Standing-order crossings had no delivery channel](2026-06-30-standing-order-delivery-seam.md) | notifications, delivery, idempotent, standing-orders |
| 2026-06-30 | [Isolate the Eve scaffold from the Next.js build](2026-06-30-isolate-eve-scaffold-from-next-build.md) | eve, build-isolation, tsconfig, eslint |
| 2026-07-01 | [Workflow scripts are a third runtime](2026-07-01-workflow-scripts-are-a-third-runtime.md) | workflows, orchestration, eslint, sandbox, resume |
| 2026-07-05 | [Lightning CSS silently drops unprefixed backdrop-filter in compiled classes](2026-07-05-lightning-css-drops-unprefixed-backdrop-filter.md) | css, backdrop-filter, glass, lightning-css, tailwind-v4, prefixing, nav |
| 2026-07-06 | [A missing hook script doesn't block anything — it silently stops enforcing](2026-07-06-hooks-fail-open-on-missing-command.md) | hooks, claude-code, settings.json, fail-open |
| 2026-07-06 | [A cron route that loops over many slow calls needs its own time budget](2026-07-06-cron-route-time-budget-under-platform-maxduration.md) | cron, timeout, maxDuration, deadline |
| 2026-07-06 | [import 'server-only' passes under Next.js and throws under vitest](2026-07-06-server-only-import-breaks-vitest-not-nextjs.md) | server-only, vitest, client-boundary, bundler-aliasing |
| 2026-07-06 | [A successful network pull whose cache write then fails is still a failure](2026-07-06-cache-write-result-must-gate-success.md) | awardwallet, cache, withDb, silent-failure |
| 2026-07-06 | [A dead OAuth token, a network blip, and an empty inbox all look identical unless you say so](2026-07-06-gmail-auth-failed-vs-fetch-failed.md) | gmail, oauth, refresh-token, degradation |
| 2026-07-06 | [An expired flight watch must be skipped, not rolled forward](2026-07-06-expired-watch-skip-dont-roll.md) | standing-orders, cron, dedup, fingerprint |
| 2026-07-06 | [One correct code path querying a table can hide a broken twin](2026-07-06-fails-closed-unknown-column-masked-by-parallel-path.md) | outclicks, withDb, fails-closed, unknown-column |
| 2026-07-13 | [Formatting a time with the browser's local timezone in a server-rendered component causes a hydration mismatch](2026-07-13-ssr-client-time-formatting-hydration-mismatch.md) | nextjs, ssr, hydration, react, timezone, date-formatting |

_Note: this index is a partial, manually-kept list — several entries dated before 2026-07-06 are_
_missing from the table above. `grep -rA4 '^tags:' docs/solutions/*.md` is the reliable full list;_
_treat this table as a quick-scan convenience, not the source of truth._
