---
title: "Autonomous cron sweep: Admin consoles design system primitive migrations & pre-ship verification"
date: "2026-08-03"
tags: [autonomy, design-system, card-primitive, eyebrow-primitive, cron-sweep, admin-consoles]
files:
  - components/admin/OpsPanel.tsx
  - components/admin/SupportConsole.tsx
  - components/admin/BillingConsole.tsx
  - components/admin/AgentActivity.tsx
  - components/admin/TeamPanel.tsx
  - components/admin/UserDetail.tsx
---

# Autonomous cron sweep: Admin consoles design system primitive migrations & pre-ship verification

## Problem / Background
During the scheduled 3-hour cron sweep, repo state and open PRs were evaluated. No pending green PRs were open for automatic merge (PR #373 remains correctly held per ADR 0009). Continuing the queued design system primitive migration plan, internal administration console components (`OpsPanel.tsx`, `SupportConsole.tsx`, `BillingConsole.tsx`, `AgentActivity.tsx`, `TeamPanel.tsx`, `UserDetail.tsx`) contained hand-rolled Card elements (`rounded-[14px] border border-border bg-paper`, `rounded-[var(--radius-sm)] border border-border bg-paper`) and hand-rolled Eyebrow headings (`text-[11px] font-bold uppercase tracking-[var(--track-eyebrow)] text-brand`), generating ESLint design-system warnings.

## Resolution
1. **Design System Primitive Migrations**:
   - Refactored `OpsPanel.tsx`: converted Preflight rows, Outclick rows, Degradation rows, Valuation Sync rows, Active Watches rows, and MiniStat tiles to `<Card surface="paper">` and section headings to `<Eyebrow as="h2">`.
   - Refactored `SupportConsole.tsx`: converted TicketCard and EscalationCard containers to `<Card surface="paper" radius="md">` and section headings to `<Eyebrow as="h2">`.
   - Refactored `BillingConsole.tsx`: converted subscription list cards and summary tiles to `<Card surface="paper">` and section headings to `<Eyebrow as="h2">`.
   - Refactored `AgentActivity.tsx`: converted findings, tickets, top callers, token inventory, and stat tiles to `<Card surface="paper">` and section headings to `<Eyebrow as="h2">`.
   - Refactored `TeamPanel.tsx`: converted drafts section, open items section, team member cards, and section labels to `<Card surface="paper">` and `<Eyebrow>`.
   - Refactored `UserDetail.tsx`: converted program balance rows, section headings, and field tiles to `<Card surface="paper">` and `<Eyebrow as="h2">`.

2. **Pre-Ship Verification**:
   - Ran `npm run check`: verified migration sequence check, ESLint linting, TypeScript typecheck, and all 121 Vitest test suites (1,414 tests passing).
   - Ran `npm run build`: verified full Turbopack static site compilation across all 161 routes.

## Lessons
- Systematically migrating internal admin consoles to standard design system primitives (`<Card>`, `<Eyebrow>`) eliminates hand-rolled class recipe drift while preserving clean layout contracts and server-component rendering behavior.
- Consolidating admin console surfaces under standard primitives lowers maintenance overhead and advances the design system lint burn-down across internal operations dashboards.
