---
title: "Design system Card and Eyebrow component primitive migration"
date: "2026-08-02"
tags: [design-system, card, eyebrow, ui-primitives, refactor, component-migration]
files: [components/Counterfactual.tsx, components/EscalationCTA.tsx, components/GmailHistory.tsx, components/HomeAirportPrompt.tsx, components/MemoryKnows.tsx, components/OriginSelector.tsx, components/ui/Card.tsx, components/ui/Eyebrow.tsx]
status: solved
---

## Problem
Several core interactive components (`Counterfactual.tsx`, `EscalationCTA.tsx`, `GmailHistory.tsx`, `HomeAirportPrompt.tsx`, `MemoryKnows.tsx`, and `OriginSelector.tsx`) contained hand-rolled card styling (`border border-border bg-surface` / `bg-paper` / `bg-sunk`) and header tracking (`text-[10.5px] font-semibold uppercase tracking-[var(--track-eyebrow)]`). These triggered ESLint warnings under `no-restricted-syntax`.

## Symptoms
Inconsistent card surface backgrounds, border radius definitions, and eyebrow typography across key user components.

## Root cause
Component files written before `<Card>` and `<Eyebrow>` primitives were standardized needed updating to consume the primitive components.

## Solution
1. Expanded `CardProps.as` in `components/ui/Card.tsx` to support `'p'` element rendering.
2. Expanded `EyebrowProps.as` in `components/ui/Eyebrow.tsx` to support `'h2' | 'h3' | 'h4' | 'p' | 'label'` heading elements.
3. Migrated `components/Counterfactual.tsx`, `components/EscalationCTA.tsx`, `components/GmailHistory.tsx`, `components/HomeAirportPrompt.tsx`, `components/MemoryKnows.tsx`, and `components/OriginSelector.tsx` to use `<Card>` and `<Eyebrow>`.
4. Verified `npm run check` (1,414 tests passing) and `npm run build` (Turbopack production build succeeded).

## How this compounds
- Removes legacy hand-rolled card container and eyebrow recipes across major interactive components.
- Extends the flexibility of primitive wrappers (`as="p"`, `as="h3"`, etc.) without sacrificing consistent styling props.
- Ensures design system enforcement rule compliance across all core component callsites.
