---
title: Tailwind v4 @theme variables in a stock namespace silently re-point stock utilities
date: 2026-07-02
tags: [tailwind-v4, theme, tokens, radius, tracking, namespace, design-system, globals-css]
files: [app/globals.css, docs/design/DESIGN-SYSTEM.md, eslint.config.mjs]
status: solved
---

## Problem

Tailwind v4 is CSS-first: `@theme` variables don't just create new tokens — when a variable
name lands in a **stock theme namespace** (`--radius-*`, `--tracking-*`, `--text-*`, …), it
**overrides the default value behind the stock utility of the same name**. Nothing warns; the
utility just starts rendering differently everywhere.

## Symptoms

- `--radius-lg: 20px` has been in `@theme` since the editorial redesign — so the five stock
  `rounded-lg` call sites (`components/VerdictRail.tsx`, `components/CardAffiliateCTA.tsx`,
  `components/ai-elements/tool.tsx` ×2, `components/SearchBar.tsx`) have been silently
  rendering at 20px, not Tailwind's stock 0.5rem/8px, the whole time.
- Adding `--radius-sm: 10px` (the design-system plan's missing fourth radius step) would
  re-point stock `rounded-sm` the same way.

## Root cause

In v4 the default theme IS a set of `--<namespace>-<name>` variables; utilities are generated
from them. A user `@theme` declaration with the same variable name replaces the default —
override is the *mechanism*, and it applies equally to names you thought you were inventing.

## Solution (the two sanctioned moves)

1. **Bless the collision** when the override is what the scale wants. `--radius-sm: 10px` and
   `--radius-lg: 20px` are blessed: pre-flight audit (2026-07-02) found **zero** stock
   `rounded-sm` uses and five `rounded-lg` uses already shipping at 20px, so in this codebase
   `rounded-sm`/`rounded-lg` ARE the tokens — identical to `rounded-[var(--radius-sm)]` /
   `rounded-[var(--radius-lg)]`. Recorded in `DESIGN-SYSTEM.md` §Border Radius and as a
   comment on the `@theme` block.
2. **Dodge the namespace** when stock utilities must keep their meaning. The letter-spacing
   role tokens are named `--track-eyebrow/label/tag` (NOT `--tracking-*`), so stock
   `tracking-wide`/`tracking-tight` are untouched; call sites use
   `tracking-[var(--track-label)]`. Cost: no generated utility. Benefit: zero interaction
   with the stock namespace, now or after future renames.

**The rule:** before adding any `@theme` variable, check whether the name lands in a stock
namespace (Tailwind v4 default theme reference, `node_modules/tailwindcss/theme.css`). If it
does, grep for the stock utility it re-points and either bless the collision in
`DESIGN-SYSTEM.md` or rename out of the namespace.

## How this compounds

- `DESIGN-SYSTEM.md` §Border Radius documents the blessed override and the check-the-namespace
  rule where every UI agent reads token docs.
- copy-voice-reviewer check #6 flags new `--tracking-*` `@theme` variables and off-scale radii
  in diffs.
- The open `--text-*` question (are `--text-2xs…--text-hero` shadowing stock `text-sm` etc.?)
  is the same phenomenon — PR 7 of `docs/plans/2026-07-02-design-component-system.md` resolves
  it empirically; verified blast radius is near zero (0 stock `text-sm/base/lg/xl` uses in
  app/components as of 2026-07-02).
