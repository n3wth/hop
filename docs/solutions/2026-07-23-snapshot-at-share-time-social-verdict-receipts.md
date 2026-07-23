---
title: Snapshot at share time for social cards — never recompute economics at crawl time
date: 2026-07-23
tags: [viral, opengraph, shared-verdicts, performance, privacy]
files: [lib/shared-verdicts.ts, app/actions/share-verdict.ts, app/v/[id]/page.tsx, app/v/[id]/opengraph-image.tsx]
status: solved
---

## Problem

Social shareable links and OpenGraph (OG) image unfurls (e.g., when posted on Twitter/X, Reddit, or Slack) are accessed frequently by web crawlers and strangers. If social preview cards re-run upstream flight searches dynamically at request time, two critical failures occur:
1. **Unbounded upstream API costs**: OpenGraph crawlers and link previews trigger repeated paid searches (Duffel, seats.aero).
2. **Inconsistent card data & privacy leaks**: Prices change over time, so an OG card could disagree with the shared page numbers, or user-specific balances/preferences could leak into public cards.

## Solution

1. **Snapshot-at-Share-Time Paradigm (`lib/shared-verdicts.ts`)**:
   - When a user clicks `Share this verdict`, the server action (`shareVerdict`) re-runs `assembleSearch` with **no user balances and no user preferences**, producing a clean, stateless result.
   - `buildVerdictSnapshot` projects only display fields into a `VerdictSnapshot` type that structurally excludes `youHave`, `action`, `bookingUrl`, `id`, or user identity.
   - The computed snapshot and flight economics are saved to the database (`hop_shared_verdicts`) indexed by a 12-char base32 ID (`/v/[id]`).

2. **Zero Upstream Calls at View Time (`app/v/[id]/page.tsx` & `opengraph-image.tsx`)**:
   - Page renders and dynamic OpenGraph image generation read directly from the stored `VerdictSnapshot` row. Zero upstream API calls are made when crawlers or users view `/v/[id]`.
   - Cards display a timestamped `Priced <date>` line for clarity.

3. **Strict Degraded Gate & Idempotency**:
   - Receipts are only minted when search results have zero degradation (`degraded.length === 0`) and a clear verdict.
   - Idempotency via `content_hash` (canonical trip params + UTC calendar day) ensures double-clicks or duplicate shares re-use the same stored receipt ID without creating duplicate database rows or upstream searches.

4. **Verification**:
   - Unit tests in `lib/__tests__/shared-verdicts.test.ts` verify param validation, rate limiting, structural privacy (absence of balance/action keys), and database fallback behaviors.
