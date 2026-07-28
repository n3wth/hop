---
title: LLM cost telemetry integration into unit economics and explicit ops-runbook billing gate alignment
date: 2026-07-27
tags: [admin, unit-economics, ops, billing, telemetry]
files: [lib/unit-economics.ts, lib/__tests__/unit-economics.test.ts, docs/ops-runbook.md]
status: solved
---

## Problem

1. **Hardcoded null for LLM spend**: `lib/unit-economics.ts` hardcoded `llmCostUsd: null` in the `/admin` unit economics response and excluded LLM costs from contribution margin calculations even when monthly LLM cost estimates were available in environment configuration (`HOP_LLM_COST_MONTHLY_USD`).
2. **Implicit billing gate status**: `docs/ops-runbook.md` listed how to turn `HOP_ENABLE_BILLING` on or off, but did not explicitly document the current status of business-plan §3.1's four hard gates required before flipping billing live in production.

## Solution

1. **LLM Cost Support in Unit Economics (`lib/unit-economics.ts`)**:
   - Added `readLlmCostMonthlyUsd()` to check `HOP_LLM_COST_MONTHLY_USD` from environment variables, returning a non-negative number or `null`.
   - Updated `UnitEconomics` interface type for `llmCostUsd` from `null` to `number | null`.
   - Updated `contributionUsd` calculation in `computeUnitEconomics()` to subtract `llmCostUsd ?? 0` from MRR along with infrastructure costs.
   - Added unit tests in `lib/__tests__/unit-economics.test.ts` for environment variable parsing and null fallback behaviors.

2. **Ops Runbook Billing Gate Status (`docs/ops-runbook.md`)**:
   - Explicitly added the status of the 4 §3.1 billing gates in `docs/ops-runbook.md`:
     - R0.1 multi-pax cpp fixed: Passed
     - R0.2 single tested Stripe lane with real purchase: Passed
     - R0.4 + R1.3 alerts firing reliably: Passed
     - R3.1 seats.aero written commercial terms: Pending/Blocked (awaiting commercial terms response or fallback award source)

## Verification

- `npx vitest run lib/__tests__/unit-economics.test.ts` passed 7/7 unit tests.
- `npm run check` passed clean across all 113 test files and 1,358 tests.
