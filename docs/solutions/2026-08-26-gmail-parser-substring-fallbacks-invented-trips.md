---
title: Gmail trip parser — substring/date fallbacks invented fake trips
date: 2026-08-26
tags: [gmail, parser, travel-history, false-positives, extraction]
files: [lib/gmail-parser.ts, lib/gmail.ts, lib/__tests__/gmail-parser.test.ts]
status: solved
---

## Problem

The travel-history parser admitted ANY email whose body substring-matched one
of the 33 curated city names: "Chrome" → Rome, "climate" → Lima, "comparison"
→ Paris, "Venice" → nice. `findMonth` then fell back to the email's received
date, so every dateless promo became a "trip" in the sync month. Points/cabin
regexes matched anywhere, so mileage-accrual footers set `bookedWithPoints`.

## Solution

Gates, in order: sender domain must resolve in AIRLINE_DOMAINS/HOTEL_DOMAINS
before any body scan; destination comes only from a route pattern (take the
destination side) or a word-boundary IATA code validated against the
destination table; no body date → no trip (received-date fallback deleted);
points/cabin only count within ~200 chars of fare/booking context, with an
earn-phrasing guard.

## Rule that compounds

An extraction fallback that can INVENT a field (substring city match,
received-date-as-travel-date) gets deleted, not tuned — a missed field is
fine, a wrong one is not. Parser test suites need adversarial
non-confirmation fixtures (promos, statements, marketing) that must
return null, not just happy-path confirmations.
