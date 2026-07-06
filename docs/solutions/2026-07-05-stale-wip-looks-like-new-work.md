---
title: "Uncommitted files in a shared checkout can be stale artifacts, not new work"
date: 2026-07-05
tags: [git, worktree, wip, stale-state, false-positive]
files: []
status: solved
---

**What happened:**
A shared checkout had uncommitted files that looked like an unshipped feature
worth extracting and committing. They were actually stale, pre-#201 artifacts
left over from before that PR shipped its own (different, already-merged)
version of the same work. Committing them as-is would have **reverted** the
polish #201 already landed on `main` — the uncommitted copy was older, not
newer.

**Root cause:**
Untracked/modified files in a working tree carry no timestamp or provenance
signal that survives a glance — "this file exists and isn't committed" is
consistent with both "new work in progress" and "abandoned work predating a
merged PR." The two look identical in `git status`.

**Rule:** before extracting or committing any uncommitted work found sitting
in a checkout, verify it's actually ahead of `main`, not behind it:

1. `git diff origin/main -- <file>` — byte-compare against main. If the diff
   shows the working copy *removing* fields/logic that main has, it's stale,
   not new.
2. `git log --all --oneline -- <file>` — check whether a PR already shipped
   equivalent content for this file. If a merged commit already touches it
   with a similar shape, treat the uncommitted copy as suspect by default.

This is the same failure shape as
`docs/solutions/2026-07-05-half-resolved-merge-broke-main.md` — an operation
that looks like "integrate work" but is actually "silently regress
already-shipped work" — just triggered by inherited WIP instead of a bad
merge resolution.
