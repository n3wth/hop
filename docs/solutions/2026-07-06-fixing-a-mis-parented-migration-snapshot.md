---
title: "Regenerating a migration to fix a snapshot collision re-broke the real database, because the migration runner only compares timestamps, not content"
date: 2026-07-06
tags: [drizzle, migrations, schema, vercel]
files: [drizzle/, lib/db/schema.ts, scripts/db-migrate.mjs]
status: solved
---

**What happened:**
`docs/solutions/2026-07-05-parallel-migration-numbering.md` already documents why two
worktrees can independently generate a migration with the same next number. That doc's evidence
section says the fix landed cleanly for PR #217. It didn't, fully: `drizzle/meta/0007_snapshot.json`
(tag `0007_special_stick`) still recorded its `prevId` as `0005`'s id instead of `0006`'s id (tag
`0006_gray_lyja`) — the two migrations were generated as siblings off the same parent, and the
second one was never regenerated after the first actually landed on `main`. Nobody noticed
because the actual SQL in both files still applied cleanly and independently against a real
database — the corruption was invisible until the next `npm run db:generate` call, which failed
outright with a snapshot collision error.

**The first fix attempt, and why it broke production:**
The obvious repair — delete the mis-parented `0007` snapshot/SQL/journal entry, confirm
`schema.ts` already has the union of both changes, and re-run `db:generate` to regenerate `0007`
freshly chained after `0006` — produced byte-identical SQL (good) but a **new** journal `when`
timestamp (today's date, not the original generation date). That looked harmless: this repo's
migration runner (`scripts/db-migrate.mjs` → `drizzle-orm/neon-http/migrator`) stores a `hash` of
each migration's SQL alongside `created_at`, so the assumption was "it tracks by content hash,
not filename — an identical hash means it's recognized as already applied." **That assumption is
wrong.** Reading the actual runner (`node_modules/drizzle-orm/neon-http/migrator.js`): it fetches
only the single most-recently-applied migration's `created_at` (`order by created_at desc limit
1`), then re-executes the raw SQL of *every* migration file whose journal `when` is greater than
that one watermark. The `hash` column is written but never read back for this decision. Bumping
`0007`'s `when` to "now" made it look newer than the last-applied watermark, so the next deploy
would have **re-run `CREATE INDEX ON hop_mcp_usage (...)` against an index that already exists** —
exactly the kind of failure that surfaces as a mysterious Vercel build failure on a PR that never
touched `hop_mcp_usage`. Caught here because the PR's Vercel deployment check failed and the
immediately-prior merged PR's had succeeded, which narrowed it to something in this diff.

**Why it matters:**
Any fix to a broken migration chain that regenerates a file must preserve that file's *exact*
original journal timestamp, not just its SQL content — the timestamp is the only thing this
migrator actually checks. Getting the SQL text right but the timestamp wrong is silently fine in
every test (`npm run check`, `npm run build` with no `DATABASE_URL` — the script no-ops without
one) and only fails once a real database with real migration history runs it, which in this repo
means the Vercel preview/production deploy, not CI.

**The rule going forward:**
When repairing a mis-parented/collided migration by deleting and regenerating it: after
regenerating, hand-restore that entry's `when` in `drizzle/meta/_journal.json` to its **original**
value (check it out of git history — `git show <prior-commit>:drizzle/meta/_journal.json`) before
committing. Simulate the watermark decision for every entry
(`lastAppliedCreatedAt < entry.when → would re-run`) with the real prior watermark (the highest
`when` among migrations that were already on `main` before your change) and confirm only the
genuinely new migration comes back "apply." Don't trust "the SQL is byte-identical" alone — this
migrator's replay decision is timestamp-only.

**Evidence:** this run regenerated `0007_special_stick.sql` as `0007_giant_reavers.sql`, initially
with a fresh `when` (1783312883988) that would have re-run the `hop_mcp_usage` index creation on
every future deploy; caught via the PR's failed Vercel check (contrasted against the immediately
prior PR's successful one), then fixed by restoring `when` to the original `1783305473692` —
verified by replaying the watermark logic locally against the full journal before pushing. See
`autopilot/2026-07-06-newsletter-signup` (PR #235).
