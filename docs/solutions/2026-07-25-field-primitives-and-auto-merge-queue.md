---
title: Form Field Primitives (PR 6) and GitHub Auto-Merge Queue Management
date: 2026-07-25
tags: [design-system, field-primitive, github-actions, auto-merge, vercel]
files: [components/ui/Field.tsx, lib/__tests__/ui-primitives.test.ts, docs/plans/2026-07-02-design-component-system.md]
status: solved
---

## Problem

1. **Design System Primitive Layer**: Form inputs across surfaces (`HomeAirportPicker`, `ProgramsManager`, checkout) were hand-rolling focus rings, label-ID wiring, error message structures, and ARIA attributes independently, creating visual and accessibility drift.
2. **Vercel CI Integration Status Delays**: PRs with required status checks can be delayed when external webhook callbacks stay in `pending` status on GitHub despite preview deployments completing on Vercel.

## Solution

1. **Form Field Primitives (`Field.tsx`)**:
   - Implemented `Field` container primitive with automatic `useId()` generation, wiring `label`, `htmlFor`/`id`, `aria-describedby`, `role="alert"` for error states, and hint text.
   - Implemented `Input`, `Textarea`, and `Select` primitives with focus border-brand modeling and ring suppression via `no-inner-ring`.
   - Added unit test suite in `lib/__tests__/ui-primitives.test.ts` covering rendering, ARIA attribute wiring, and invalid state styling.
   - Migrated `HomeAirportPicker` and `ProgramsManager` call sites.

2. **Automated Queue Management (`gh pr merge --auto --merge`)**:
   - Enabled GitHub auto-merge on clean, approved PRs (#319, #323, #325, #328, #329).
   - Using `--auto` allows GitHub to automatically finalize the merge the moment required status checks resolve without requiring manual intervention during scheduled cron sweeps.
