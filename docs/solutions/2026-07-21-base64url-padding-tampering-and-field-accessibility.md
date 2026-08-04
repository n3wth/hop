---
title: Base64url padding bit tampering in GCM tests and Field input accessibility wiring
date: 2026-07-21
tags: [crypto, base64url, vitest, design-system, accessibility, react]
files: [lib/__tests__/credential-vault.test.ts, components/ui/Field.tsx, lib/__tests__/ui-primitives.test.ts]
status: solved
---

## Problem

1. **Crypto Tampering Test False Negative**:
In unit tests for AES-256-GCM credential decryption (`lib/__tests__/credential-vault.test.ts`), the test attempted to verify that tampering with ciphertext leads to GCM authentication failure and returns `null`. The test modified the last character of a short base64url string:
`ct.slice(0, -1) + (ct.endsWith('A') ? 'B' : 'A')`.
However, because base64url characters encode 6 bits each and short payloads leave unused trailing bits in the last character, changing 'A' (000000) to 'B' (000001) altered only the unused padding bits. `Buffer.from(tampered, 'base64url')` yielded the exact same byte array, bypassing GCM authentication failure and causing the test to fail.

2. **Hand-rolled Form Field Markup**:
Multiple form components (`HomeAirportPicker`, `ProgramsManager`, `CheckoutForm`) manually declared `<label>`, `<input>`, error messages, and ARIA attributes (`htmlFor`, `id`, `aria-describedby`, `role="alert"`). This created boilerplate code and risk of unlinked labels or missing error descriptions.

## Solution

1. **Byte-Significant Tampering in Tests**:
Updated the ciphertext tampering test to mutate the first character of the base64url string (`ct.startsWith('A') ? 'B' : 'A' + ct.slice(1)`), ensuring that actual ciphertext byte data is modified, triggering `decipher.final()` GCM auth tag mismatch and returning `null` as expected.

2. **`<Field>` Primitive & Input Controls**:
Implemented `components/ui/Field.tsx` exporting server-safe primitives (`Field`, `Input`, `Textarea`, `Select`). `<Field>` uses `React.Children.map` and `React.cloneElement` to automatically:
- Generate a unique ID via `useId()` if none is provided.
- Bind `htmlFor` on the label to the control's `id`.
- Wire `aria-describedby` pointing to error/hint paragraph IDs.
- Pass `invalid={true}` to child inputs when an error string is present.
- Render error messages with `role="alert"` and warning icons.

## Lessons Learned

- **Base64url padding bits**: When writing test cases that simulate data corruption or tampering on Base64/Base64url encoded payloads, always tamper with byte-significant positions (such as index 0 or the GCM tag) rather than trailing characters that may contain unread padding bits.
- **Form primitive composition**: Automatic ARIA wiring in container components like `<Field>` keeps individual input controls clean while guaranteeing WCAG-compliant accessibility across the application.
