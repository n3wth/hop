---
title: "An expired flight watch must be skipped, not rolled forward to a new date"
date: 2026-07-06
tags: [standing-orders, cron, duffel, dedup, fingerprint, expired]
files: [lib/standing-orders-model.ts, app/api/cron/standing-orders/route.ts]
status: solved
---

**What happened:**
A "watch" (a standing order to alert a user when a route's points-vs-cash verdict crosses a
threshold) stores its search parameters — including the departure date — once, when the user
creates it. The cron that re-checks every watch every 6 hours replays those stored parameters
verbatim; there's no edit affordance, only pause or delete. Once a watch's `depart` date passed,
every tick since then sent Duffel a known-invalid past date, producing a permanent string of 422
errors — this is how a real LAX→HKG watch was discovered broken.

**Why it matters:**
The obvious-seeming fix — roll the date forward to "today + N" and keep watching — is actually
wrong for this system. `offerFingerprint()` (the mechanism this cron uses to decide "have I
already alerted on this exact deal") includes the pick's `date` as one of its components. Rolling
the date forward on every tick would mint a *new* fingerprint each time, which defeats the
dedup entirely: the same underlying persistent deal would re-alert the user daily instead of
being recognized as something already surfaced.

**The rule going forward:**
When a stored search's date lapses, skip the engine call for that tick entirely — don't
auto-advance the date to keep it "alive." `isOrderExpired(depart, todayIso): boolean` in
`lib/standing-orders-model.ts` is a plain string comparison (no `Date` parsing needed, since
dates are stored as `YYYY-MM-DD`), checked in `app/api/cron/standing-orders/route.ts` before a
watch's `assembleSearch` call. This means an expired watch quietly stops alerting rather than
either erroring forever or double-alerting — the underlying product decision (what a user should
see when their watch's date has passed) is still open and tracked separately in
`docs/agent-playbook.md`'s open threads, but whatever that decision turns out to be, it should be
built on top of "skip," never "silently roll forward," because of the fingerprint-dedup
interaction above.

**Evidence:** pull request #215.
