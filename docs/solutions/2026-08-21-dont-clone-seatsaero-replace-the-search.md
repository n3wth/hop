---
title: Don't clone seats.aero — replace the one search hop actually runs
date: 2026-08-21
tags: [seats.aero, awards, billing, gate-4, chart-cpp, first-party, licensing, N-386, N-320]
files: [docs/plans/2026-08-21-replace-seatsaero.md, docs/decisions/0014-first-party-award-quotes.md, docs/plans/2026-08-20-path-to-first-dollar.md, lib/seatsaero.ts, lib/search.ts]
status: solved
---

## Problem

seats.aero commercial terms are unaffordable, and hop's paid path still depends on that
Partner API. Agents treated the bind as either "wait for a license email" or "build a
failover while seats.aero stays primary." Both leave the unlicensed feed in production.
The other temptation is to "just rebuild seats.aero."

## Symptoms

- July 4 gate ④ = written commercial terms; inquiry sent 2026-07-06, unanswered.
- N-386 named as failover for five+ weeks; zero `lib/` client besides `lib/seatsaero.ts`.
- `HOP_ENABLE_BILLING` reported ON. Show HN draft still names seats.aero as live upstream.
- hop only needs miles + taxes + cabin + program for `assembleSearch` / `lib/cpp.ts`, not a
  calendar/map/everywhere product.

## Root cause

**The product hop sells is the cpp verdict, not award-space search.** seats.aero is one
narrow input to that verdict. Paying their commercial license, waiting forever, failover-
with-them-still-primary, and cloning their whole product are four ways of treating the
input as the company.

## Solution

Founder decision 2026-08-21: **won't-buy.** ADR 0014 +
`docs/plans/2026-08-21-replace-seatsaero.md`:

- Gate ④ = seats.aero **off** the commercial/paid search path, not a letter in a drawer.
- Stage A **chart-cpp** (published tables, `availability: 'chart'`, honest copy) is enough
  for billing legitimacy. Default production source once shipped.
- Stage B first-party live search is **cache-first**: Cloudflare Queue + Durable Object +
  Browser Rendering fill Upstash; Vercel `assembleSearch` never waits on a browser.
  Calendar JSON after a warm session (seataero's pattern), not DOM scrape, not another
  seats.aero MCP wrapper, not Firecrawl/`/json` AI extract.
- Failover that keeps seats.aero primary still fails the gate.
- Chart rows must not POST to the valuation worker (ADR 0005). Miles/taxes never from an LLM
  (ADR 0002). Do not scrape seats.aero or rent another award API as "building it."

## How this compounds

- Grep `replace-seatsaero` / `first-party-award-quotes` / `chart-cpp` before proposing an
  award-data vendor or a seats.aero clone.
- Pickup: FD-copy, then **FD-charts**, then FD-live only after ops-runbook shows seats.aero
  off in Production. N-386 is replacement, not failover.
- Reviewer check: a PR that adds an award source must set `availability`, skip chart rows in
  `recordCppObservations`, and not call `lib/seatsaero.ts` when `HOP_ENABLE_SEATSAERO` is off.
