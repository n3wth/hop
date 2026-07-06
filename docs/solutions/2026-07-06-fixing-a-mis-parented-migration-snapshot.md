---
title: "A previously-known migration numbering collision was only half-fixed, and db:generate stayed broken on main"
date: 2026-07-06
tags: [drizzle, migrations, schema]
files: [drizzle/, lib/db/schema.ts]
status: solved
---

**What happened:**
`docs/solutions/2026-07-05-parallel-migration-numbering.md` already documents why two
worktrees can independently generate a migration with the same next number. That doc's evidence
section says the fix landed cleanly for PR #217. It didn't, fully: `drizzle/meta/0007_snapshot.json`
(tag `0007_special_stick`) still recorded its `prevId` as `0005`'s id instead of `0006`'s id (tag
`0006_gray_lyja`) — the two migrations were generated as siblings off the same parent, and the
second one was never regenerated after the first actually landed on `main`. A stray, unreferenced
`drizzle/0006_special_stick.sql` (an earlier, abandoned attempt at the same number) was left on
disk too. Nobody noticed because the actual SQL in both files still applied cleanly and
independently against a real database — the corruption was invisible until the next
`npm run db:generate` call, which failed outright: `Error: [...] are pointing to a parent
snapshot: [...] which is a collision.`

**Why it matters:**
`npm run db:generate` isn't part of `npm run check`, so this had been silently broken on `main`
for a day without tripping the routine health check any autonomous run does first. Any future
PR that needs a schema change would hit this wall immediately — a correctness bug in the
tooling's own bookkeeping, not the database, but one that blocks every future migration until
fixed.

**The rule going forward:**
When `db:generate` reports a snapshot collision, don't hand-edit the `prevId` field to "fix" the
pointer — the snapshot's *content* (the recorded table/column state) is also wrong if it was
generated against the wrong parent, so patching just the pointer can leave a snapshot that
disagrees with reality. Instead: delete the mis-parented snapshot JSON, its `.sql` file, and its
`_journal.json` entry (falling back to the last known-good migration), confirm `schema.ts`
already contains the union of everything that should be there (it will, if both conflicting
migrations already merged to `main`), then re-run `db:generate` — it regenerates the dropped
migration fresh, correctly chained, with identical SQL when nothing about that migration's actual
change was in dispute. Verify the regenerated file's SQL text is byte-identical to the one it
replaced before trusting that a live database (which tracks applied migrations by content hash,
not filename) won't try to re-apply it.

**Evidence:** this run regenerated `0007_special_stick.sql` as `0007_giant_reavers.sql` with
`prevId` now correctly pointing at `0006_gray_lyja`'s id, confirmed the SQL text was unchanged
(the `hop_mcp_usage` composite index), removed the orphan `0006_special_stick.sql`, and then
generated a genuinely new `0008` for the newsletter-signup table on top of the repaired chain —
see the `autopilot/2026-07-06-newsletter-signup` branch.
