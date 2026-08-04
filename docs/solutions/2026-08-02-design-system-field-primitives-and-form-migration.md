---
title: "Design system Field primitives: implementing Field, Input, Textarea, and Select components with form call-site migrations"
date: "2026-08-02"
tags: [design-system, field, primitives, forms, accessibility, vitest]
files: [components/ui/Field.tsx, components/ProgramsManager.tsx, components/NewsletterForm.tsx, components/auth/EmailPasswordForm.tsx, components/auth/ForgotPasswordForm.tsx, components/auth/ResetPasswordForm.tsx, components/auth/SecurityPassword.tsx, lib/__tests__/ui-primitives.test.ts]
status: solved
---

## Problem
Form inputs across the application (`ProgramsManager`, `NewsletterForm`, `EmailPasswordForm`, `ForgotPasswordForm`, `ResetPasswordForm`, `SecurityPassword`) were using hand-rolled HTML `<input>`, `<textarea>`, and `<select>` elements with duplicated border, padding, and focus ring class strings rather than standardized design system primitives.

## Solution
1. **Implemented Field Primitives (`components/ui/Field.tsx`)**:
   - `Field`: Server-safe container component that automatically wires child form controls with `id`, `label`, `hint`, `required` indicator (`*`), `aria-describedby`, and error display (`role="alert"` + `Icon name="warning"`).
   - `Input`: Standardized form input supporting `invalid` state styling (`border-weak`), `onChangeValue` callback, and focus rings.
   - `Textarea`: Standardized textarea component with `invalid` state support and `onChangeValue` callback.
   - `Select`: Custom-styled select component with chevron icon and option tuple mapping (`options: Array<[string, string]>`).
2. **Migrated Form Call-Sites**:
   - Replaced raw `<input>` elements in `ProgramsManager.tsx`, `NewsletterForm.tsx`, `EmailPasswordForm.tsx`, `ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx`, and `SecurityPassword.tsx` with `<Input>` and `<Field>` primitives.
3. **Updated Unit Tests**:
   - Extended `lib/__tests__/ui-primitives.test.ts` to test `Field`, `Input`, `Textarea`, and `Select` rendering and accessibility attributes via `renderToStaticMarkup`.
4. **Resolved Rebase Conflict**:
   - Resolved merge conflict with `origin/main` (which had introduced preliminary `Field` types and `Button` tests), combining both feature sets cleanly.
   - Verified via `npm run check` (121 test files / 1414 unit tests passing, clean typecheck and migration check).

## How this compounds
- Form fields across authentication, balance tracking, and newsletter signups now share unified styling, error states, and accessibility bindings.
- Establishes a server-safe, composable `Field` primitive pattern for future form creation.
