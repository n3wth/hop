---
title: "Uncommitted files sitting in a shared checkout can be leftover scraps, not new work"
date: 2026-07-05
tags: [git, worktree, wip, stale-state, false-positive]
files: []
status: solved
---

**What happened:**
A shared checkout (a local copy of the repository files on disk) had some files with changes
that had never been formally saved into the project's history ("uncommitted"). At a glance, they
looked like a half-finished feature worth finishing and saving properly. They weren't — they were
leftover scraps from *before* another already-completed and merged piece of work (pull request
#201) had shipped its own, different version of that same feature. Saving the leftover scraps as
they were would have quietly **undone** the improvement #201 already delivered, because the
leftover copy was actually older, not newer, than what was already in the shared codebase.

**Why it matters:**
An uncommitted file gives no visible clue about its age or origin — "this file has unsaved
changes" looks exactly the same whether those changes are new work in progress or an abandoned
draft from before someone else already solved the same problem. Trusting that look can silently
erase already-shipped work instead of adding to it, with no error or warning at the moment it
happens — the mistake only becomes visible later, when the "finished" feature turns out to be
missing something.

**The rule going forward:**
Before saving or building on any uncommitted work found sitting in a checkout, confirm it's
actually ahead of the shared codebase, not behind it:

1. Compare it byte-for-byte against the shared codebase's latest version
   (`git diff origin/main -- <file>`). If the comparison shows the uncommitted copy *removing*
   fields or logic that the shared version already has, it's leftover, not new.
2. Check whether a merged pull request already shipped equivalent content for that file
   (`git log --all --oneline -- <file>`). If one has, treat the uncommitted copy as suspect by
   default rather than assuming it's the newer version.

This is the same underlying mistake as the one in
`docs/solutions/2026-07-05-half-resolved-merge-broke-main.md` — something that looks like
"combine this work into the shared codebase" is actually "silently regress work that's already
shipped." There it was triggered by a badly resolved merge; here it was triggered by inherited,
unfinished files sitting in a shared workspace.
