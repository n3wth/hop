---
title: "Changing a shared password between two systems fails silently if only one side is updated"
date: 2026-07-05
tags: [secrets, rotation, cloudflare, cron, ops]
files: [.env.example, docs/ops-runbook.md, cloudflare/valuations-worker]
status: solved
---

**What happened:**
This app talks to a small, separate program hosted by Cloudflare (a "Worker" — a lightweight
server-side script that runs independently of the main app) to keep pricing data fresh. The two
sides prove they trust each other using a shared secret: a private, password-like value that must
be set identically on both sides. That secret was changed ("rotated," a routine security
practice) four times in 40 hours, but there was no verified check each time that the main app's
copy of the value was actually updated to match the Worker's new copy.

A mismatch between the two copies doesn't cause an immediate, visible failure — each side accepts
its own update independently at the moment it's changed. The problem only shows up later, the
next time a scheduled background job ("cron job" — code that runs automatically on a timer rather
than in response to a person clicking something) tries to use the connection and gets rejected,
surfacing as a generic "can't reach the Worker" error that gives no hint the real cause was a
stale password.

**Why it matters:**
A delayed, vague failure is much harder to diagnose than an immediate one — by the time anyone
notices, the actual cause (which of the last several rotations broke the match) is no longer
obvious from the symptom alone.

**The rule going forward:**
Changing any shared secret between two systems isn't finished until every system that uses it has
been updated to match **and** the connection has been tested end-to-end in the same sitting — not
"change it now, find out later whether it worked."

**The known shared secrets in this app** (check `.env.example` for the current, complete list —
it changes over time):
- The pricing-data Worker's shared secret (`HOP_VALUATION_SYNC_SECRET`) — verify by triggering
  its scheduled job directly and confirming fresh data lands in the database.
- The balance-import Worker's shared secret (`HOP_BALANCE_INGEST_SECRET`) — verify by sending a
  real test balance through the import path and confirming it lands correctly.
- The support-inbox Worker's shared secret (`HOP_SUPPORT_INGEST_SECRET`) — this one fails closed
  (rejects *everything*) if missing or mismatched, making a stale copy a full outage rather than
  a quiet degradation.
- The scheduled-job authorization secret every cron route expects (`CRON_SECRET`) — not a second
  external service, but the same "both sides must agree on one value" shape; a mismatch here
  blocks the scheduling platform itself from running the job.

When any of these changes: update the Worker's copy, update the main app's copy to the identical
value, then actually trigger the real job or route and confirm it succeeds — checking that both
places merely *have a value set* is not enough, since two different, non-matching values both
still count as "set."
