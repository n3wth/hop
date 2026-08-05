---
title: Design system migration — DestinationSuggestions, MemoryKnows, ProgramPicker, and Auth forms
date: 2026-08-04
tags:
  - design-system
  - refactor
  - components
---

# Design system migration — DestinationSuggestions, MemoryKnows, ProgramPicker, and Auth forms

## Problem
Several interactive user components and auth forms retained hand-rolled card borders, background utility recipes (`border border-border bg-paper`), and unused styling variables that generated ESLint `no-restricted-syntax` warnings and violated the design system primitive usage rule (ADR 0004 / `docs/design/DESIGN-SYSTEM.md`).

## Root Cause
- `DestinationSuggestions.tsx`, `MemoryKnows.tsx`, and `ProgramPicker.tsx` used raw hand-rolled `border border-border bg-paper` wrappers instead of the `<Card>` and `<Eyebrow>` primitives.
- Auth form components (`EmailPasswordForm.tsx`, `ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx`, `SecurityPassword.tsx`) contained unused `inputClass` constants after migrating input fields to `<Input>`.

## Resolution
1. **Interactive Components:**
   - Migrated `DestinationSuggestions.tsx` card wrappers to `<Card surface="paper">`.
   - Migrated `MemoryKnows.tsx` empty state and section containers to `<Card>` and `<Eyebrow>`.
   - Migrated `ProgramPicker.tsx` suggestion dropdown and status notice to `<Card surface="paper">`.
2. **Auth Forms:**
   - Removed unused `inputClass` variables from auth form components.
3. **Verification:**
   - Verified `npm run check` passes all 121 Vitest test suites (1,406 tests), typecheck, lint, and database migration checks.
