---
title: "Cron sweep audit — Vitest orchestration test timeouts, design system Eyebrow migrations, and ADR 0009 hold compliance"
date: "2026-08-03"
tags:
  - cron
  - autonomy
  - vitest
  - design-system
  - adr-0009
  - verification
---

# Cron sweep audit — Vitest orchestration test timeouts, design system Eyebrow migrations, and ADR 0009 hold compliance

## Context

During the 3-hour scheduled maintenance sweep across `hop.flights`, we audited open pull requests, processed queued agent branches, implemented design system primitive migrations, verified full check and build cleanliness, and adhered strictly to ADR 0009 hold policies.

## Key Findings & Lessons Learned

### 1. Vitest Test Timeouts in Multi-Invocation Orchestration Tests

When running full test suite sweeps (`npm run check`), `lib/__tests__/shared-verdicts.test.ts` executes sequential search orchestrations to exhaust rate limits. Under high CPU load in parallel Vitest runs, 6 sequential invocations can exceed Vitest's default 5,000ms limit (measured at ~9.5s).

**Fix**: Explicitly configured a 15,000ms timeout on the rate-limit test (`it('enforces rate limits', async () => { ... }, 15000)`). PR #390 landed this fix and documented the pattern.

### 2. Design System Primitive Migration (Auth Eyebrows)

ESLint static analysis surfaced hand-rolled uppercase kicker labels across login, forgot-password, and reset-password auth views.

**Fix**:
- Migrated hand-rolled kicker elements in `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`, and `app/login/page.tsx` to `<Eyebrow as="p" onDark>` and `<Eyebrow>`.
- Preserved exact typography scaling (`text-[11px] font-semibold uppercase tracking-[var(--track-eyebrow)]`) while using the design system primitive.
- Shipped via PR #391.

### 3. Verification & Build Integrity

Running `npm run check` across 121 test files (1,414 unit/integration tests) confirmed 100% test pass rate, clean migration sequence checking, and zero ESLint errors across the codebase.

### 4. ADR 0009 Hold List Compliance

PR #373 modifies `.github/workflows/data-refresh.yml` and `docs/autonomy-runbook.md`. Under ADR 0009, changes to `.github/workflows/**` and autonomy kill-switch controls are held strictly for human owner review. The sweep correctly left PR #373 open without force-merging.

## Verification

- `npm run check` passed all 121 test files (1,414 tests).
- PR #388, PR #389, PR #390, and PR #391 armed with auto-merge on green.
