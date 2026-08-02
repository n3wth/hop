---
title: "Design system Card and Eyebrow page-level callsite migrations"
date: "2026-08-02"
tags: [design-system, card, eyebrow, ui-primitives, refactor, eslint]
files: [app/points/[amount]/page.tsx, app/deals/page.tsx, app/guides/point-value/page.tsx, app/guides/points-101/page.tsx, app/destinations/[city]/page.tsx]
status: solved
---

## Problem
Application pages (`app/points/[amount]/page.tsx`, `app/deals/page.tsx`, `app/guides/point-value/page.tsx`, `app/guides/points-101/page.tsx`, and `app/destinations/[city]/page.tsx`) contained hand-rolled `<div className="...">` and `<p className="...">` structures for cards (`border border-border bg-surface` / `bg-paper`) and eyebrow labels (`text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)]`). These hand-rolled recipes triggered ESLint `no-restricted-syntax` warnings during lint passes.

## Symptoms
Hand-rolled class recipes for card containers, empty states, and section headers across public pages, leading to potential visual drift and ESLint `no-restricted-syntax` warnings during `npm run check`.

## Root cause
Incomplete adoption of `<Card>` (`components/ui/Card.tsx`) and `<Eyebrow>` (`components/ui/Eyebrow.tsx`) primitives across page-level routes and static guide templates.

## Solution
1. Migrated `app/points/[amount]/page.tsx` reference balance CTA, empty state, caveat card, and header eyebrow to `<Card>` and `<Eyebrow>`.
2. Migrated `app/deals/page.tsx` concierge CTA and empty state to `<Card>`.
3. Migrated `app/guides/point-value/page.tsx` worked example and caveat card to `<Card>`.
4. Migrated `app/guides/points-101/page.tsx` locked airline and hotel program badges to `<Card>`.
5. Migrated `app/destinations/[city]/page.tsx` Getting There card, section eyebrows, and Search CTA card to `<Card>` and `<Eyebrow>`.
6. Verified with `npm run check` (0 errors, 1414 tests passing).

## How this compounds
- Cleans up legacy hand-rolled card and eyebrow recipes on public static/dynamic page routes.
- Standardizes container borders, surfaces, radii, and tracking through `components/ui/` primitives.
- Ensures new page routes compose existing primitives rather than re-inventing inline class recipes.
