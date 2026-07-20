---
title: Consolidated formatting utilities and Stat primitive for design system consistency
date: 2026-07-20
tags: [design-system, format, react, typescript, primitives]
files: [lib/format.ts, components/ui/Stat.tsx, components/RouteBar.tsx, components/landing/SignedInHero.tsx]
status: solved
---

## Problem

Before this PR, various components in the codebase hand-rolled their own currency and point formatting logic. For instance, `SignedInHero.tsx` had a private `money` helper function, and other components called raw `.toLocaleString('en-US')` inline. This led to:
1. **Formatting drift**: Slight inconsistencies in rounding, negative value handling, and empty/falsy value rendering.
2. **Hydration risk**: Direct client-side formatting can cause React hydration mismatches if server and client locales or timezones differ.
3. **Redundant component declarations**: Multiple files declared local `Stat` blocks (e.g., `RouteBar.tsx`, `SampleVerdict.tsx`) with varying CSS classes, margins, and alignments instead of using a unified design primitive.

Additionally, we had an open design decision regarding whether to build a `<PricePair>` primitive or use `<Stat>` individually (the "Rule of Three" evaluation).

## Solution

1. **Consolidated Formatting Utilities**: Created `lib/format.ts` with explicit `formatUSD` (which rounds to the nearest integer safely and handles null/undefined/non-finite values gracefully) and `formatPoints` functions. These are fully covered by unit tests in `lib/__tests__/format.test.ts`.
2. **Unified Stat Primitive**: Built a shared `components/ui/Stat.tsx` primitive supporting:
   - Size presets: `sm` (15px), `md` (18px), `lg` (24px) for visual hierarchy.
   - Flexible alignment: `left`, `center`, `end` (defaults to `end` for number columns).
   - Theme compatibility: `onDark` flag to adjust values and labels for dark/hero panels.
3. **Rule of Three Resolution**: Decided against building `<PricePair>` as a composite component. Evaluation of the three target call sites (`VerdictRail`, `SampleVerdict`, `A2UIBlock`) showed highly distinct layouts, captions, and margins. Keeping them as composed individual `<Stat>` components is cleaner, more maintainable, and prevents premature abstraction.

## Non-obvious learnings

1. **Keep formatting pure and node-testable**: Putting formatting functions in components makes them difficult to test in standard node test runners without mounting. Consolidating them into a pure `lib/format.ts` file enables cheap, fast unit testing.
2. **Mock output noise in test logs**: During `npm run check`, standard error streams may print scary-looking failure logs like `[check-migration-sequence] FAILED — migration sequence collision detected`. Upon inspection, this output was caused by mock assertions inside a passing vitest file (`migration-sequence-check.test.ts`) that verifies error-reporting. Realize that mock-error noise in tests is expected and does not mean a check failed.
3. **The power of "Rule of Three" for components**: Do not abstract elements like price blocks too early. Wait until you have three distinct, real call sites to migrate. When we did, we found composing them out of smaller, more cohesive `<Stat>` primitives was vastly superior to a single rigid `<PricePair>` block.
