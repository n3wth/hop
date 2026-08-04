---
title: Global :focus-visible ring draws harsh rectangles on text inputs and programmatically-focused listboxes
date: 2026-07-03
tags: [focus-visible, a11y, wcag, search-bar, popover, listbox, no-inner-ring, css, design-polish]
files: [app/globals.css, components/SearchBar.tsx]
status: solved
---

## Problem

The global keyboard-focus rule in `app/globals.css` —
`:where(a, button, input, select, textarea, [tabindex]):focus-visible { outline: 2px solid var(--color-brand) }`
— is required for WCAG 2.4.7, but two element classes match `:focus-visible` in cases where the
ring reads as broken chrome, not as a focus indicator.

## Symptoms

- Clicking into the search bar's From/To typeahead drew a hard 2px teal rectangle around the bare
  transparent `<input>` mid-pill (screenshot-reported as "this experience should be improved").
- Opening the Cabin picker drew a 2px brand rectangle around the entire popover ("the green
  rectangle").

## Root cause

Two `:focus-visible` matching rules that differ from buttons:

1. **Text inputs always match `:focus-visible` when focused — even by mouse click.** Browsers
   assume keyboard input follows, so the "mouse focus stays quiet" behavior you get on buttons
   does not apply to `<input>`.
2. **Programmatic `.focus()` on a `tabindex="-1"` container can match `:focus-visible`.** The
   cabin listbox is focused on open so arrow keys work immediately; the global `[tabindex]`
   selector then rings the whole popover.

## Fix

Opt both out with the existing `.no-inner-ring` escape hatch and give each a quieter, still-visible
focus indicator:

- Airport inputs: `no-inner-ring` on the `<input>`, plus `group-focus-within:text-brand` on the
  field's eyebrow label — the label color flip plus the results popover opening is the focus
  indication.
- Cabin listbox: `no-inner-ring` on the `<ul role="listbox">` — the active-row `bg-sunk` highlight
  (driven by `aria-activedescendant`) is the keyboard indicator.

Also: popovers anchored `top-[calc(100%+10px)]` off triggers that sit *inside* the pill landed
overlapping the pill's bottom edge; `+18px` clears it.

## Rule of thumb

When adding any focusable control that is not a plain button (text input, combobox, listbox,
anything focused via script), decide explicitly what its focus indicator is. If the global ring
is wrong for it, add `no-inner-ring` AND a replacement indicator — never just suppress.
