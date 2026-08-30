---
title: Form Field Primitives (Field, Input, Textarea, Select)
date: 2026-07-25
tags: [design-system, field-primitive, input, accessibility, aria, forms]
files: [components/ui/Field.tsx, lib/__tests__/ui-primitives.test.ts, docs/plans/2026-07-02-design-component-system.md]
status: solved
---

## Problem
Form inputs across surfaces (`HomeAirportPicker`, `ProgramsManager`, checkout) were hand-rolling focus rings, label-ID wiring, error message structures, and ARIA attributes independently, creating visual and accessibility drift.

## Symptoms
Inconsistent input border colors on focus, missing or hand-rolled `htmlFor`/`id` association, unannounced form errors for screen readers, and duplicated focus-ring suppression styles across call sites.

## Root cause
Lack of a single canonical `Field` wrapper and input primitives (`Input`, `Textarea`, `Select`) in `components/ui/`, causing developers to re-derive field structures and focus styles manually at every form call site.

## Solution
Implemented `components/ui/Field.tsx` providing:
- A `Field` container primitive with automatic React `useId()` generation, wiring `label`, `htmlFor`/`id`, `aria-describedby`, `role="alert"` for error states, and hint text.
- `Input`, `Textarea`, and `Select` primitives with focus border-brand modeling and ring suppression via `.no-inner-ring`.
- Call-site migrations for `HomeAirportPicker` and `ProgramsManager`.

## How this compounds
- Unit test suite in `lib/__tests__/ui-primitives.test.ts` validates label-input ID wiring, error ARIA attributes, and variant class rendering.
- ESLint `no-restricted-syntax` rule warns against hand-rolled input recipes outside `components/ui/`.
- Future form components import `<Field>` and input primitives directly from `components/ui/Field`, guaranteeing consistent focus behavior and full ARIA accessibility by default.
