---
title: Data snapshot structural invariant testing pattern
date: 2026-07-24
tags: [testing, invariants, datasets, vitest]
---

## Problem
Committed datasets like `lib/place-facts.ts` and `lib/climate-normals.ts` provide static defaults for destinations, currencies, FX rates, and climate normals. If a destination is added to `lib/destinations.ts` without corresponding entries in place facts or climate data, or if an FX rate/currency code format becomes corrupted during regeneration, runtime pages could display missing or malformed data.

## Solution
Add standing structural invariant tests in `lib/__tests__/data-snapshot.test.ts` that run as part of `npm run check`. These tests enforce:
1. Complete destination parity across `destinations.ts`, `PLACE_FACTS`, `CLIMATE_NORMALS`, and `DEST_COORDS`.
2. Strict ISO 4217 currency code formatting (`/^[A-Z]{3}$/`) and valid entries in the `CURRENCY` lookup table.
3. Positive finite FX snapshot rates and valid date ordering (`date ≥ agoDate`).
4. 12 monthly climate normals (temperatures and precipitation values) per destination.
5. Parseable ISO `GENERATED_AT` timestamps on all snapshot files.

By testing structural invariants against committed datasets directly in Vitest, bad dataset updates or missing destination keys fail pre-ship checks immediately.
