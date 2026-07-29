---
title: "Design system Field primitives migration and WCAG-compliant form control composition"
date: "2026-07-29"
tags: [design-system, field, input, textarea, select, accessibility, wcag, form-controls]
files: [components/ui/Field.tsx, components/ProgramsManager.tsx, components/HomeAirportPicker.tsx, components/checkout/CheckoutForm.tsx]
status: solved
---

## Problem
Form controls across multiple surfaces (`ProgramsManager`, `HomeAirportPicker`, `CheckoutForm`) manually hand-rolled `<label>`, `<input>`, `<select>`, and error message containers. This repeated styling logic and increased the risk of unlinked labels, missing `aria-describedby` wiring, or inconsistent focus-ring behavior.

## Symptoms
Inconsistent input border/focus states across pages, duplicated field container styling, and risk of missing accessibility properties on dynamic form inputs.

## Root cause
Lack of a unified `<Field>` composite primitive and standardized `<Input>`, `<Textarea>`, and `<Select>` wrappers in `components/ui/`.

## Solution
Merged PR #370 (`feat(design-system): PR 6 — Field, Input, Textarea, Select primitives with call-site migrations`):
- Leveraged `components/ui/Field.tsx` providing `Field`, `Input`, `Textarea`, and `Select` server-renderable primitives.
- `<Field>` automatically manages `id` generation (`useId`), links `htmlFor` on labels, and wires `aria-describedby` for error/hint text.
- Replaced hand-rolled input fields across `ProgramsManager`, `HomeAirportPicker`, and `CheckoutForm`.
- Maintained the `.no-inner-ring` global focus ring pattern.

## How this compounds
- All new form fields compose `Field`, `Input`, `Textarea`, and `Select` primitives from `components/ui/`.
- `npm run check` and `npm run build` validate component contracts across the app.
- ESLint rules at `no-restricted-syntax` flag hand-rolled input/field patterns in lint passes.
