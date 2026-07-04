---
title: Adding delight moments without breaking the flat-editorial motion budget
date: 2026-07-04
tags: [design, motion, micro-interactions, delight, count-up, reduced-motion, hop-appear, hop-check-in, flat-editorial]
files: [app/globals.css, components/CountUp.tsx, components/VerdictRail.tsx, components/landing/SignedInHome.tsx, components/landing/SampleVerdict.tsx, app/book/confirmation/page.tsx, components/WatchThisRoute.tsx, components/ProgramsManager.tsx, components/McpAccess.tsx, components/Concierge.tsx]
status: solved
---

## Problem

"Add delight" requests collide with three standing decisions: entrance is intentionally STILL
(`.hop-rise` is deliberately inert — a page-wide rise-in was removed for reading as the page
nudging upward), hover never moves anything, and the flat law bans shadows/gradients/glows. Naive
delight (confetti, hover lifts, ambient loops, staggered entrances) violates all three.

## Solution — the moment rule

Delight lands on **moments of meaning**, not on page furniture. A moment is either (a) *the
answer arriving* or (b) *an action landing*. Everything else stays still.

The vocabulary (all `var(--ease-premium)`, all one-shot, all reset under
`prefers-reduced-motion` in `app/globals.css`):

- **`.hop-appear`** — THE exception to still entrances: opacity + 4px settle for the verdict
  hero only. One element per page. Do not spread it to sections; that is the drift `.hop-rise`
  died of (the guard comment lives next to the keyframe).
- **`.hop-check-in`** — transform-only scale settle (0.5 → 1.08 → 1, 420ms) for the instant an
  action lands: the booking-confirmed ring, a saved watch, "Copied". Apply to the icon's
  wrapper and **re-key it** (`key={copied ? 'check' : 'copy'}`) so it replays per action.
- **`CountUp`** — the only number animation. Numbers are engine-computed; CountUp just ticks to
  them. New props: `decimals` (exact receipt totals — a receipt never rounds) and `startInView`
  (IntersectionObserver start for below-the-fold figures, so the tick isn't spent unseen).
- **`.hop-text-appear`** — reuse for post-action status lines ("Added"/"Saved"/watch success),
  never for load-time copy.

## Taste rules discovered

- **One counter per thought.** In the verdict stat row only the accent "You save" counts, and it
  ticks in lockstep with the headline (same value/delay/duration) — one figure moving in two
  places reads as one system; four counters is a slot machine.
- **Receipts animate to the exact figure** (`decimals={2}`), and only for USD — other currencies
  keep the static `Intl.NumberFormat` string rather than guessing symbols.
- **Skip time-of-day greetings** on server-rendered surfaces: server timezone makes "Good
  morning" fire at 11pm, and a client-side swap flashes on hydration. Anti-delight; rejected.
- **Fix lying comments when you touch a file**: `DealCard`'s doc claimed a hover "transform-only
  lift" that the code (correctly) never had — stale prose like that invites someone to add the
  violation it describes.

## Where the moments live

Verdict hero arrival (`VerdictRail` `.hop-appear` — the class existed, dead, and is now defined),
booking-confirmation check + exact total count-up (`app/book/confirmation/page.tsx`), wallet
total + worth count-up (`SignedInHome`), sample-verdict $243 in-view count-up (`SampleVerdict`),
watch-saved settle (`WatchThisRoute`), Added/Saved settle (`ProgramsManager`), copy-check settle
(`McpAccess`, `Concierge`).
