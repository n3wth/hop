---
title: "Design system Card and Eyebrow primitive migration for receipt, guide, and sweet spot pages"
date: "2026-08-05"
tags:
  - design-system
  - ui-primitives
  - card
  - eyebrow
  - refactor
---

# Design system Card and Eyebrow primitive migration for receipt, guide, and sweet spot pages

## Problem

Key content and shared receipt pages (`app/v/[id]/page.tsx`, `app/guides/[program]/page.tsx`, `app/sweet-spots/[program]/page.tsx`, `components/ResultRow.tsx`, `components/VerdictRail.tsx`) contained hand-rolled card recipes (`border border-border bg-paper`, `rounded-[20px]`) and eyebrow text styles (`text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)]`), generating ESLint `no-restricted-syntax` warnings during `npm run check`.

## Solution

1. **`app/v/[id]/page.tsx`**: Replaced hand-rolled verdict container `div` and text `span` with `<Card surface="paper" radius="lg">` and `<Eyebrow>`.
2. **`app/guides/[program]/page.tsx`**: Replaced transfer partner count heading with `<Eyebrow>` and caveat footer container with `<Card surface="surface">`.
3. **`app/sweet-spots/[program]/page.tsx`**: Replaced redemption count heading with `<Eyebrow>` and caveat paragraph with `<Card surface="surface">`.
4. **`components/ResultRow.tsx`**: Migrated expandable detail drawer container from hand-rolled `div` to `<Card surface="paper">`.
5. **`components/VerdictRail.tsx`**: Migrated "Best value" headline badge to `<Eyebrow onDark>`.
6. Verified with `npm run check` (121 test files, 1,406 tests pass, zero type/lint errors) and `npm run build`.
