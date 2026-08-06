---
title: "Autonomous cron sweep: migrating user account programs, watches, status managers, and balance paste to Card primitives"
date: 2026-08-04
tags: [design-system, primitives, card, account, refactoring]
---

# Autonomous cron sweep: migrating user account programs, watches, status managers, and balance paste to Card primitives

## Problem

Several user-facing account management sections (`StandingOrders`, `ProgramLogins`, `AirlineStatusManager`, `BalanceSyncPaste`) were still using hand-rolled raw HTML containers (`<section className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">` or `<div className="rounded-[var(--radius)] border border-border bg-surface...">`) rather than the design system's server-renderable `<Card>` primitive (`components/ui/Card.tsx`).

## Solution

1. Refactored `StandingOrders.tsx` (`WatchComposer`, empty `WatchList`, active `WatchList`) to render `<Card surface="surface">`.
2. Refactored `ProgramLogins.tsx` to wrap the program logins rail with `<Card surface="surface">`.
3. Refactored `AirlineStatusManager.tsx` (elite status overview & sync suggestions rail) to wrap both panels with `<Card surface="surface">`.
4. Refactored `BalanceSyncPaste.tsx` to wrap the paste rail with `<Card surface="surface">`.
5. Verified complete test suite (121 Vitest test files, 1,414 tests passing), ESLint, TypeScript typecheck, and migration sequence cleanly via `npm run check`.
