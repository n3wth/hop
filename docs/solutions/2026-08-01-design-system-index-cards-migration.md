---
title: "Design system Card migration for guide and program index pages"
date: "2026-08-01"
tags: [design-system, card, ui-primitives, refactor, eslint]
files: [app/guides/page.tsx, app/sweet-spots/page.tsx, app/points/page.tsx, components/ui/Card.tsx]
status: solved
---

## Problem
The core index pages (`app/guides/page.tsx`, `app/sweet-spots/page.tsx`, `app/points/page.tsx`) used hand-rolled card recipes (`rounded-[var(--radius-lg)] border border-border bg-paper p-6` and `rounded-[var(--radius)] border border-border bg-surface px-4 py-3`) for grid item links and caveat callout boxes. These hand-rolled patterns triggered ESLint `no-restricted-syntax` warnings.

## Symptoms
`npm run check` flagged multiple hand-rolled card recipe warnings across the index surfaces. Additionally, `CardProps` in `components/ui/Card.tsx` did not accept `'p'` as a valid polymorphism target for `as`.

## Root Cause
Index pages had not yet been updated to compose the `<Card>` primitive (`components/ui/Card.tsx`), leaving inline class lists for cards.

## Solution
1. Extended `CardProps` interface in `components/ui/Card.tsx` to include `'p'` in the `as?: 'div' | 'section' | 'article' | 'li' | 'p'` prop union.
2. Migrated program guide cards and caveat callouts in `app/guides/page.tsx` to `<Card surface="paper" radius="lg" interactive>` and `<Card surface="surface" radius="md" as="p">`.
3. Migrated sweet spot index cards and caveat callouts in `app/sweet-spots/page.tsx` to `<Card surface="paper" radius="lg" interactive>` and `<Card surface="surface" radius="md" as="p">`.
4. Migrated points band index cards and caveat callouts in `app/points/page.tsx` to `<Card surface="paper" radius="lg" interactive>` and `<Card surface="surface" radius="md" as="p">`.
5. Verified `npm run check` and `npm run build` pass cleanly.

## How this compounds
- Reduces design system drift on key public SEO index surfaces.
- Eliminates 6 hand-rolled card warnings in ESLint linter runs.
- Expands `<Card>` primitive polymorphism to support paragraph tags cleanly.
