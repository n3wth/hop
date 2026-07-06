---
title: "A 'don't refresh too often' throttle that keys off the last attempt, not the last success, can trap a user on stale data forever"
date: 2026-07-06
tags: [awardwallet, throttle, cache, balances, silent-failure]
files: [app/actions/accounts.ts]
status: solved
---

**What happened:**
The manual "Refresh" button for AwardWallet balances is throttled to at most once every 60
seconds, to avoid hammering the upstream API. The throttle checked `syncedAt` — the timestamp of
the *last sync attempt* — and short-circuited with `ok: true` (serving the existing cache) if that
attempt was recent, regardless of whether it had actually succeeded. If a sync failed (upstream
timeout, bad credentials, whatever), `syncedAt` still updated to "now," so mashing Refresh again
within the next 60 seconds returned a cheerful `ok: true` from stale cache instead of retrying —
the one button meant to let a user un-stick themselves couldn't fire during the exact window right
after the failure it exists to recover from.

**Why it matters:**
A throttle's purpose is to rate-limit *repeated identical work*, not to rate-limit *recovery from a
failure*. Collapsing "when did we last try" and "when did we last succeed" into one timestamp means
a transient upstream blip turns into a full 60-second lockout on the only manual recovery path,
and the caller has no way to tell the difference — the response shape for "throttled, showing good
cached data" and "throttled, showing data from a sync that never actually worked" was identical.

**The rule going forward:**
A throttle that exists to protect against redundant *successful* work should key off the last
*successful* attempt, not the last attempt of any kind. The fix checks `cached.ok` (the last sync's
own outcome) before applying the 60-second short-circuit — a failed sync always lets the very next
click retry against the live API, while a genuinely fresh good sync still gets throttled as
intended.

**Evidence:** pull request #259 (a P2 follow-up from the original caching change in pull request
#217; see `docs/solutions/2026-07-06-cache-write-result-must-gate-success.md` for a related but
distinct bug from the same feature).
