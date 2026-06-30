---
title: Isolate the eve/ agent scaffold from the Next.js typecheck/lint/build
date: 2026-06-30
tags: [eve, build-isolation, tsconfig, eslint, vitest, next-build, separate-runtime, framework-imports, ci]
files: [eve/, tsconfig.json, eslint.config.mjs, vitest.config.ts, eve/README.md, eve/tsconfig.json]
status: solved
---

## Problem

The `eve/` agent scaffold is a **separate runtime** built on Vercel Eve. Its files import the
`eve` framework (`eve/tools`, `eve/schedules`, `eve/context`) and use APIs that are not in the
Next.js app's dependency tree. The app's `tsconfig.json` `include` is `**/*.ts` — so left alone,
`eve/**` would be pulled into the app's type-check, lint, and `next build` graph.

## Symptoms

- `npx tsc --noEmit` would fail on `eve/**`: unresolved module `eve/tools`, unknown
  `defineAgent`/`defineTool`/`defineSchedule` types, and engine imports written as repo-relative
  paths (`../../lib/*`) rather than the app's `@/*` alias.
- `npm run lint` would flag the same files.
- `npm run build` (which also surfaces RSC/route errors) would choke on a runtime it was never
  meant to compile, coupling the app's build to whether Eve's deps happen to be installed.

## Root cause

Co-location was a deliberate choice (ADR 0001): Eve lives *in* the hop repo so its tools can import
hop's `lib/*` engine directly, exactly as the existing standing-orders cron already does. But
co-location in the same repo is not the same as co-compilation. The Next app's broad `**/*.ts`
glob doesn't distinguish "the app" from "a sibling runtime that happens to share the engine," so
the two toolchains would collide unless the boundary is declared.

## Solution

Declare the boundary in every place the app's toolchain scans, so `eve/**` is documentary against
Eve's own API surface and never enters hop's build:

- **`tsconfig.json`** — `eve/**` added to `exclude` (alongside `node_modules`). The app never
  type-checks Eve. Eve keeps its **own** `eve/tsconfig.json` for its runtime.
- **`eslint.config.mjs`** — `eve/**` added to `globalIgnores([...])`, with an inline comment
  pointing at `eve/README.md` so the reason travels with the rule.
- **`vitest.config.ts`** — already scoped to collect only `lib/**/*.test.ts` and
  `app/**/*.test.ts`, so Eve was never in the test graph; no change needed, but it's part of the
  same invariant (the three toolchains all stop at the app boundary).
- **The shared surface is exactly one thing:** the `lib/*` engine, imported into Eve via
  repo-relative paths (e.g. `import { assembleSearch } from '../../lib/search'`), **not** the
  app's `@/*` alias. The external MCP server (`app/api/[transport]/route.ts`, `hop_` tokens) stays
  as the path for third-party agents.

## How this compounds

- **The boundary is written down where it's enforced and where it's explained.** The `eve/**`
  exclusion carries a comment in `eslint.config.mjs`, the full rationale lives in `eve/README.md`
  ("Why this is build-isolated from the Next.js app"), and this solution entry is the grep target —
  so a future agent that opens `tsconfig.json` or searches `eve build` finds the answer before
  re-adding `eve/` to the build graph.
- **Reversal is loud, not silent.** Removing the exclusion immediately breaks `tsc`/`lint`/`build`
  on Eve's framework imports — the failure *is* the guardrail. There's no quiet way to recouple the
  runtimes.
- **Cheap to extend.** Any future sibling runtime follows the same recipe: keep its own config,
  add it to the app's `exclude` + `globalIgnores`, share only `lib/*` by relative import.
- See `docs/decisions/0001-eve-co-located-in-repo.md` for the co-location decision this isolates.
