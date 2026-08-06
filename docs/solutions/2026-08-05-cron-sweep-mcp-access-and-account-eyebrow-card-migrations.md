---
title: "Cron sweep: McpAccess and Account page Card and Eyebrow design system migrations"
date: 2026-08-05
tags: [design-system, card, eyebrow, mcp, account, refactor]
---

# Cron sweep: McpAccess and Account page Card and Eyebrow design system migrations

## Problem

During design system primitive audits (`npm run check` ESLint `no-restricted-syntax` warnings), multiple hand-rolled card recipes and uppercase tracking eyebrow headings were identified in `components/McpAccess.tsx`, `components/StandingOrders.tsx`, and `app/account/page.tsx`. Hand-rolling container styling creates inconsistencies across surfaces and risks visual drift as design tokens evolve.

## Solution

1. **McpAccess & StandingOrders Migrations**:
   - Replaced hand-rolled `div` container in `ConfigBlock` with `<Card surface="sunk" className="mt-3 px-4 py-3">`.
   - Replaced hand-rolled eyebrow label in `ConfigBlock` with `<Eyebrow className="text-text2">{label}</Eyebrow>`.
   - Updated `<StandingOrders>` warning text container to use `<Card surface="sunk" as="p">`.

2. **Account Page Eyebrow Migrations**:
   - Converted hand-rolled `Your account` hero eyebrow to `<Eyebrow onDark>Your account</Eyebrow>`.
   - Converted group section headers (`Your travel profile`, `What hop does for you`, `Developers`) to `<Eyebrow>` primitives.

3. **Verification**:
   - Ran `npm run check`: all 121 Vitest test suites (1,406 tests) passed, database migration sequences verified, zero ESLint errors.
