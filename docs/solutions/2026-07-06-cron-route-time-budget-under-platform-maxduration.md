---
title: "A cron route that loops over many slow calls needs its own time budget, not just a platform ceiling"
date: 2026-07-06
tags: [cron, timeout, maxDuration, sweet-spot-candidates, deadline, vercel]
files: [app/api/cron/sweet-spot-candidates/route.ts, lib/sweet-spot-candidates.ts]
status: solved
---

**What happened:**
`lib/sweet-spot-candidates.ts` mines new sweet-spot content by looping over every combination of
origin airport, destination, and date and calling the search engine (`assembleSearch`) for each
one — up to roughly 96 sequential calls in one cron run. The route had no declared `maxDuration`
(the platform-enforced ceiling on how long a serverless function may run) and no internal
deadline, so nothing stopped the loop early if the grid took longer than the platform allows —
the run would simply get killed mid-batch by the platform, with whatever work hadn't been
persisted yet lost.

**Why it matters:**
A platform-level `maxDuration` is a hard kill, not a warning — code doesn't get a chance to save
partial progress or stop gracefully when it fires. Relying on it alone means every run either
finishes comfortably under the limit (fine, until the grid grows) or gets cut off with no record
of how far it got. And even with a `maxDuration` declared, sitting right up against that ceiling
leaves no room for the last unit of work in progress when the cutoff arrives.

**The rule going forward:**
For any cron route that fans out over a loop of slow, independent calls:

1. Declare `export const maxDuration = <N>` on the route so the platform ceiling is explicit,
   not implicit.
2. Keep an internal wall-clock deadline meaningfully below that ceiling (here, a 220s budget
   under a 300s `maxDuration` — roughly 25% headroom) and check it once per loop iteration,
   *before* starting the next unit of work, not partway through one.
3. Persist each result as soon as it's produced instead of accumulating everything in memory and
   writing at the end — `runSweetSpotCandidatePipeline()` merges what were two separate functions
   (find candidates, then create drafts) into one so a hit can be saved and the loop can stop the
   instant a per-run cap (`MAX_NEW_CANDIDATES_PER_RUN`) is reached, rather than scoring the whole
   grid first and writing last.

The headroom matters as much as the deadline itself — cutting it close to the platform ceiling
reproduces the exact failure this pattern exists to avoid.

**Evidence:** pull request #231.
