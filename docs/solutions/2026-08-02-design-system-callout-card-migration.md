---
title: Migrating callout card recipes and CTAs to Card and Button primitives
date: 2026-08-02
tags: [design-system, card, button, refactoring]
files: [app/points/[amount]/page.tsx, app/deals/page.tsx, app/book/confirmation/page.tsx]
---

# Migrating callout card recipes and CTAs to Card and Button primitives

## Problem
Several application pages (`/points/[amount]`, `/deals`, and `/book/confirmation`) used hand-rolled card containers (`rounded-[16px] border border-border bg-surface px-5 py-4`) and custom button links instead of standardizing on the design system's `<Card>` and `<Button>` primitives.

This created minor styling drift and duplicated layout logic across promotional/callout banners and confirmation page sections.

## Solution
1. Replaced hand-rolled callout card containers in `app/points/[amount]/page.tsx` and `app/deals/page.tsx` with `<Card>`.
2. Migrated inline CTA links within those callout boxes to standard `<Button>` components (`variant="primary"`, `size="sm"`).
3. Migrated itinerary, passenger, and error state sections in `app/book/confirmation/page.tsx` to `<Card as="section">` and `<Card>`.
4. Verified that `npm run check` (121 test files / 1,414 tests) and `npm run build` pass cleanly.

## Key Lessons
- Standardizing containers with `<Card>` and `<Button>` preserves consistent border, surface background, and hover states across all routes.
- Using `as="section"` on `<Card>` retains semantic HTML elements for accessibility without needing custom outer wrappers.
