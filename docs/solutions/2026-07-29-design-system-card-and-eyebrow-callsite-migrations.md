---
title: "Design system Card and Eyebrow callsite migrations and primitive adoption"
date: "2026-07-29"
tags: [design-system, card, eyebrow, ui-primitives, refactor, eslint]
files: [components/Counterfactual.tsx, app/credits/page.tsx, components/ui/Card.tsx, components/ui/Eyebrow.tsx]
status: solved
---

## Problem
Several application surfaces (`components/Counterfactual.tsx`, `app/credits/page.tsx`) still contained hand-rolled `<div className="...">` structures for cards (`border border-border bg-surface` / `bg-paper`) and eyebrow labels (`text-[11px] font-semibold uppercase tracking-[var(--track-eyebrow)]`). These hand-rolled recipes triggered ESLint `no-restricted-syntax` warnings during lint passes.

## Symptoms
Repeated class recipes for card containers and uppercase section headers, leading to potential visual drift across surfaces and ESLint `no-restricted-syntax` warnings during `npm run check`.

## Root cause
Incomplete adoption of `<Card>` (`components/ui/Card.tsx`) and `<Eyebrow>` (`components/ui/Eyebrow.tsx`) primitives across older components.

## Solution
1. Migrated `components/Counterfactual.tsx` to use `<Card surface="surface" radius="md">` for the outer container, `<Card surface="paper" radius="sm" interactive>` for unlocked destination cards, and `<Eyebrow>` for section/mutation headers.
2. Migrated `app/credits/page.tsx` section titles to use the `<Eyebrow>` primitive.
3. Verified zero lint errors/warnings introduced and confirmed `npm run check` passes 121 test files (1,414 tests).

## How this compounds
- Cleans up legacy hand-rolled recipes and moves the design system closer to zero-warning lint runs.
- Standardizes card radii and uppercase header tracking through `components/ui/` primitives.
- Ensures future diffs compose existing primitives rather than re-inventing inline class recipes.
