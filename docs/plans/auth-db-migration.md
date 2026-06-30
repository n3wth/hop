# Migration: Auth0 + Supabase → Better Auth + Neon + Drizzle (+ Upstash)

Status: **planned** · Owner: (you) · Foundation work that the Gmail seam and future
features land on. Phased and reversible — Supabase/Auth0 stay intact until the final cut.

## Why

hop is early enough that re-keying identity is cheap now and expensive after launch.
The target stack is cheaper (Neon scale-to-zero, no Auth0 MAU pricing), code-first, and
Vercel/EVE-native:

- **Better Auth** — identity, owns its own `user`/`session`/`account` tables in our DB.
- **Neon** — serverless Postgres (scale-to-zero, preview-DB branching).
- **Drizzle** — type-safe queries + migrations, replacing hand-rolled Supabase builder calls.
- **Upstash Redis** — durable, cross-instance rate-limiting + caching (already linked).

## Architecture today (confirmed)

- **Identity = Auth0 `sub`** (e.g. `auth0|abc`, `google-oauth2|…`). It is the user key in
  **every** `hop_*` row (`user_id text`), scoped `.eq('user_id', userId)` in code via the
  service-role client (RLS bypassed). There is **no** users table of our own.
- **DB access is 100% hand-rolled** Supabase query-builder, funnelled through one chokepoint:
  `lib/supabase-helpers.ts#withDb(fallback, fn)` — resolves the service-role client, returns
  `fallback` if unconfigured, swallows throws. **Re-pointing `withDb` at Drizzle is the lever
  for the whole DB migration.**
- **MCP auth is token-based, not session** — `hop_` Bearer tokens (`lib/api-tokens.ts`) resolve
  to a `user_id` string; unaffected by the auth swap except for re-keying that column.

## Target schema (Drizzle, `lib/db/schema.ts`)

Nine `hop_*` tables, all `user_id text` (= Better Auth `user.id` after cutover). Full column
shapes inferred from `utils/supabase/admin.ts` (the canonical typed schema) + each owner lib:

| Table | Owner lib | Notes |
|---|---|---|
| `hop_manual_balances` | `lib/accounts.ts` | id uuid, program, code?, balance numeric, kind?, updated_at |
| `hop_user_accounts` | `lib/accounts.ts` | user_id pk (unique), aw_user_id?, connected_at, updated_at |
| `hop_user_prefs` | `lib/prefs.ts`, `lib/travel-profile.ts` | user_id pk, home_airport?, travel_prefs jsonb, travel_profile jsonb |
| `hop_conversations` | `lib/conversations.ts` | id uuid, user_id unique, messages jsonb default [] |
| `hop_bookings` | `lib/bookings.ts` | id uuid, duffel_order_id?, offer_snapshot jsonb, … (IDOR by user_id+order) |
| `hop_standing_orders` | `lib/standing-orders.ts` | params jsonb, min_cpp numeric, seats int, eligible_programs text[], active bool |
| `hop_standing_order_alerts` | `lib/standing-order-alerts.ts` | FK→standing_orders(id) ON DELETE CASCADE, pick jsonb, fingerprint |
| `hop_api_tokens` | `lib/api-tokens.ts` | token_hash (sha256), last_four, name? |
| `hop_travel_history` | `lib/travel-history*.ts` | user_id pk, google_refresh_token?, trips jsonb — **gated by isGmailHistoryEnabled()** |

Keep Drizzle `numeric` in **string mode** (matches existing `parseFloat` guards). The full
schema, `lib/db/index.ts` (`drizzle(neon(DATABASE_URL))`), and `lib/auth.ts` (Better Auth +
drizzleAdapter + Google social provider) are drafted and ready to drop in once Neon exists.

## Identity re-keying (Auth0 sub → Better Auth user.id)

Join key is **email**. **Lazy/just-in-time** approach (reversible, recommended):
keep a temporary `auth0_sub_map(sub, user_id)`; on each user's first Better Auth login, look up
their old sub by email and `UPDATE hop_* SET user_id = <newId> WHERE user_id = <sub>` (re-key
`hop_api_tokens` in the same pass). Spreads load, only migrates active users. New users need no work.

## Phases (each reversible until Phase E)

- **A — Drizzle + Neon behind `withDb`** *(no auth change).* Provision Neon; add `lib/db/`,
  `drizzle.config.ts`; `drizzle-kit push` the 9 tables. Rewrite the 9 owner libs' query bodies to
  Drizzle, **same function signatures**; re-point `withDb` to the Drizzle `db`. Auth0 still owns
  identity; `user_id` still holds the sub. Existing `lib/**/*.test.ts` guard the shapes.
- **B — Data migration.** `pg_dump` the 9 `hop_*` tables Supabase→Neon; verify counts + jsonb.
  Optional dual-write bake. Supabase still intact (reversible).
- **C — Better Auth alongside Auth0.** Add `lib/auth.ts`, `app/api/auth/[...all]/route.ts`, run
  Better Auth's table migration on Neon, build `auth0_sub_map`, add `lib/session.ts#getUserId`.
  No call sites flipped yet. Configure the **social-login** Google client.
- **D — Swap auth + re-key.** Replace `auth0.getSession()`→`getUserId()` at the ~30 sites; point
  `/login` at Better Auth Google sign-in; rewrite `middleware.ts`; drop the Supabase
  `updateSession` layer. **Re-home the AwardWallet state-cookie HMAC** from `AUTH0_SECRET`→
  `BETTER_AUTH_SECRET`. Re-validate the `returnTo` open-redirect guard and the AwardWallet
  sub-binding CSRF check against the new session shape. Enable lazy re-keying.
- **E — Cut over + remove.** After active users re-keyed: drop `@auth0/nextjs-auth0`,
  `@supabase/*`, `lib/auth0.ts`, `utils/supabase/*`, related env; add `user_id → user.id` FKs;
  decommission Auth0 tenant + Supabase project.

## Keep the two Googles distinct

Better Auth's `socialProviders.google` (login identity → Better Auth `account` table) is
**separate** from `lib/gmail.ts`'s `gmail.readonly` OAuth (travel history → `hop_travel_history`).
Use **different OAuth clients + env names** so scopes/consent screens never collide.

## Where Gmail lands

The Gmail travel-history feature is already **code-complete** (OAuth start/callback, read, parser,
persistence, account UI, concierge wiring) — gated by `HOP_ENABLE_GMAIL_HISTORY` + Google creds.
On the new stack: its table (`hop_travel_history`) is created in **Phase A**; the in-chat live
"Connect Gmail" affordance (currently an inert "Soon" pill) is UI work that can ship independently.

## Upstash (independent, can ship first)

`lib/rate-limit.ts` is in-memory per-process — leaky on Vercel serverless (a client across
instances bypasses it). Swap to `@upstash/ratelimit` + `@upstash/redis`, keyed by user id / IP,
with graceful fallback to the in-memory bucket when Redis env is absent. Also a TTL cache for
AwardWallet balances, Unsplash `destinationImages`, and weather.

## What YOU must provision (unblocks Phase A onward)

- **Neon** project → `DATABASE_URL`.
- **`BETTER_AUTH_SECRET`** + `BETTER_AUTH_URL`.
- **Google OAuth client for social login** (`GOOGLE_CLIENT_ID`/`SECRET`, redirect
  `…/api/auth/callback/google`) — separate from the Gmail-readonly client.
- **Data export**: Auth0 users (sub↔email) + Supabase dump of the 9 `hop_*` tables → Neon.
- **Upstash**: confirm `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or the `KV_*`
  names Vercel sets) are in the env.

## What I can do in code (no infra)

Drizzle schema/config; rewrite of the 9 owner libs + `withDb`; `lib/auth.ts` + auth route +
`lib/session.ts`; the ~30 call-site swaps; `middleware.ts` rewrite; re-keying script + lazy hook;
env-name updates; the Upstash limiter (with fallback) ships today.
