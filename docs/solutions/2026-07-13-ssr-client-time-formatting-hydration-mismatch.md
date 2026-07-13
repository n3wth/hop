---
title: "Formatting a time with the browser's local timezone in a component that also renders on the server causes a hydration mismatch"
date: 2026-07-13
tags: [nextjs, ssr, hydration, react, timezone, date-formatting]
files: [components/checkout/CheckoutForm.tsx, components/ProgramsManager.tsx, components/StandingOrders.tsx]
status: solved
---

**What happened:**
Three client components called `toLocaleTimeString()` / `toLocaleString()` on a timestamp without
pinning a timezone: `CheckoutForm`'s `priceHeld` countdown, `ProgramsManager`'s "last synced"
label, and `StandingOrders`' relative-time labels. Next.js renders a client component's first pass
on the server (in UTC, since that's the server's runtime timezone) and then "hydrates" it in the
browser, which reuses whatever DOM the server already sent rather than re-rendering from scratch —
it only patches in event handlers and diffs for mismatches. Any browser not set to UTC formatted
the same timestamp differently than the server had, so the text the server sent didn't match what
the client would have rendered itself. React detects this as a text-content mismatch (its error
#418) and either warns and overwrites the DOM (a visible flash of the wrong time before the right
one appears) or, worse, silently keeps the stale server-rendered string in some cases. `StandingOrders`
had a second version of the same bug one layer up: it called `Date.now()` directly in the render
path (via `isStaleSync`) to decide whether to show a "stale" message — if the 24-hour threshold was
crossed between the server's render and the client's first render, the message existed in the DOM
on only one side.

**Why it matters:**
This class of bug doesn't show up in typechecking, linting, or `npm run build` — it only appears at
runtime, in a real browser, in a timezone other than the server's, which is exactly the setup a
same-timezone developer's local dev loop won't catch. It's also easy to reintroduce: any new
component that formats a `Date` with locale/timezone-sensitive methods (`toLocaleString`,
`toLocaleTimeString`, `toLocaleDateString`) or reads `Date.now()`/`new Date()` directly during
render is vulnerable the same way, regardless of whether the surrounding code "looks like" the
buggy files.

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
