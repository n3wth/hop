# hop-balance-sync — Email Worker

The relay leg of hop's balance-sync email rail (the AwardWallet-independent
syncing seam — `docs/plans/2026-07-05-balance-sync.md`). Users forward loyalty
statement emails to their **personal sync address**
(`sync+<userId>.<sig>@hop.flights`, shown on `/account` when the seam is on);
this Worker parses out a plain-text body and relays it to
`POST /api/balance-sync/ingest` with a shared Bearer secret.

No extraction, no storage, no secrets beyond the relay token live here — the
app verifies the address HMAC, extracts with the gateway model, and clamps
every balance against the email's own text before anything is written.

## Deploy

```bash
cd cloudflare/balance-sync-worker
npm install
npx wrangler secret put HOP_BALANCE_INGEST_SECRET   # same value as the Vercel env var
npx wrangler deploy
```

Then in the Cloudflare dashboard → the zone → **Email Routing**: enable
routing, and point the **catch-all** route at this Worker (Email Routing has
no `sync+*` wildcard). The Worker drops any mail whose recipient doesn't start
with `sync+` without making a relay call.

The app side needs `HOP_ENABLE_BALANCE_SYNC=1` and the matching
`HOP_BALANCE_INGEST_SECRET` in Vercel — until both are set the ingest endpoint
refuses every request (503/401), so deploying this Worker first is safe.
