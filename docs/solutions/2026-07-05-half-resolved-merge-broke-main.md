---
title: "A half-fixed merge conflict was pushed straight to main and broke every open pull request"
date: 2026-07-05
tags: [git, merge-conflicts, main, ci, branch-protection, cron]
files: [app/api/cron/business-digest/route.ts, lib/business-digest.ts, lib/__tests__/business-digest.test.ts]
status: solved
---

**What happened:**
Two different versions of the same feature (a weekly internal business report) were combined
into `main`, the one shared copy of the codebase that everything else builds on. When two
versions of the same file disagree, the version-control tool (Git) can't guess which one is
right, so it inserts **conflict markers** — literal lines like `<<<<<<<`, `=======`, and
`>>>>>>>` — around both versions and leaves it to a person (or an AI coding agent) to pick the
right one and delete the markers before continuing.

That cleanup was done wrong in two ways. One file was never touched at all and still had the raw
marker lines sitting in it as if they were real code — meaning the file no longer even ran. The
other two files were "fixed" by keeping the *older, simpler* version of the feature instead of
the richer version already used elsewhere in the app (an admin dashboard page was already reading
data fields that only existed in the newer version). This half-fixed result was pushed directly
to `main`, skipping code review and skipping the automated checks (tests and build) that normally
have to pass first.

Because one file was left with invalid marker text in it, the whole codebase stopped building.
Every other in-progress contribution — anyone's proposed code change waiting to be merged — has
to pass those same automated checks, so all of them started failing too, for hours, until someone
noticed and pushed a proper fix.

**Why it matters:**
`main` is the single shared foundation every other piece of work is built from and checked
against. Breaking it doesn't just break one feature — it blocks *all* other in-progress work at
once. It's also easy to make the damage worse without realizing it: picking the wrong side of a
conflict can silently delete an improvement someone already shipped, not just fail to add a new
one. That's exactly what nearly happened here — the admin dashboard would have lost data it
depended on.

**The rule going forward:**
- After resolving any merge conflict, search the changed files for leftover conflict markers
  (`<<<<<<<`, `=======`, `>>>>>>>`) and run the full test/build check before pushing — not after.
- When two versions of the same file disagree, the version that matches what the rest of the app
  already expects wins. Check who else reads that code (other routes, other components) before
  picking a side — don't just eyeball the two versions and guess.
- `main` now has branch protection turned on (since 2026-07-05): broken code can no longer be
  pushed there directly, not even by an administrator — it must pass the automated build/test
  check first, the same as any other proposed change.

**Evidence (technical detail):** commit `c7faf84` was the incomplete fix; pull request #212
(commit `62210a0`) corrected it. Every other scheduled background job in the app ("cron route")
already used a shared, newer helper pair — one that checks the request is authorized, and one
that writes a **heartbeat** (a timestamp a scheduled job records each time it runs successfully,
so a monitor can tell if it silently stopped) — which is how the correct side of the conflict was
identified. Branch protection is verifiable via `gh api repos/n3wth/hop/branches/main/protection`
(required status check + `enforce_admins: true`).
