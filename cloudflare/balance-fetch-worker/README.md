# hop-balance-fetch — Browser Rendering Worker

The fetch leg of hop's credential-based balance auto-sync (the "hop signs in
and reads your balance" rail — `docs/plans/2026-07-05-credential-sync.md`).

`POST /fetch` (Bearer-secret authed) receives `{ program, username, password }`
from the app's `balance-autosync` cron, signs in to the program's loyalty site
with Cloudflare Browser Rendering, and returns the dashboard's visible **text**.
It computes no balance — the app runs the same extraction + clamp pipeline over
the text as the paste/email rails.

## Honest scope

`RECIPES` starts empty. A program gets a login recipe only after it's verified
end-to-end against the live site; until then that program returns
`{ ok:false, reason:'unsupported' }` and the app marks the row **unsupported**
so the user sees the truth instead of a broken promise. Real anti-bot evasion
(residential proxies, CAPTCHA solving, per-issuer MFA) is out of scope — a site
that blocks the automated login returns a truthful failure, and paste/forward
stay the always-works fallback.

Credentials are used only for the single login and are never stored or logged
in this Worker.

## Deploy

```bash
cd cloudflare/balance-fetch-worker
npm install
npx wrangler secret put HOP_BALANCE_FETCH_SECRET   # same value as the Vercel env var
npx wrangler deploy
```

Browser Rendering must be enabled on the account (the `browser` binding in
`wrangler.toml`). The app side needs `HOP_ENABLE_CREDENTIAL_SYNC=1`,
`HOP_CREDENTIAL_KEY` (64-hex), `HOP_BALANCE_FETCH_WORKER_URL`, and the matching
`HOP_BALANCE_FETCH_SECRET`; until all are set the cron answers `503 disabled`.
