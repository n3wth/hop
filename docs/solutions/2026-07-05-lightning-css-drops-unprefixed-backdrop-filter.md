---
title: Lightning CSS silently drops unprefixed backdrop-filter in compiled classes
date: 2026-07-05
tags: [css, backdrop-filter, glass, lightning-css, tailwind-v4, prefixing, nav]
files: [app/globals.css, components/TopNav.tsx, components/BottomTabBar.tsx]
status: solved
---

## Problem

Moving a `backdrop-filter: blur(...); -webkit-backdrop-filter: blur(...);` pair from an inline
React style object into a compiled CSS class (`.hop-glass-surface` in `app/globals.css`) silently
disabled the blur in Chromium.

## Symptoms

`getComputedStyle(el).backdropFilter` returned `"none"` even though the class was applied and the
declaration was present in source. Inspecting the actual compiled output
(`.next/dev/static/chunks/app_globals_css_*.css`) showed the rule split into two separate rules,
and the **unprefixed** `backdrop-filter` declaration was gone entirely — only
`-webkit-backdrop-filter` survived:

```css
.hop-glass-surface { -webkit-backdrop-filter: blur(14px) saturate(140%); }
```

(The blur still rendered visually in Chromium/Safari, since both are WebKit/Blink-derived and
honor the `-webkit-` alias — but relying on that is fragile and the standard property should not
silently vanish.)

## Root cause

Next's CSS pipeline (Lightning CSS) treats `backdrop-filter` + `-webkit-backdrop-filter` written
together in one rule as a prefix pair and, based on its target-browser analysis, deduped them down
to the one it judged sufficient — dropping the unprefixed standard property from the compiled rule.
This only happens when the pair lives in a **compiled** CSS rule; it does not happen to inline
`style={{}}` props, because those bypass the CSS build pipeline (set directly as DOM style
properties by React/the browser, one declaration at a time — there's nothing for Lightning CSS to
dedupe).

## Solution

Keep the translucent **background** (plus its `@supports`/`prefers-reduced-transparency`
solid-fallback rules) in the shared `.hop-glass-surface` CSS class — that part compiles correctly.
Set `backdropFilter` / `WebkitBackdropFilter` as an **inline style** on each component instead
(`components/TopNav.tsx`, `components/BottomTabBar.tsx`), exactly like the original scroll-glass
`TopNav` treatment already did before this refactor. This is safe with the opaque fallback: when
the fallback background goes fully opaque, any residual inline blur is invisible behind it anyway,
so functional behavior matches the spec (opaque solid nav for browsers without backdrop-filter
support / `prefers-reduced-transparency`) regardless of where the blur declaration lives.

## How this compounds

Documented directly above `.hop-glass-surface` in `app/globals.css` so the next person who's
tempted to "clean up" the blur into the CSS class re-reads this reasoning first, and here for a
`docs/solutions/` grep hit on `backdrop-filter`/`glass` before anyone re-debugs the same silent
drop.
