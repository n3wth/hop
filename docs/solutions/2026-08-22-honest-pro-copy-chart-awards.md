---
title: Honest-Pro copy must match chart-cpp awards (gate ④b)
date: 2026-08-22
tags: [copy, billing, chart-cpp, awards, gate-4]
files: [docs/design/copy-spec.md, app/search/page.tsx, app/page.tsx, lib/concierge-tools.ts, docs/ops-runbook.md]
status: solved
---

## Problem

PR #415 took seats.aero off the paid search path. Public copy still said
"live award space." Selling Pro on that claim fails gate ④b.

## Solution

User-facing and concierge-tool strings now say published saver charts,
with "space not confirmed." Copy-spec has a Stage A public-surface rule.
Human concierge CTAs may still say "award space" — a person is looking.

Grep `live award space` / `checks award space` before adding a surface.

## How this compounds

④b is code-passed. Founder still unsets Production `SEATS_AERO_API_KEY`.
Agents do not flip `HOP_ENABLE_BILLING`.
