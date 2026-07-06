---
title: "Parallel worktree PRs generating Drizzle migrations collide on sequence numbers"
date: 2026-07-05
tags: [drizzle, migrations, worktree, parallel-prs, rebase]
files: [drizzle/, lib/db/schema.ts]
status: solved
---

**What happened:**
Two PRs built in parallel worktrees off the same base each ran
`npm run db:generate` independently and both produced a migration numbered
`0005` — the generator only looks at what's on disk in its own worktree, so
it has no visibility into a sibling worktree's new migration. Whichever PR
merged second would silently collide or overwrite the sequence.

**Fix (what #217 did):** after rebasing onto the latest `main` (which by then
already had #207's `0005` merged), re-run `npm run db:generate` on top of the
rebased branch. The generator picked up the existing `0005` on disk and
correctly numbered the new columns `0006`.

**Rule:** never hand-edit a Drizzle migration's sequence number to resolve a
collision. Always rebase onto latest `main` first, then regenerate
(`npm run db:generate`) so the tool recomputes the number against what's
actually there. Hand-editing risks a migration file whose number doesn't
match what Drizzle's internal journal (`drizzle/meta/_journal.json`) expects,
which breaks `db:migrate` for anyone who already applied the original.
