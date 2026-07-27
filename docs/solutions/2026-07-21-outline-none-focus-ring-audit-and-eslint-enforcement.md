---
title: Focus ring accessibility audit for outline-none and ESLint enforcement
date: 2026-07-21
tags: [design-system, accessibility, focus-ring, eslint, tailwind]
files: [components/ui/Field.tsx, eslint.config.mjs, components/ProgramPicker.tsx, components/ProgramLogins.tsx]
status: solved
---

## Problem

In Tailwind CSS applications, using `outline-none` or `focus:outline-none` suppresses the browser's native focus ring on form controls and interactive elements.
While custom container borders or focus styles (such as `focus:border-brand`) are often applied, omitting the `.no-inner-ring` utility class creates two issues:
1. **Accessibility Risk**: Hiding outline without registering intentional container focus management suppresses focus indication for keyboard navigation.
2. **Design System Drift**: Uncoordinated `outline-none` usage without standard focus ring discipline leads to inconsistent focus indicators across components.

## Solution

1. **Focus Ring Audit & `.no-inner-ring` Pairing**:
Audited all 17 files using `outline-none` across `app/` and `components/`. Ensured every instance where native outline is suppressed is explicitly paired with `.no-inner-ring` (which signals container/custom border focus management in `globals.css`) alongside `focus:border-brand`.

2. **ESLint AST Rule Enforcement**:
Added a `no-restricted-syntax` rule to `eslint.config.mjs` targeting string literals containing `outline-none` that lack `no-inner-ring` (`Literal[value=/^(?!.*no-inner-ring).*\boutline-none\b/]`). This enforces that any future `outline-none` usage must include `no-inner-ring` or utilize the primitive `<Input>` / `<Field>` components.
