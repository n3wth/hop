# hop-valuations Cloudflare Worker

First-party cents-per-point (cpp) observation intake + periodic aggregation for
hop's valuation-sync pipeline. A separate runtime from the Next.js app
(Cloudflare Workers / workerd) — does not import anything from the Next app's
`lib/`.

- `POST /observe` — accepts a batch of cpp observations from the Vercel app
  (`lib/valuation-telemetry.ts`) and inserts them into D1.
- `GET /valuations` — returns the current aggregated snapshot per program,
  consumed by the Vercel app (`lib/valuation-overrides.ts`).
- `scheduled` (cron, every 6h) — aggregates recent observations per program
  into a trimmed-mean cpp, damped against the previous snapshot, and prunes
  old observations.

Both routes require `Authorization: Bearer <HOP_VALUATION_SYNC_SECRET>`,
compared in constant time.

## Database

The D1 database (`hop-valuations`, id `d26989d0-b0e1-42bc-87ba-859424f6f5b9`)
and its schema (`observations`, `valuation_snapshot`) are **already
provisioned and live** — no manual DB setup is needed. `migrations/0001_init.sql`
documents that schema for version control only.

## Deploy

1. Authenticate: `wrangler login`, or set `CLOUDFLARE_API_TOKEN` in the
   environment (used by the CI workflow below).
2. Set the shared secret (never committed — generate a long random value):

   ```bash
   openssl rand -hex 32
   wrangler secret put HOP_VALUATION_SYNC_SECRET
   ```

3. Deploy:

   ```bash
   npm install
   npm run deploy
   ```

4. In the Vercel project, set:
   - `HOP_ENABLE_VALUATION_SYNC=1`
   - `HOP_VALUATION_WORKER_URL=<the deployed workers.dev URL>` (no trailing
     slash, e.g. `https://hop-valuations.<subdomain>.workers.dev`)
   - `HOP_VALUATION_SYNC_SECRET=<the SAME value you just put as the Worker secret>`

Until all three are set, the Vercel-side seam (`isValuationSyncEnabled()`)
stays off and this pipeline is a complete no-op.

## CI

`.github/workflows/deploy-valuations-worker.yml` deploys automatically on push
to `main` when files under this directory change. It requires the
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets to be added
manually in GitHub settings first.
