---
title: "Formatting or reading the current time in a component that also renders on the server causes a hydration mismatch"
date: 2026-07-13
tags: [nextjs, ssr, hydration, react, timezone, date-formatting]
files: [components/checkout/CheckoutForm.tsx, components/ProgramsManager.tsx, components/StandingOrders.tsx]
status: solved
---

**What happened:**
Two related but distinct bugs, in the same three files, both surfacing as the same React error.
First: `CheckoutForm`'s `priceHeld` countdown and `ProgramsManager`'s `formatSyncedAt` ("last
synced" label) called `toLocaleTimeString()`/`toLocaleString()` on a timestamp without pinning a
timezone. Next.js renders a client component's first pass on the server (in UTC, since that's the
server's runtime timezone) and then "hydrates" it in the browser, which reuses whatever DOM the
server already sent rather than re-rendering from scratch — it only patches in event handlers and
diffs for mismatches. Any browser not set to UTC formatted the same instant differently than the
server had, so the text the server sent didn't match what the client would have rendered itself.
Second, a different root cause with the identical symptom: `ProgramsManager`'s `isStaleSync`
(called from its `AwardWalletSection` to gate a "stale" message) and `StandingOrders`' `relativeTime`
helper (used by its `AlertRow` for "5m ago"-style labels) each called `Date.now()` directly during
render, with no timezone involved at all — the value of "now" itself can differ by the seconds or
minutes between when the server rendered and when the client hydrated, which is enough to flip a
staleness threshold or bump a rounded relative-time label. In both cases, React detects the
resulting text-content mismatch as its error #418 and either warns and overwrites the DOM (a
visible flash of the wrong value) or, worse, silently keeps the stale server-rendered string.

**Why it matters:**
Neither variant shows up in typechecking, linting, or `npm run build` — both only appear at
runtime, in a real browser. The timezone variant needs a browser set to a non-UTC zone, which is
exactly the setup a same-timezone developer's local dev loop won't catch. The live-clock variant
is even easier to trigger by accident: it needs no special browser setting at all, just the normal
handful of milliseconds-to-seconds between the server producing HTML and the client hydrating it —
which happens on every single page load, so it's really a matter of when the gap crosses a
rounding/threshold boundary, not if. Both are also easy to reintroduce: any new component that
formats a `Date` with locale/timezone-sensitive methods (`toLocaleString`, `toLocaleTimeString`,
`toLocaleDateString`) or reads `Date.now()`/`new Date()` directly during render is vulnerable the
same way, regardless of whether the surrounding code "looks like" the buggy files.

**The rule going forward:**
Two independent fixes, both needed:
- Any timestamp formatted with `toLocaleString`/`toLocaleTimeString`/`toLocaleDateString` in a
  component that can render on the server must pin `timeZone: 'UTC'` explicitly in the options
  object, so the server and the client format identically regardless of the visitor's actual
  timezone — matching the existing convention in the sibling `timeOf`/`dateOf` helpers.
- Any render-path logic that depends on "now" (`Date.now()`, `new Date()`, or a derived boolean
  like a staleness/expiry check) must come from a client-only clock (a `useState`/`useEffect`
  pair, or an equivalent `useClientNow()` hook) so it evaluates to the same thing on the server's
  render and the client's first render — `undefined`/a fixed initial value until the effect fires,
  never a live `Date.now()` read inline in JSX.

**Evidence:** pull request #282 (`5b7dca6`).
