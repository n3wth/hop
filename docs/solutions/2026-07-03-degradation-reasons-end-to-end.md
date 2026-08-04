---
title: Degradation telemetry recorded WHICH source failed but dropped WHY — reasons now flow to Neon and PostHog
date: 2026-07-03
tags: [telemetry, degradation, observability, posthog, sanitization, incident, search, fire-and-forget]
files: [lib/degradation-telemetry.ts, lib/posthog-server.ts, lib/search.ts, lib/env.ts, lib/db/schema.ts, drizzle/0003_petite_stephen_strange.sql]
status: solved
---

## Problem

A real user hit a degraded `/ask` and we could not see why. The upstream clients
(`lib/duffel.ts`, `lib/seatsaero.ts`, `lib/awardwallet.ts`) already return
`{ok:false, reason}` with a useful string ("Duffel responded 429", "Duffel request
timed out") — but `lib/search.ts#assembleSearch` collapsed that to a bare source
name in `degraded[]`, and `recordDegradation(sources, route)` persisted only
`source` + `route`. The reason string was dropped at the exact boundary where an
incident responder needs it.

## Solution — one seam, two sinks, sanitize at the WRITE

1. **Neon row gains a nullable `reason` column** (`hop_degradation_events`,
   migration `drizzle/0003_petite_stephen_strange.sql`).
   `recordDegradation` now accepts `Array<string | {source, reason?}>` —
   plain-string sources stay accepted, so old call sites/tests are unaffected.
2. **`sanitizeReason(unknown): string | null`** in `lib/degradation-telemetry.ts`
   is the single reason gate, same paranoid stance as the IATA route validator
   in the same file: non-strings → null, non-printable chars stripped (printable
   ASCII only), whitespace collapsed, clamped to 120 chars, empty → null. Raw
   upstream text can never reach the table. `iataRouteCode()` is now exported so
   the route validation also has exactly one implementation.
3. **`lib/posthog-server.ts` (new)** — server-side PostHog capture via plain
   `fetch` to `<host>/capture/`, no SDK dep. Gated on key presence
   (`isPostHogEnabled()`: `POSTHOG_KEY` or `NEXT_PUBLIC_POSTHOG_KEY`, lazy
   `lib/env.ts` accessors), 2s AbortController timeout, all errors swallowed,
   synchronous `void` return — the `recordCppObservations` fire-and-forget
   contract. `distinct_id` is a fixed `'hop-server'` label and
   `$process_person_profile: false`, so no person profile is ever created.
4. **`assembleSearch` call site**: collects `degradedReasons` per failed
   `ApiResult` (telemetry-only — never part of `SearchResult`), then after
   `degraded[]` is final and `!useMock`, fires BOTH sinks:
   `recordDegradation([{source, reason}], route)` and
   `captureServerEvent('search_degraded', {sources, reasons, route})`.

## Key insight — the two sinks are independently gated on purpose

The Neon event row is gated behind `HOP_ENABLE_SELF_IMPROVE` (it feeds the
sentinel's D2 detector, ADR 0007). The PostHog event is gated only on key
presence. An ops trail must not depend on a product-seam flag — during the
incident, self-improve being off would have blinded us twice. Both payloads are
PII-free by construction: no user id, validated `AAA-BBB` route or null,
sanitized reasons only (the PostHog payload runs values through the same
`sanitizeReason`).

## Gotchas for next time

- **Sanitize at the write, not the read** — same lesson as the original route
  column. Upstream `reason` strings can embed fetch error text/response bodies;
  treat them as attacker-influenced.
- **ANSI escapes**: stripping non-printables removes `\x1b` but leaves `[31m` —
  that's correct (they're printable chars), don't "fix" the sanitizer to reject
  them wholesale.
- **PostHog `/capture/` needs a `distinct_id`**; use a fixed server label +
  `$process_person_profile: false` for anonymous server events.
- The Postgrest shim (`lib/supabase-helpers.ts`) maps insert payload keys via
  the Drizzle schema — a new column is writable the moment it's added to
  `lib/db/schema.ts`; no shim change needed.
