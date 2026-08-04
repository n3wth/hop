---
title: "A successful network pull whose cache write then fails is still a failure, not a success"
date: 2026-07-06
tags: [awardwallet, cache, withDb, silent-failure, degradation, balances]
files: [lib/accounts.ts]
status: solved
---

**What happened:**
`getUserBalances()` used to make a live AwardWallet HTTP call on every page load for every
connected user, so it was changed to read from a persisted cache
(`hop_user_accounts.cached_balances` / `last_synced_at` / `last_sync_ok`) instead, refreshed only
on connect, a throttled manual "Refresh" button, and a gated cron. The refresh function,
`refreshAwCache()`, pulls fresh balances from AwardWallet and then writes them into that cache via
`withDb(...)`. The first version of this function discarded the database write's own
success/failure and returned the *live pull's* result (`res.ok`) as the function's own result. So
when the AwardWallet call succeeded but the subsequent cache upsert failed, `refreshAwCache()`
still reported success — the cron logged a clean heartbeat and the manual Refresh button told the
user "done," while the cache row on disk was never actually updated.

**Why it matters:**
There are two independent things that can succeed or fail here — "did the network call return
good data" and "did that data actually get saved" — and collapsing them into one boolean erases
exactly the failure mode a persisted cache exists to guard against. This is doubly dangerous
because it happens at the layer that was *supposed* to make sync failures visible: a cache read
that's silently stale looks identical to a cache read that's correctly fresh, and the one signal
that would have revealed the problem (the refresh's own return value) was reporting the wrong
half of the operation.

**The rule going forward:**
When a function does "pull data, then persist it," its return value must reflect both steps, not
just the first one: `refreshAwCache()` now returns `res.ok && wrote` (where `wrote` is the
upsert's own `!error`), with a `console.error` logged specifically when the two disagree ("live
pull ok but cache write failed") so that particular combination is distinguishable from either a
network failure or a normal success in logs. Any function that fetches-then-persists should
follow the same shape: don't let a later step's failure hide behind an earlier step's success.

**Evidence:** pull request #217.
