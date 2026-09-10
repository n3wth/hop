---
title: "Preserve optional passengers at every route-watch boundary"
date: 2026-09-09
tags: [standing-orders, passengers, validation, persistence, cron]
files: [lib/watch-request.ts, app/actions/standing-orders.ts, lib/standing-orders-model.ts]
status: solved
---

A mixed-party search could save an adults-only watch. SearchParams already held
children and lap infants, but the request adapter, explicit server action, and
standing-order validator each discarded them. Fixing only the adapter would not
fix the persisted row: both writes and reads validate the draft again.

Carry optional passenger fields across every boundary. Keep absent fields absent
for legacy rows, preserve explicit zero, and validate supplied counts. The default
award-seat requirement is adults + children; lap infants stay in the cash-search
party but require no award seat. An explicit seat threshold cannot undercut the
seated party. Revalidation must be idempotent, including a party larger than the
standalone seat-threshold clamp.

The regression test crosses the real request adapter, authenticated action,
validator, write mapper, read mapper, and cron. Only session, database transport,
and external services are doubled. An isolated adapter test cannot detect a
later mapper silently dropping a field. Before the fix, 14 assertions failed;
the focused suite passed afterward, including the unchanged legacy path.

This prevents new loss and preserves already-stored passenger fields. Previously
saved rows whose child/infant counts were discarded cannot be reconstructed from
the adults-only record; recreate those watches from the intended trip. No data
backfill or production migration is performed.
