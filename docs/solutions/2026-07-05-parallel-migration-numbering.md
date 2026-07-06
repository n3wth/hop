---
title: "Two people changing the database schema at the same time can generate colliding version numbers"
date: 2026-07-05
tags: [drizzle, migrations, worktree, parallel-prs, rebase]
files: [drizzle/, lib/db/schema.ts]
status: solved
---

**What happened:**
Two proposed code changes were being built at the same time, each in its own **worktree** (an
isolated copy of the repository's files, used so that separate pieces of work being done in
parallel — by different people or different AI coding agents — don't interfere with each other on
disk). Each change needed a **migration**: a numbered, versioned file describing a change to the
database's structure (adding a column, for example), generated automatically by a tool that looks
at what's already on disk and picks the next number in sequence.

Because each worktree only sees its own copy of the files, both tools independently picked the
same next number for their migration. Whichever change was combined into the shared codebase
second would have its migration number collide with — or silently overwrite — the one that
already used that number.

**Why it matters:**
Migration numbers have to be unique and in order, because the database applies them one at a time
in sequence to know what's already been done. A collision either fails outright or, worse, gets
silently resolved wrong — leaving some environments with a different database structure than
others, which is a much harder bug to track down later than a straightforward failure.

**The rule going forward:**
When combining a change into the shared codebase after someone else's migration has already
landed, regenerate the migration rather than fixing the number by hand: update your copy to
include the latest shared changes first, then re-run the migration-generation tool. It will see
the migration that's now already on disk and correctly pick the next number after it. Never
hand-edit a migration's number to resolve a collision — the tool keeps its own internal record of
what number should come next, and a hand-edited file that disagrees with that record will break
the migration process for anyone who already applied the original version.

**Evidence:** this is exactly what happened with pull request #217 — after it was updated to
include pull request #207's already-merged migration (numbered 5), regenerating produced migration
number 6 correctly, with no manual edits.
