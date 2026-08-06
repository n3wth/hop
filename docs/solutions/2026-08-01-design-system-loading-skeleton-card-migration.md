---
title: Migrating loading skeleton placeholders and destination cards to the Card primitive
date: 2026-08-01
tags: [design-system, card, nextjs, lint]
---

# Migrating loading skeleton placeholders and destination cards to the Card primitive

## Problem

Hand-rolled card recipes using literal Tailwind classes (`border border-border bg-paper rounded-[16px]` or `rounded-[var(--radius-lg)]`) trigger ESLint `no-restricted-syntax` warnings across loading skeletons (`app/deals/loading.tsx`, `app/ask/loading.tsx`) and guide card components (`app/destinations/DestinationGuideCard.tsx`).

## Solution

1. Replace hand-rolled `div` / `span` card wrappers in loading states with `<Card surface="paper" radius="lg">` or `<Card surface="surface">`.
2. For empty structural skeleton placeholders where `<Card>` serves purely as a shape wrapper, pass `{null}` as `children` to satisfy `CardProps` typing (`children: React.ReactNode`).
3. For interactive cards wrapping Next.js `<Link>` elements, wrap the `<Card>` inside the `<Link>` with `interactive` enabled on the `<Card>`.

## Verification

- `npm run check` passed cleanly (121 test files / 1,414 tests passing).
- ESLint hand-rolled card warnings reduced across `/deals/loading.tsx`, `/ask/loading.tsx`, and `/destinations/DestinationGuideCard.tsx`.
