---
title: "Vitest test timeouts under parallel test execution for sequential search orchestration"
date: "2026-07-30"
tags: [vitest, testing, rate-limiting, search-orchestration, timeout]
files: [lib/__tests__/shared-verdicts.test.ts]
status: solved
---

## Problem
During full test suite sweeps (`npm run check` / `npm test`), `lib/__tests__/shared-verdicts.test.ts` occasionally timed out on the rate-limit test (`enforces rate limits`) exceeding Vitest's default 5000ms limit.

## Symptoms
- `FAIL lib/__tests__/shared-verdicts.test.ts > shareVerdict orchestration & rate limits > enforces rate limits`
- `Error: Test timed out in 5000ms.`
- Test passed reliably when executed individually (`npx vitest run lib/__tests__/shared-verdicts.test.ts`), but failed intermittently under concurrent CPU load during full test sweeps.

## Root cause
The rate-limiting test calls `shareVerdict` 6 times sequentially to exhaust capacity. `shareVerdict` invokes `assembleSearch` on each iteration. In parallel test runs with high CPU utilization, 6 sequential search invocations exceed 5,000ms total wall-clock time.

## Solution
1. Explicitly configured a 15,000ms timeout for the rate-limiting test in `lib/__tests__/shared-verdicts.test.ts` (`it('enforces rate limits', async () => { ... }, 15000)`).
2. Verified `npm run check` runs 100% green (121 test files, 1414 tests passing).

## How this compounds
- Prevents false-positive CI/check failures during full parallel Vitest test sweeps.
- Documents the pattern for multi-invocation orchestration tests.
