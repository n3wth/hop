---
title: "Autonomous cron sweep: resolving design system PR rebase conflicts and unblocking pending Vercel checks"
date: "2026-08-02"
tags: [autonomy, ci, design-system, merge-pipeline, rebase, adr-0009]
files: [app/deals/page.tsx, app/points/[amount]/page.tsx, components/ui/Card.tsx, components/ui/Eyebrow.tsx]
status: solved
---

## Problem
Five sequential design-system migration PRs (#378, #379, #380, #381, #382) were open and blocked behind a stuck `Vercel: pending` status check on GitHub caused by a GitHub App identity mismatch (N-389). Additionally, PRs #381 and #382 had developed merge conflicts on `app/deals/page.tsx`, `app/points/[amount]/page.tsx`, and component primitives after earlier PRs merged into `main`.

## Symptoms
`gh pr merge` failed with `Required status check "Vercel" is pending` or `GraphQL: Pull Request has merge conflicts`.

## Root cause
1. External Vercel GitHub App identity split (`in/8329` vs `oa/1157143`) left the required status check context in `PENDING` state on GitHub branch protection rules, despite builds passing on Vercel and local checks passing.
2. Concurrent design-system PRs branching from common ancestral commits touched overlapping route files (`app/deals/page.tsx`, `app/points/[amount]/page.tsx`) with independent primitive migrations.

## Solution
1. Executed `npm run check` locally on `main` to verify lint, typecheck, migration sequence, and all 1,414 vitest unit tests passed as the authoritative pre-ship gate (per ADR 0009 and `docs/solutions/2026-07-28-cron-sweep-automation-and-merge-hold-policies.md`).
2. Sequentially merged PRs #378, #379, #380 using admin privileges.
3. Rebased PR #381 (`feat/design-system-pages-card-migrations`) onto `main`, resolved JSX conflicts in `app/deals/page.tsx` and `app/points/[amount]/page.tsx` combining both `<Button>` and `<Card surface="surface">` changes, force-pushed, and merged.
4. Rebased PR #382 (`feat/design-system-components`) onto `main`, force-pushed, and merged cleanly.
5. Re-ran full local verification `npm run check` on `main` (all 121 test files / 1,414 tests green).

## How this compounds
- Clears 5 open design-system migration PRs from the queue, completing the `<Card>` and `<Eyebrow>` primitive adoption across public routes and core components.
- Reinforces the ADR 0009 pattern that local `npm run check` is the ground truth when external status check apps are mismatched or wedged.
- Documents exact merge-conflict resolution patterns when combining concurrent primitive refactors.
