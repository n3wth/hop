---
title: Static data invariant tests as an automated refresh guard
date: 2026-07-19
tags: [testing, vitest, data-refresh, automation, invariants]
files: [lib/__tests__/data-snapshot.test.ts, .github/workflows/data-refresh.yml]
status: solved
---

## Problem

Automated data-refresh pipelines (such as L3 updating place facts and climate normals) pull from third-party APIs (Wikidata, Open-Meteo, Frankfurter). If an upstream API returns malformed payload (e.g. empty rates, missing keys, NaN, or non-matching arrays), the automated regenerator might commit and push broken TypeScript data structures, resulting in runtime exceptions or layout crashes on production.

## Solution

Implemented a robust suite of static data invariants in a local Vitest file (`lib/__tests__/data-snapshot.test.ts`) that runs against the committed files on every `npm run check`. 

The test verifies that:
- Every active destination in `lib/destinations.ts` has parity in `PLACE_FACTS`, `CLAUDE_NORMALS`, and `DEST_COORDS`.
- Every currency code matches `/^[A-Z]{3}$/` and resolves in the `CURRENCY` mapping.
- The FX rates and past rates are finite and positive, and FX dates parse correctly.
- Climate normals have exactly 12 elements (months) and all values are finite.

This test is executed directly inside the GitHub Action runner *immediately* after regeneration but *before* git push or PR creation. If any invariant is violated due to corrupt upstream data, the build fails and aborts the pipeline, preventing any bad data from reaching human eyes or repository main.

## Non-obvious learnings

1. **Verify committed files, not the upstream payload in memory.** Writing structural invariants over the *written* on-disk artifacts rather than the memory buffer ensures the exact code structure to be committed is validated.
2. **Deterministic fail-closed behavior.** If an API goes down or changes its response format, the generator script fails or produces invalid files. These are caught immediately at the CI gate without needing a separate complex schema validation library.
3. **No need for soft plausibility checks.** The snapshot checks enforce strict schema invariants (type, shape, non-null) but leave value plausibility (e.g., whether FX rate changed by more than 10%) to human review on the resulting diff. This keeps test code robust and avoids false-positive test failures during real extreme macroeconomic changes.
