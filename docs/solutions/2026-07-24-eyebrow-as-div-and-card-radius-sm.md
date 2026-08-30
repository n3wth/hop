---
title: Restoring block layout for Eyebrow primitives and adding sm radius to Card
date: 2026-07-24
tags: [design-system, UI, Card, Eyebrow, primitives]
files: [components/ui/Card.tsx, components/ui/Eyebrow.tsx, components/CardAffiliateCTA.tsx, app/mcp/page.tsx, components/DegradedNote.tsx]
status: solved
---

## Problem

1. **Inline vs Block Layout Drift with Eyebrow**:
The `<Eyebrow>` primitive defaults to rendering as an inline `<span>` (`as="span"`). When migrating legacy block-level eyebrow recipes (`<div className="mb-1 text-[10px] uppercase ...">`) to `<Eyebrow>`, replacing `div` elements with `span` elements inside flex container layouts alters element flow. On `CardAffiliateCTA.tsx`, this caused the "Sponsored" label to render inline with the CTA link rather than as a distinct block-level disclosure header on its own line.

2. **Radius Granularity in Card Primitive**:
The `<Card>` primitive originally only supported `radius="md"` (`var(--radius)`) and `radius="lg"` (`var(--radius-lg)`). Call sites that previously used `--radius-sm` (10px) (such as `ConfigBlock` on `/mcp` and `DegradedNote`) drifted to `--radius` (14px) during primitive migration.

## Solution

1. **Explicit Polymorphism (`as="div"`)**:
Updated `CardAffiliateCTA.tsx` to explicitly pass `as="div"` to `<Eyebrow as="div">`. This preserves block-level box semantics in flex layouts so header disclosures remain isolated on their own line.

2. **Added `radius="sm"` to Card Primitive**:
Extended `CardProps` in `components/ui/Card.tsx` to support `radius?: 'sm' | 'md' | 'lg'`, mapping `'sm'` to `rounded-[var(--radius-sm)]`. Applied `radius="sm"` at `app/mcp/page.tsx` (`ConfigBlock`) and `components/DegradedNote.tsx`.
