---
title: Live cpp without seats.aero is Duffel cash vs published miles
date: 2026-08-22
tags: [awards, chart-cpp, duffel, seats.aero, airport-coords, gate-4]
files: [lib/award-charts.ts, lib/airport-coords.json, scripts/gen-airport-coords.mjs, lib/awards.ts]
status: solved
---

## Problem

seats.aero is off the paid search path. Duffel has no award-inventory API.
"Live values" still have to appear on real searches (BOS-SFO, SFO-LHR), not
just the 15-hub hardcoded map. Adding `lib/award-live.ts` that is more
static tables is not a live source.

## Solution

Live **value** = live Duffel cash + published saver miles + conservative tax,
then `lib/cpp.ts`. Live **space** stays unclaimed (`availability: 'chart'`).

`lib/airport-coords.json` is OurAirports lat/lon (CC0, fetch-once). Refresh
with `node scripts/gen-airport-coords.mjs`. Unknown IATA → empty chart, not
a guessed distance.

v1 tables now cover NA own-metal (Alaska) + Aeroplan NA / NA–Pacific /
NA–Atlantic. Atlantic miles are the official June 2026 chart; where
starting-at and partner prices diverge, use the higher partner figure.
South America and other zones stay empty until a sourced chart + tax exist.

`recordCppObservations` still allowlists `availability === 'live'` only.

## How this compounds

Do not scrape airline award search. Do not re-enable seats.aero `fetch`.
Do not invent United dynamic miles. Stage B `live` is a cache-hit of a
licensed first-party search, not more tables.
