---
title: "Cron sweep: DestinationSuggestions flex column height bottom-alignment and Card list element semantics"
date: 2026-08-05
tags: [design-system, card, link, flexbox, layout, html5]
---

# Cron sweep: DestinationSuggestions flex column height bottom-alignment and Card list element semantics

## Problem

During the migration of interactive components (`DestinationSuggestions.tsx`, `ProgramPicker.tsx`, `MemoryKnows.tsx`) to design system primitives (`Card`, `Eyebrow`), two layout and semantic issues were identified during review:

1. **P1 Layout Regression in `DestinationSuggestions.tsx`**: When `<Card>` was made the parent element wrapping `<Link>`, `<Link>` (rendering an `<a>` tag) was an un-styled inline element wrapping the header, paragraph, and footer divs. As a result, the footer's `mt-auto` class lost its flex container formatting context, causing bottom alignment (`vs. $X cash / See it →`) to break across grid cards of varying heights.
2. **P3 HTML5 Semantics in `ProgramPicker.tsx`**: `<Card surface="paper">` rendered a `<div>` as a container for `<li role="option">` children, creating invalid HTML5 markup (`<li>` outside `<ul>`/`<ol>`).

## Solution

1. **Flex Column Structure**:
   - Wrapped `<Card>` inside `<Link href={href} className="group block h-full">`.
   - Applied `className="flex flex-col h-full p-5 text-left"` directly to `<Card>`, ensuring `<Card>` acts as the outer flex column container and its direct children (`<div>`, `<p>`, `<div className="mt-auto...">`) participate directly in flex layout.
2. **Card `as` Union Expansion**:
   - Extended `CardProps.as` union in `components/ui/Card.tsx` from `'div' | 'section' | 'article' | 'li' | 'p'` to include `'ul' | 'ol'`.
   - Passed `as="ul"` to `<Card>` in `ProgramPicker.tsx`'s listbox dropdown, producing semantic HTML `<ul>` markup for `<li>` options.
3. **Verification**:
   - Verified local checks via `npm run check` (121 Vitest files, 1,414 tests passing, 0 lint errors).
   - Pushed fixes to branch `feat/design-system-interactive-components` and updated PR #404.
