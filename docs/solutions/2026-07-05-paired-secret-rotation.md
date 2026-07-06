---
title: "Rotating a shared secret without updating every consumer fails silently until the next cron"
date: 2026-07-05
tags: [secrets, rotation, cloudflare, cron, ops]
files: [.env.example, docs/ops-runbook.md, cloudflare/valuations-worker]
status: solved
---

**What happened:**
The `hop-valuations` Cloudflare Worker's shared secret was rotated 4 times in
40 hours without a verified end-to-end check that Vercel's
`HOP_VALUATION_SYNC_SECRET` copy was updated to match each time. A mismatch
between the two sides doesn't fail at rotation time — both sides accept the
write independently. It only surfaces at the *next* daily
`/api/cron/valuation-sync` run, as a generic `worker-unreachable`-style
failure that gives no hint the cause was a stale secret.

**Rule:** rotating any shared/paired secret is not done until every consumer
is updated **and** the round trip is verified end-to-end, in the same
sitting — not "rotate now, verify at the next scheduled run."

**The known paired secrets in this repo** (grep `.env.example` for the
current, complete set — this list rots):
- `HOP_VALUATION_SYNC_SECRET` — shared bearer between Vercel and the
  `cloudflare/valuations-worker` Worker (`docs/ops-runbook.md` valuation sync
  section). Verify: hit `/api/cron/valuation-sync` with the cron bearer and
  confirm `hop_valuation_overrides` rows gain fresh `sample_count`.
- `HOP_BALANCE_INGEST_SECRET` — shared bearer between Vercel and the
  `cloudflare/balance-sync-worker` Worker. Verify: forward a balance email
  through the ingest rail and confirm the row lands in
  `hop_manual_balances`.
- `HOP_SUPPORT_INGEST_SECRET` — bearer guarding `POST /api/support-ingest`
  from the Cloudflare support@ Worker; absent rejects ALL, so an unrotated
  mismatch is a hard outage, not a degrade.
- `CRON_SECRET` — bearer every `app/api/cron/*` route expects from Vercel
  Cron itself (not a second deployed service, but the same "both sides must
  agree" shape — unset fails closed in production per `lib/cron-auth.ts`).

When any of these rotates, the checklist is: update the Worker secret
(`wrangler secret put`), update the matching Vercel env var to the identical
value, then trigger the real cron/route and confirm success — not just that
both `wrangler secret list` and `vercel env ls` show *a* value set.
