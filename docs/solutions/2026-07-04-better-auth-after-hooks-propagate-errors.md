---
title: Better Auth databaseHooks .after errors propagate and fail the operation — awaited never-reject seams only
date: 2026-07-04
tags: [better-auth, auth, hooks, analytics, posthog, fire-and-forget, funnel, sign-up, serverless]
files: [lib/auth.ts, lib/posthog-server.ts, lib/outclicks.ts]
status: solved
---

## Problem

R0.5 fires `signed_up` from Better Auth's `databaseHooks.user.create.after` —
the one choke point every sign-up method passes through. Two non-obvious
hazards meet there:

1. **Hook errors fail the sign-up.** better-auth AWAITS `.after` hooks before
   the create resolves, and an exception PROPAGATES (verified in
   `node_modules/better-auth/dist/db/with-hooks.mjs` and `@better-auth/core`'s
   transaction queue). A throwing telemetry call in that hook breaks every
   sign-up.
2. **Un-awaited captures get frozen.** The instinctive fix — call the capture
   fire-and-forget and return — means the serverless function can freeze
   before the HTTP request leaves the box. The same applies to any
   fire-and-forget side write whose caller's promise is handed to
   `next/server`'s `after()`: only what's CHAINED into that promise is kept
   alive.

## Solution

Await the capture — but only because the seam is provably safe:
`lib/posthog-server.ts#captureServerEvent` returns a promise that ALWAYS
resolves (`postCapture` swallows every failure in its own try/catch; an
AbortController caps latency at 2s). So the hook's `await` adds at most 2s to
first sign-up when a key is set and can never throw. `lib/outclicks.ts`
chains its capture into `recordOutclick`'s returned promise via
`Promise.allSettled` for the same reason — `/api/go/*` hands that promise to
`after()`.

## Rule

Anything awaited inside `lib/auth.ts` hooks (or chained into an `after()`
promise) must carry the house "never throws, never rejects, bounded time"
contract, stated at its definition — the same contract as `withDb` and the
`lib/*` upstream clients. If a seam's never-reject property isn't documented
and tested, don't await it from an auth hook; if a side write matters, don't
leave it un-chained either.
