---
title: "Verify UI changes with computed styles — screenshots freeze entrance animations; components can swallow inherited color"
date: 2026-07-04
tags: [preview, verification, animation, hop-rise, color, currentColor, topnav, logo, withdb, snake-case]
files: [components/FlyingBunny.tsx, components/TopNav.tsx, components/VerdictRail.tsx, lib/supabase-helpers.ts]
status: solved
---

**Summary:**
Three verification gotchas hit while shipping the launch-readiness batch, each
of which would have produced a false conclusion from a naive check.

**1. Preview screenshots freeze entrance animations at their start state.**
A `/search` screenshot showed the whole verdict hero washed out / near
invisible. The live DOM was fine — `getComputedStyle` reported the section at
`background: rgb(13,110,110)`, the h1 white at `opacity: 1`, with 11
animations registered. The screenshot renderer captures with `.hop-rise`-style
entrance animations held at 0%, so anything animated-in looks broken in the
image while being correct in the browser. **Rule: judge color/opacity/layout
from `preview_inspect` / `preview_eval` computed values; use screenshots only
for gross composition.**

**2. A wrapper's color class does nothing if the leaf component hardcodes its
own.** Wrapping `<FlyingBunny>` in `text-brand` didn't paint the mark teal:
`FlyingBunny` internally rendered `<Logo className="text-text2">`, defeating
inheritance silently. Fixed by adding a `markClassName` prop (default
`'text-text2'`). When a `currentColor` SVG doesn't take your color, grep the
component chain for a hardcoded `text-*` before suspecting the CSS.

**3. `withDb` rows come back snake_case.** The Postgrest-compat shim
camelizes *inputs* (filters, projections) but converts result rows back with
`toSnakeRow` — so reads must access `row.created_at`, not `row.createdAt`.
Typed row mappers that read the wrong key silently produce `null`s that look
like degraded data.

**Auto-prevention:**
- `lib/__tests__/contrast.test.ts` now guards the on-teal token pairs
  (WCAG AA on `--color-brand`) so token edits can't regress the hero.
- `FlyingBunny`'s `markClassName` prop documents the override seam in its
  type, so the next brand-color request doesn't re-discover the hardcode.
- This entry is the greppable record for the snake_case row shape
  (`tags: withdb, snake-case`).
