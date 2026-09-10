# Preserve the passenger mix when saving a route watch

N-392 is an urgent correctness follow-up to R0.1: saving a mixed-party verdict
currently drops children and lap infants before the scheduled search. The active
task prioritizes this confirmed defect before Phase 1's N-328. This is one repair
to the existing watch flow, with no new surface, economic formula, flag, or schema.

## Scope

- Carry optional children and infants from SearchParams through WatchRequest and
  the authenticated createWatchExplicit action.
- Validate optional counts with the search API's existing 0–8 limits, preserving
  omitted fields for legacy adults-only rows.
- Default award-seat requirements to adults + children; lap infants need no seat.
  An explicit stricter seat threshold remains supported, but never below the
  seated party size. Repeated validation must preserve that result.
- Exercise the real request → action → persistence → row read → cron path with
  only external boundaries replaced by test doubles.

## Verification

Observe the new regression fail before changing implementation. Cover adults-only,
two adults and one child, two adults and one child and one infant, explicit zeros,
invalid counts, upper limits, and repeated validation. Run focused tests, then
`npm run check` and `npm run build` without production credentials. Review through
engine-invariant, degradation, Next.js, security, and standing-order/Eve lenses;
copy review is unnecessary because no copy or UI changes. Record the durable
lesson and run result. Follow ADR 0009 for delivery.
