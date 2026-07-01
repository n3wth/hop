---
title: Workflow scripts are a third runtime — lint-isolate them and avoid wall-clock
date: 2026-07-01
tags: [workflows, orchestration, eslint, no-undef, sandbox, resume, top-level-return, build-isolation]
files: [.claude/workflows/review-parallel.js, .claude/workflows/README.md, eslint.config.mjs]
status: solved
---

## Problem

Adding orchestration scripts under `.claude/workflows/` (ADR 0006) introduces `.js` files that
are neither app code nor Node scripts — they execute in the Workflow tool's sandbox.

## Symptoms

- `npm run lint` flags every script line as `no-undef` (`agent`, `pipeline`, `phase`, `log`,
  `args`, `budget` are injected at run time, so ESLint sees undeclared globals).
- `node --check` rejects the files with `SyntaxError: Illegal return statement` — the sandbox
  wraps the body in an async function, so top-level `return`/`await` are valid there but not in
  a bare module.
- A script calling `Date.now()`, `new Date()`, or `Math.random()` throws at run time: the
  sandbox bans them because they would break record/replay resume.

## Root cause

Three runtimes now live in this repo (Next.js app, Eve/workerd scaffolds, Workflow sandbox) but
the app's toolchain claims every `.js` file by default. The sandbox's contract (injected
globals, async-function body wrap, deterministic replay) is invisible to Node and ESLint.

## Solution

- `eslint.config.mjs`: added `.claude/**` to `globalIgnores` — the same isolation precedent as
  `eve/**` and `cloudflare/**`. (tsconfig only includes `**/*.ts(x)`, so tsc never saw them.)
- Scripts never touch wall-clock or randomness; agents run `date +%F` themselves when a date is
  needed (see `plan-panel.js`'s synthesis prompt), and any timestamp comes in via `args`.
- Syntax-check by mimicking the wrapper (recipe in `.claude/workflows/README.md`), not with
  `node --check`.

## How this compounds

The constraints are documented in `.claude/workflows/README.md` §Constraints, which the "Adding
a workflow" checklist forces through a syntax-check + one end-to-end `scriptPath` run before a
workflow may be invoked by name — so a script violating the sandbox contract fails at authoring
time, not mid-review. `grep -rl workflows docs/solutions/` surfaces this entry the moment
someone opens the folder.
