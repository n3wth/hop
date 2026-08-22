---
title: Chart-cpp replaces the seats.aero Partner API on the search path
date: 2026-08-22
tags: [seats.aero, awards, chart-cpp, gate-4, assembleSearch, availability]
files: [lib/awards.ts, lib/award-charts.ts, lib/seatsaero.ts, lib/search.ts, lib/standing-orders-model.ts]
status: solved
---

## Problem

hop's paid search path called seats.aero for miles + taxes. The commercial license
is won't-buy. A failover that kept that API as primary does not pass gate ④.

## Solution

`lib/awards.ts` is the only import site. Stage A returns published saver tables
from `lib/award-charts.ts` with `availability: 'chart'`. `lib/seatsaero.ts#searchAwards`
is a hard stub (`{ok:false, reason:'disabled'}`, no `fetch`).

v1 tables cover default `/search` SFO-LAX (Alaska NA own-metal saver floor +
Aeroplan NA 0–500) and SFO-NRT (Aeroplan NA–Pacific). Saver floors are labeled
floors. Taxes are conservative bands; missing tax → no row.

`recordCppObservations` allowlists `availability === 'live'` only.
`evaluateOrder` does not cross on chart. Alert copy never says
`Award space opened` on a chart row.

Gate ④ still needs the Production `SEATS_AERO_API_KEY` **unset**. Agents do not
flip billing.

## How this compounds

Grep `availability: 'chart'` / `quoteChart` before adding an award source.
Do not add `lib/award-live.ts` or a worker in a charts follow-up that is
still just more tables.
