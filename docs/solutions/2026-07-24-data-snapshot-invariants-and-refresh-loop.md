---
title: Data snapshot invariants as a keyless dataset refresh guard
date: 2026-07-24
tags: data-refresh, vitest, workflows, self-improvement
---

## Problem
Static committed datasets (`lib/place-facts.ts`, `lib/climate-normals.ts`) provide fast, keyless seed data for destination facts, FX rates, and weather normals without live API dependencies. However, scheduled automated updates via external APIs (Wikidata, Open-Meteo, Frankfurter) risk committing malformed responses, missing IATA codes, or broken structures into production code if left unchecked.

## Solution
Implemented standing data snapshot invariant tests (`lib/__tests__/data-snapshot.test.ts`) that execute as part of every `npm run check`. The tests enforce:
1. **Destination Set Parity**: Ensures every destination defined in `lib/destinations.ts` has corresponding entries in `PLACE_FACTS`, `CLIMATE_NORMALS`, and `DEST_COORDS`.
2. **Currency & FX Validity**: Verifies ISO 4217 code shapes, existence of curated currency metadata, positive finite FX rates, and valid date ordering (`date >= agoDate`).
3. **Climate Normals Integrity**: Enforces exactly 12 monthly temperature and precipitation values per destination with non-negative precipitation numbers.
4. **Timestamp Integrity**: Validates ISO date parsing for `GENERATED_AT` stamps.

A dedicated monthly GitHub Action (`.github/workflows/data-refresh.yml`) executes the regenerators, updates `CONTENT_LAST_MODIFIED`, applies a strict path guard (restricting modified files to `lib/place-facts.ts`, `lib/climate-normals.ts`, and `lib/seo-routes.ts`), runs `npm run check`, and files a clean PR for human review.
