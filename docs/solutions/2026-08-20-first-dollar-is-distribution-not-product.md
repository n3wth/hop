---
title: A built monetization rail is not a business — first dollar is distribution plus license
date: 2026-08-20
tags: [business-plan, monetization, distribution, billing, seats.aero, first-dollar, sequencing, northstar]
files: [docs/plans/2026-08-20-path-to-first-dollar.md, docs/plans/2026-07-04-business-plan.md, docs/agent-playbook.md, docs/ops-runbook.md]
status: solved
---

## Problem

Agents kept treating hop as one Stripe webhook, one `/pricing` page, or one design-system
pass away from revenue. The 2026-07-04 business plan said the rails were "one wire short."
Six weeks later the wires were mostly attached and verified MRR was still $0.

## Symptoms

- Playbook and north-star still told every new session to chase "$10k MRR by 2026-08-05"
  after that date had passed at $0.
- `docs/ops-runbook.md` said R0.2 was both "still owed" and "Passed."
- `docs/finance/budget.md` described billing as "off" while the ops-runbook reported the
  flag ON.
- Board memos named N-386 (fallback award source) as the cheapest de-risking move for five
  consecutive weeks; zero code landed; design-system migrations kept merging.
- Funnel-log: ~10–14 hop.flights visitors/week, zero confirmed-`Regular` signups or
  outclicks, three launch drafts unposted since 2026-07-06.

## Root cause

**A gated, tested payment path is not demand, and it is not a license.** hop's binding
constraints after Phase 0 were (1) nobody was pointed at the product, (2) award data is
still an unlicensed seats.aero feed, (3) the highest-leverage remaining actions are
founder-gated. Building more of the product (or polishing it) cannot substitute.

## Solution

Write an operating addendum — `docs/plans/2026-08-20-path-to-first-dollar.md` — that:

- Keeps the July 4 plan's positioning, $49/yr price, streams, and four billing gates
  (gate ④ amended 2026-08-21: Partner API not called **and** Production key unset, not a letter; ADR 0014). **④ ≠ keep billing ON.**
- Replaces sequencing: A-terms before any public launch; A-hn for a possible Kiwi
  commission; A-mcp + R3.4 in parallel (not after Floor); agents do FD-copy then
  FD-charts (N-386 replacement), then FD-live after the Partner API is gone.
- Strikes the expired $10k target from `docs/agent-playbook.md` and banners the north-star
  revenue section as historical.
- Marks R0.2 **Unknown** instead of picking a side of the ops-runbook contradiction.

## How this compounds

- **FD-charts is N-386 replacement, not failover.** A client that keeps seats.aero as
  primary does not pass gate ④. "We wait" while `HOP_ENABLE_BILLING` stays ON **and**
  the Partner API is still the paid path is not a pass. Won't-buy is
  `docs/plans/2026-08-21-replace-seatsaero.md`.
- Grep `first-dollar` / `distribution-not-product` before writing another business or
  monetization plan.
- Reviewer check for future agents: if a plan claims hop will earn money, it must name the
  distribution event **and** the license state (Partner API not called, Production key
  unset, billing off until honest-Pro), not only the Stripe route. Do not reuse July 4
  `B1`–`B4` IDs for a new phase. Do not treat "charts shipped" as permission to leave
  billing ON while alerts still claim space.
