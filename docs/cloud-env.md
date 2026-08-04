# Cloud environment template (Claude Code on the web)

What to put in the Claude Code **environment settings** for a hop container. Two facts shape
this: env access is lazy (`lib/env.ts` reads at call time), and every seam no-ops cleanly when
its key is absent — so the correct template is *small*, and the app renders fully with just
tier 1.

## Setup script

Point the environment's **setup script** field at:

```
scripts/setup-cloud.sh
```

Idempotent; installs deps (`npm ci`, falling back to `npm install` on lockfile drift). Nothing
else — the agent runs `npm run build` itself after each change, and the headless Chromium used
by `scripts/shoot.sh` is pre-installed on the harness (`/opt/pw-browsers`).

## Environment variables

### Tier 1 — the visual loop (set these, stop here by default)

```
MOCK=1
UNSPLASH_ACCESS_KEY=<your key>       # https://unsplash.com/oauth/applications
```

`MOCK=1` serves cash/awards/balances from fixtures (`lib/mock.ts`) — no upstream keys, no
quota, deterministic pages. The Unsplash key lights up destination photos; without it frames
fall back to the blurhash/solid placeholder, which still verifies layout and spacing, just not
imagery.

### Tier 2 — only when the task actually needs it

```
AI_GATEWAY_API_KEY=<key>             # /ask concierge streaming
AI_GATEWAY_MODEL=<model id>
```

### Leave unset in an iteration container

- **Identity + persistence** (`DATABASE_URL`/`DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`) — OAuth callbacks can't complete
  against an ephemeral container, and `withDb` returns fallbacks without a DB. Signed-out
  surfaces render the real front door.
- **Upstream engine sources** (`DUFFEL_API_KEY_LIVE`, `SEATS_AERO_API_KEY`, `AWARDWALLET_*`) —
  burns quota to see what `MOCK=1` already shows; absent keys exercise the `degraded[]` path,
  which is a feature to look at, not a bug to hide.
- **Delivery + prod seams** (`RESEND_API_KEY` — would send real email; `CRON_SECRET`,
  `HOP_SUPPORT_INGEST_SECRET`, `HOP_VALUATION_*`; `LINEAR_API_KEY` + `LINEAR_TEAM_ID` — the
  health sentinel would file real Linear issues) — these guard production routes.
- **Feature flags** (`HOP_ENABLE_*`, incl. `HOP_ENABLE_SELF_IMPROVE`) — default off; set one
  only while working on that seam, paired with its credentials per `lib/env.ts`.

Fewest live secrets wins: nothing beyond tier 2 has ever been needed to iterate on hop.

## Network policy

The default policy is enough: npm registry for setup, Unsplash reached server-side through the
container's HTTPS proxy. Remember the harness gotcha from `AGENTS.md`: headless Chromium cannot
reach *external* URLs here — screenshot `localhost` via `scripts/shoot.sh`, and let the Vercel
preview deploy be the production render.
