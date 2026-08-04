---
title: "Design system TierChip callsite migrations across DealCard and destination pages"
date: "2026-07-30"
tags: [design-system, tier-chip, ui-primitives, refactor, cpp-tiers]
files: [app/destinations/DestinationGuideCard.tsx, app/guides/point-value/page.tsx, app/points/[amount]/page.tsx, components/DealCard.tsx, components/DestinationSuggestions.tsx, components/ui/TierChip.tsx]
status: solved
---

## Problem
Multiple components and destination/guides pages (`DestinationGuideCard.tsx`, `point-value/page.tsx`, `points/[amount]/page.tsx`, `DealCard.tsx`, `DestinationSuggestions.tsx`) were using duplicated `CHIP` and `TIER_CHIP` style maps (`Record<CppTier, { bg: string; fg: string; bd: string }>`) to map cents-per-point (cpp) values to colored badges. This scattered the single source of truth for cpp tier coloring across 5+ files.

## Symptoms
- Duplicate color/border maps for `green`, `amber`, and `muted` cpp tiers in component files.
- Manual badge markup and inline style bindings for cpp badges instead of using the `TierChip` primitive.
- Unused `tier` imports throwing linter warnings after component refactoring.

## Root cause
Legacy components predating the `<TierChip>` primitive in `components/ui/TierChip.tsx` retained their hand-rolled tier mapping objects and custom badge markup.

## Solution
1. Replaced custom `CHIP` / `TIER_CHIP` records and manual badge JSX with `<TierChip cpp={value} />` in `DestinationGuideCard.tsx`, `app/guides/point-value/page.tsx`, `app/points/[amount]/page.tsx`, `DealCard.tsx`, and `DestinationSuggestions.tsx`.
2. Removed unused `tier` and `CHIP`/`TIER_WORD` declarations to keep imports clean and reduce bundle footprint.
3. Verified via `npm run check` (121 test files, 1,414 tests passing) and `npm run build`.

## How this compounds
- Consolidates all cpp value badge rendering into `components/ui/TierChip.tsx`.
- Prevents color drift across deal cards, destination guide cards, and points band guides.
- Accelerates subsequent design system migration passes by eliminating 5 duplicated style maps.
