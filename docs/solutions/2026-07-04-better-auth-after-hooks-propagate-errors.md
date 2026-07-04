---
title: Better Auth databaseHooks .after errors propagate and fail the operation — only never-reject seams belong inside auth hooks
date: 2026-07-04
tags: [better-auth, auth, hooks, analytics, posthog, fire-and-forget, funnel, sign-up]
files: [lib/auth.ts, lib/posthog-server.ts, lib/analytics.ts]
status: solved
---

## Problem

N-301 needed a `signed_up` funnel event fired exactly once per account. The right
seam is Better Auth's `databaseHooks.user.create.after` — user-row creation is the
one choke point every sign-up method passes through. The non-obvious hazard:
better-auth AWAITS `.after` hooks before the create resolves, and an exception in
the hook PROPAGATES (verified in `node_modules/better-auth/dist/db/with-hooks.mjs`
and `@better-auth/core`'s transaction queue). A throwing telemetry call there
breaks every sign-up; a slow one delays account creation for every new user.

## Solution

Only call provably never-reject, time-capped functions from auth hooks.
`lib/posthog-server.ts#captureFunnelEvent` returns a promise that ALWAYS resolves —
`postCapture` swallows every failure (network, timeout, non-2xx) in its own
try/catch and an AbortController caps latency at 2s. So the hook's `await` can add
at most 2s to first sign-up (only when a PostHog key is set) and can never throw.
Confirmed by the security-reviewer run on PR #165, which traced the hook semantics
to vendor source.

## Rule

Anything imported into `lib/auth.ts` hooks (or any code awaited on the sign-up
path) must carry the house "never throws, never rejects, bounded time" contract,
stated at its definition — the same contract as `withDb` and the `lib/*` upstream
clients. If a seam's never-reject property isn't documented and tested, don't call
it from an auth hook.
