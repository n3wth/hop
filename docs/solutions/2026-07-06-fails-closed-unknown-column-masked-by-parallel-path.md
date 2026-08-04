---
title: "One correct code path querying a table can hide a broken twin that queries it wrong"
date: 2026-07-06
tags: [outclicks, withDb, postgrest-shim, fails-closed, unknown-column, admin]
files: [lib/outclicks.ts, lib/business-digest.ts, lib/db/schema.ts]
status: solved
---

**What happened:**
`hop_outclicks` (the ledger of affiliate link clicks) has a `clicked_at` timestamp column — there
is no `created_at` column on that table (`lib/db/schema.ts`). `lib/outclicks.ts`'s
`listRecentOutclicks()` and `getOutclickSummary()` queried and ordered by `created_at` anyway.
This repo's Postgrest-compatibility shim over Drizzle (`lib/supabase-helpers.ts#withDb`) is
designed to **fail closed on an unknown column name** rather than throw — so both functions
silently returned `null` on every call, and `/admin/ops`'s dedicated outclick ledger permanently
showed "Outclick ledger unavailable."

**Why it matters:**
The bug went unnoticed specifically because a *different*, correct code path already existed:
`lib/business-digest.ts`'s weekly outclick counters used `clicked_at` correctly from the start, so
the Overview page's weekly stat kept working the whole time. Two code paths queried the same
table — one right, one wrong — and the working one gave no indication that a sibling path querying
the same data was silently broken. A fails-closed design is the right behavior for a shared DB
helper (better than throwing and crashing a page), but it also means a wrong column name produces
the *same* observable symptom ("unavailable") as an actual outage or missing table, so it's easy
to write off as "the DB must be having a moment" rather than "this query is wrong."

**The rule going forward:**
When a table has more than one code path reading from it, don't assume they agree on column
names just because one of them works — grep for every other reader of the same table
(`grep -rn hop_outclicks lib/`) when adding or debugging one, and check each against the actual
schema (`lib/db/schema.ts`), not against what another reader happens to write. And when a
degraded-per-section UI surface (here, the Ops ledger) shows "unavailable" with no upstream outage
to explain it, check for a column/table name mismatch before assuming it's a real degradation —
`withDb`'s fail-closed behavior means a typo and a genuine outage are indistinguishable from the
UI alone.

**Evidence:** pull request #215.
