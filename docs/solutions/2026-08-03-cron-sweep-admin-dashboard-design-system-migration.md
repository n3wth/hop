---
title: "Autonomous cron sweep: AdminDashboard design system primitive migrations & pre-ship verification"
date: "2026-08-03"
tags: [autonomy, design-system, card-primitive, eyebrow-primitive, cron-sweep, admin-dashboard]
files:
  - components/admin/AdminDashboard.tsx
---

# Autonomous cron sweep: AdminDashboard design system primitive migrations & pre-ship verification

## Problem / Background
During the scheduled 3-hour cron sweep, open PRs and repository worktrees were evaluated. No pending unblocked green PRs remained open (PR #373 remains correctly on hold for owner decision per ADR 0009). Following the queued design system roadmap, `components/admin/AdminDashboard.tsx` contained multiple hand-rolled Card containers (`rounded-[14px] border border-border bg-paper`, `rounded-[var(--radius-sm)] border border-border bg-paper`) and hand-rolled Eyebrow headings (`text-[11px] font-bold uppercase tracking-[var(--track-eyebrow)] text-brand`), generating ESLint warnings against the design system enforcement ladder.

## Resolution
1. **Design System Migration**:
   - Refactored `UnitEconomicsPanel`, `OutclicksCard`, and `BookingPipelineCard` in `AdminDashboard.tsx` to use `<Card surface="paper" radius="md">`.
   - Refactored `Section` headers to use `<Eyebrow as="h2" className="font-bold text-brand">`.
   - Refactored `Stat` tiles (both plain and link-wrapped) to use `<Card surface="paper" radius="md">`.
   - Refactored `HeartbeatRow`, `DegradationList` items, and `FindingRow` to use `<Card surface="paper" radius="sm">` or `<Card surface="paper" radius="md">`.
2. **Pre-Ship Verification**:
   - Re-ran `npm run check`: passed migration sequence check, ESLint linting, TypeScript typecheck, and all 121 Vitest test suites (1,414 tests).
   - Re-ran `npm run build`: verified full Turbopack static site compilation and page generation across all 161 routes.

## Lessons
- Systematically migrating internal admin surfaces to design system primitives (`<Card>`, `<Eyebrow>`) reduces visual drift and advances the design system lint burn-down without introducing behavioral regressions.
- Explicit composition (`<Link><Card>...</Card></Link>`) preserves clean prop typing and server component rendering contracts for interactive card tiles.
