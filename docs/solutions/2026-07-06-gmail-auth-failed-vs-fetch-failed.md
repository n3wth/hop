---
title: "A dead OAuth token, a network blip, and an empty inbox all look identical unless you say so"
date: 2026-07-06
tags: [gmail, oauth, refresh-token, degradation, silent-failure, travel-history]
files: [lib/gmail.ts, lib/travel-history-sync.ts]
status: solved
---

**What happened:**
The Gmail travel-history sync's low-level fetch helper, `gmailGet()`, returned `null` on *any*
failure — a 401/403 from a revoked or expired OAuth refresh token, a transient network error, or
just a request that returned no results. All three collapsed to the same "nothing here" shape one
layer up, so `syncTravelHistory()` returned a bare count of messages found. A dead refresh token
therefore looked exactly like "the user's inbox has no travel confirmations yet" — `/account` kept
asserting "Connected" forever with a trip list that had silently stopped updating, and nothing
ever told the user to reconnect.

**Why it matters:**
Three genuinely different situations — a credential that needs the user to take action, a
transient error worth quietly retrying, and a real "nothing to show" state — were producing one
observable outcome. That's a silent-failure trap: the one case that actually requires the user to
act (re-authorize) is indistinguishable from the two that don't, so it never surfaces.

**The rule going forward:**
Thread the *kind* of failure through every layer instead of flattening it to `null`/a count:
`gmailGet<T>()` now returns a discriminated `{ok:true,data}` / `{ok:false,status,authFailed}`
(`authFailed = status===401||403`); `syncTravelHistory()` returns a `SyncResult` —
`{ok:true,count}` or `{ok:false,reason:'not-connected'|'auth-failed'|'fetch-failed'|'db-error'}`.
Only a genuine `authFailed` stamps `syncFailedAt` (inside the existing `trips` jsonb column — no
migration needed), which `isGmailConnected()` surfaces as `syncFailed` to gate `/account`'s
"Reconnect needed" banner.

The second-order gotcha: the first version of this fix stamped `syncFailedAt` for *both*
auth-failed and fetch-failed errors, which meant a one-off transient network blip or a Gmail 5xx
also flipped the row into permanent "Reconnect needed" — hiding the normal, retry-able Sync button
even though the refresh token was still perfectly valid. Only stamp the permanent failure state
for the failure that's actually permanent (`authFailed`); leave transient errors to retry
silently on the next scheduled sync.

Related hardening in the same area (batched into #219): `markSyncFailed()` now reads
`storedTrips`'s `updated_at` at the *start* of a sync attempt and only writes the failure stamp if
`updated_at` still matches (`.eq('updated_at', expectedUpdatedAt)`) — an optimistic-concurrency
guard so a slow, now-stale failure write can't clobber a faster sync that already succeeded and
bumped the row.

**Evidence:** pull request #214 (discriminated results), pull request #219 (concurrency guard).
