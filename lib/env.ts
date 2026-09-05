// Lazy, typed accessors for upstream API credentials.
// Reads from process.env at CALL time (never at import time) so that
// importing a client never throws, and tests can run without real keys.
// Never logs secret values.

import { createHash } from 'node:crypto'

export type EnvKey =
  | 'DUFFEL_API_KEY_LIVE'
  // TEST-mode token (duffel_test_…) — native cash checkout books against this
  // ONLY. Orders/payments must never touch the live key (real money).
  | 'DUFFEL_API_KEY_TEST'
  | 'SEATS_AERO_API_KEY'
  | 'AWARDWALLET_API_KEY'
  | 'AWARDWALLET_USER_ID'
  // Hosted "Connect Users" authorization URL for our AwardWallet business
  // account (configured in the business dashboard). The OAuth start route
  // redirects users here; AwardWallet returns them to our callback.
  | 'AWARDWALLET_CONNECT_URL'
  // Google OAuth (Gmail readonly) for the travel-history seam. The client id +
  // secret come from a Google Cloud project's OAuth consent screen; the callback
  // ({APP_BASE_URL}/auth/gmail/callback) must be registered as an authorized
  // redirect URI. See the final report's "dashboard config" note.
  | 'GOOGLE_OAUTH_CLIENT_ID'
  | 'GOOGLE_OAUTH_CLIENT_SECRET'
  // Resend transactional email — powers proactive standing-order alert delivery
  // (lib/email.ts). Absent → the sender no-ops gracefully (alerts stay in-app,
  // `delivered` stays false) and the cron skips delivery entirely. Never logged.
  | 'RESEND_API_KEY'
  // Shared secret guarding POST /api/support-ingest — the Cloudflare support@
  // Worker presents it as a Bearer token to file inbound emails as tickets.
  // Absent → the ingest endpoint rejects EVERY request (no unauthenticated writes).
  | 'HOP_SUPPORT_INGEST_SECRET'
  // Shared secret guarding POST /api/balance-sync/ingest — the Cloudflare
  // balance-sync Email Worker presents it as a Bearer token to relay forwarded
  // loyalty-balance emails. Absent → the ingest endpoint rejects EVERY request.
  | 'HOP_BALANCE_INGEST_SECRET'
  // 64-hex (32-byte) AES-256-GCM key for the loyalty-credential vault
  // (lib/credential-vault.ts). Absent → the credential-sync seam is OFF and no
  // credential can be stored or read. Never logged.
  | 'HOP_CREDENTIAL_KEY'
  // Base URL of the deployed Cloudflare Browser Rendering worker that signs in
  // to a loyalty site and returns the dashboard text (cloudflare/
  // balance-fetch-worker), no trailing slash — plus its shared Bearer secret.
  | 'HOP_BALANCE_FETCH_WORKER_URL'
  | 'HOP_BALANCE_FETCH_SECRET'
  // Base URL of the deployed Cloudflare Worker that aggregates live cpp
  // observations into per-program valuation overrides (no trailing slash), e.g.
  // "https://hop-valuations.<subdomain>.workers.dev". See lib/valuation-telemetry.ts
  // (POST /observe) and lib/valuation-overrides.ts (the Worker's GET /valuations
  // is instead pulled into Supabase by the Worker itself on its own cron).
  | 'HOP_VALUATION_WORKER_URL'
  // Shared bearer secret between Vercel and the valuation Worker.
  | 'HOP_VALUATION_SYNC_SECRET'
  // Commission Junction / Bankrate affiliate tag for card-affiliates.ts
  | 'NEXT_PUBLIC_CJ_AFFILIATE_TAG'
  // Stripe API credentials and prices
  | 'STRIPE_SECRET_KEY'
  | 'STRIPE_PUBLISHABLE_KEY'
  | 'STRIPE_WEBHOOK_SECRET'
  | 'NEXT_PUBLIC_STRIPE_PRICE_MONTHLY'
  | 'NEXT_PUBLIC_STRIPE_PRICE_YEARLY'
  | 'STRIPE_PRICE_ID_PRO_MONTHLY'
  | 'STRIPE_PRICE_ID_PRO_YEARLY'
  // Linear — the health sentinel's issue-filing channel (lib/linear.ts, ADR
  // 0007). The ONE runtime key the self-improvement loop adds to Vercel: blast
  // radius is "can create issues in one team", and the key is never logged.
  // Absent → filing degrades to detect-and-record (findings accumulate in
  // hop_improvement_findings; P1s fall back to the owner email).
  | 'LINEAR_API_KEY'
  | 'LINEAR_TEAM_ID'
  // PostHog server-side capture (lib/posthog-server.ts). The write-only project
  // token — POSTHOG_KEY (server) wins over the public client token. Absent →
  // captureServerEvent is a no-op.
  | 'POSTHOG_KEY'
  | 'NEXT_PUBLIC_POSTHOG_KEY'
  // Vercel-marketplace-integration-provided fallback token (auto-injected when
  // the PostHog integration is installed from the Vercel Marketplace). Same
  // fallback instrumentation.ts already applies for LLM tracing — kept in sync
  // here so server + client capture don't silently no-op in that setup.
  | 'NEXT_PUBLIC_VERCEL_HOP_POSTHOG_PROJECT_TOKEN'
  // Optional ingestion-host override (no trailing slash); defaults to the US
  // cloud host in lib/posthog-server.ts when absent.
  | 'POSTHOG_HOST'
  | 'NEXT_PUBLIC_POSTHOG_HOST'
  // Vercel-marketplace-integration-provided fallback host — same pairing as
  // NEXT_PUBLIC_VERCEL_HOP_POSTHOG_PROJECT_TOKEN above.
  | 'NEXT_PUBLIC_VERCEL_HOP_POSTHOG_HOST'
  // LLM tracing is privacy-sensitive and disabled unless this flag AND a
  // configured PostHog project key are present.
  | 'HOP_ENABLE_LLM_TRACING'
  // ── Identity + data (Better Auth on Neon) ─────────────────────────────────
  // Neon Postgres connection string (pooled). The Drizzle client (lib/db) and
  // Better Auth both read it lazily; absent → getDb() returns null and every
  // withDb caller degrades to its fallback.
  | 'DATABASE_URL'
  // Unpooled Neon URL — preferred by drizzle-kit for DDL/migrations.
  | 'DATABASE_URL_UNPOOLED'
  // Session-signing secret for Better Auth. AUTH_SECRET is accepted as an
  // alias (Better Auth reads both natively; we resolve explicitly in lib/auth).
  | 'BETTER_AUTH_SECRET'
  | 'AUTH_SECRET'
  // Canonical app origin for OAuth callbacks/redirects (falls back to
  // NEXT_PUBLIC_SITE_URL, then the hop.flights production domain on Vercel).
  | 'BETTER_AUTH_URL'
  // Google social login for Better Auth. This is a DIFFERENT Google OAuth
  // client from the Gmail travel-history seam (GOOGLE_OAUTH_CLIENT_ID/SECRET).
  // GOOGLE_ID/GOOGLE_SECRET are accepted aliases (the names used in Vercel).
  | 'GOOGLE_CLIENT_ID'
  | 'GOOGLE_CLIENT_SECRET'
  | 'GOOGLE_ID'
  | 'GOOGLE_SECRET'
  // Fine-grained PAT (read-only "Pull requests" scope is enough) for the
  // admin Team view (lib/admin-team.ts) to list each agent's open PRs.
  // Absent → the Team page still renders fully; each card just shows a quiet
  // "connect GITHUB_TOKEN to see live work" note instead of PR data.
  | 'GITHUB_TOKEN'
  // Svix-format signing secret (whsec_…) for the Resend email-event webhook
  // (app/api/webhooks/resend/route.ts). Absent → the route still exists but
  // logs and no-ops instead of verifying/processing (dev/local has no way to
  // receive real Resend deliveries anyway).
  | 'RESEND_WEBHOOK_SECRET'
  // Dedicated HMAC key for lib/newsletter.ts#deriveUnsubscribeToken.
  // DELIBERATELY separate from BETTER_AUTH_SECRET/AUTH_SECRET: the newsletter
  // derives each subscriber's unsubscribe-link token as
  // HMAC-SHA256(secret, email) and stores only its hash, so the app must be
  // able to reproduce the exact same plaintext for the life of the link — but
  // the auth secret gets rotated for session-signing reasons that have
  // nothing to do with the newsletter. Rotate BETTER_AUTH_SECRET alone and
  // every unsubscribe link already emailed to a real subscriber stops
  // matching its stored hash — see resolveNewsletterUnsubscribeSecret() below
  // and docs/ops-runbook.md's "Newsletter unsubscribe secret" section. Absent
  // → falls back to resolveAuthSecret()'s own chain, so existing/local setups
  // keep working with no new config, but rotation is then unsafe for the
  // newsletter until this is set explicitly.
  | 'NEWSLETTER_UNSUBSCRIBE_SECRET'

function read(key: EnvKey): string {
  const value = process.env[key]
  if (!value || value.trim() === '') {
    // Name only — never include the value (it's absent anyway).
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export const env = {
  duffelApiKey: () => read('DUFFEL_API_KEY_LIVE'),
  duffelTestApiKey: () => read('DUFFEL_API_KEY_TEST'),
  seatsAeroApiKey: () => read('SEATS_AERO_API_KEY'),
  awardWalletApiKey: () => read('AWARDWALLET_API_KEY'),
  awardWalletUserId: () => read('AWARDWALLET_USER_ID'),
  awardWalletConnectUrl: () => read('AWARDWALLET_CONNECT_URL'),
  googleOAuthClientId: () => read('GOOGLE_OAUTH_CLIENT_ID'),
  googleOAuthClientSecret: () => read('GOOGLE_OAUTH_CLIENT_SECRET'),
  resendApiKey: () => read('RESEND_API_KEY'),
  supportIngestSecret: () => read('HOP_SUPPORT_INGEST_SECRET'),
  balanceIngestSecret: () => read('HOP_BALANCE_INGEST_SECRET'),
  credentialKey: () => read('HOP_CREDENTIAL_KEY'),
  balanceFetchWorkerUrl: () => read('HOP_BALANCE_FETCH_WORKER_URL'),
  balanceFetchSecret: () => read('HOP_BALANCE_FETCH_SECRET'),
  hopValuationWorkerUrl: () => read('HOP_VALUATION_WORKER_URL'),
  hopValuationSyncSecret: () => read('HOP_VALUATION_SYNC_SECRET'),
  stripeSecretKey: () => read('STRIPE_SECRET_KEY'),
  stripePublishableKey: () => read('STRIPE_PUBLISHABLE_KEY'),
  stripeWebhookSecret: () => read('STRIPE_WEBHOOK_SECRET'),
  stripePriceMonthly: () => {
    const val = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY
    if (val && val.trim() !== '') return val
    return read('STRIPE_PRICE_ID_PRO_MONTHLY')
  },
  stripePriceYearly: () => {
    const val = process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY
    if (val && val.trim() !== '') return val
    const pro = process.env.STRIPE_PRICE_ID_PRO_YEARLY
    if (pro && pro.trim() !== '') return pro
    return ''
  },
  stripePriceIdProMonthly: () => read('STRIPE_PRICE_ID_PRO_MONTHLY'),
  stripePriceIdProYearly: () => read('STRIPE_PRICE_ID_PRO_YEARLY'),
  linearApiKey: () => read('LINEAR_API_KEY'),
  linearTeamId: () => read('LINEAR_TEAM_ID'),
  // Product-event capture (client + server) also falls back to the Vercel
  // marketplace token: without it, events silently no-op in any deployment
  // where that integration is the only source of the key.
  posthogKey: () =>
    firstEnv('POSTHOG_KEY', 'NEXT_PUBLIC_POSTHOG_KEY', 'NEXT_PUBLIC_VERCEL_HOP_POSTHOG_PROJECT_TOKEN'),
  posthogHost: () =>
    firstEnv('POSTHOG_HOST', 'NEXT_PUBLIC_POSTHOG_HOST', 'NEXT_PUBLIC_VERCEL_HOP_POSTHOG_HOST'),
  llmTracingPosthogKey: () =>
    firstEnv(
      'POSTHOG_KEY',
      'NEXT_PUBLIC_POSTHOG_KEY',
      'NEXT_PUBLIC_VERCEL_HOP_POSTHOG_PROJECT_TOKEN',
    ),
  llmTracingPosthogHost: () =>
    firstEnv(
      'POSTHOG_HOST',
      'NEXT_PUBLIC_POSTHOG_HOST',
      'NEXT_PUBLIC_VERCEL_HOP_POSTHOG_HOST',
    ),
  databaseUrl: () => read('DATABASE_URL'),
  googleClientId: () => firstEnv('GOOGLE_CLIENT_ID', 'GOOGLE_ID'),
  googleClientSecret: () => firstEnv('GOOGLE_CLIENT_SECRET', 'GOOGLE_SECRET'),
  githubToken: () => read('GITHUB_TOKEN'),
  resendWebhookSecret: () => read('RESEND_WEBHOOK_SECRET'),
}

// First non-empty value across alias keys (throws naming the primary key when
// every alias is absent — same contract as read()).
function firstEnv(...keys: EnvKey[]): string {
  for (const key of keys) {
    const value = process.env[key]
    if (value && value.trim() !== '') return value
  }
  throw new Error(`Missing required environment variable: ${keys[0]}`)
}

// Server-side PostHog capture is available when ANY token is present
// (lib/posthog-server.ts no-ops otherwise). Key presence is the whole gate —
// capture is fire-and-forget observability, not a product seam.
export function isPostHogEnabled(): boolean {
  return (
    hasEnv('POSTHOG_KEY') ||
    hasEnv('NEXT_PUBLIC_POSTHOG_KEY') ||
    hasEnv('NEXT_PUBLIC_VERCEL_HOP_POSTHOG_PROJECT_TOKEN')
  )
}

// LLM tracing is a privacy-sensitive double lock: a project key alone never
// activates it. The AI SDK call-site helper separately disables input/output
// recording even when this returns true.
export function isLlmTracingEnabled(): boolean {
  const flag = process.env.HOP_ENABLE_LLM_TRACING ?? ''
  const on = /^(1|true|yes)$/i.test(flag.trim())
  return (
    on &&
    (hasEnv('POSTHOG_KEY') ||
      hasEnv('NEXT_PUBLIC_POSTHOG_KEY') ||
      hasEnv('NEXT_PUBLIC_VERCEL_HOP_POSTHOG_PROJECT_TOKEN'))
  )
}

// True when a key is present without throwing — lets a client degrade
// gracefully (return {ok:false}) instead of surfacing a config error.
export function hasEnv(key: EnvKey): boolean {
  const value = process.env[key]
  return Boolean(value && value.trim() !== '')
}

// Google social login is available only when a Better Auth Google client is
// fully configured (either canonical or alias names). Off → /login renders the
// sign-in-unavailable state instead of a button that dead-ends at Google.
export function isGoogleAuthEnabled(): boolean {
  return (
    (hasEnv('GOOGLE_CLIENT_ID') || hasEnv('GOOGLE_ID')) &&
    (hasEnv('GOOGLE_CLIENT_SECRET') || hasEnv('GOOGLE_SECRET'))
  )
}

// The session-signing secret for Better Auth AND the HMAC key for OAuth state
// binding (AwardWallet connect). Resolution: explicit secret → alias → a
// derived key from DATABASE_URL (deterministic across deploys; rotates only
// with the database URL). Returns null when nothing is available — callers
// fail closed.
export function resolveAuthSecret(): string | null {
  const explicit = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET
  if (explicit && explicit.trim() !== '') return explicit.trim()
  const dbUrl = process.env.DATABASE_URL
  if (dbUrl && dbUrl.trim() !== '') {
    // Deriving from DATABASE_URL keeps production sessions working when only
    // the database is configured. Anyone holding DATABASE_URL already owns the
    // data, so this adds no new exposure — but set BETTER_AUTH_SECRET properly.
    if (!warnedDerivedSecret) {
      warnedDerivedSecret = true
      console.warn(
        '[auth] BETTER_AUTH_SECRET is not set — deriving a session secret from DATABASE_URL. ' +
          'Set BETTER_AUTH_SECRET (or AUTH_SECRET) in the environment.',
      )
    }
    return createHash('sha256').update(`hop-better-auth:${dbUrl.trim()}`).digest('hex')
  }
  return null
}
let warnedDerivedSecret = false

// Key for lib/newsletter.ts#deriveUnsubscribeToken's HMAC — decoupled from
// session-signing on purpose. Resolution: explicit NEWSLETTER_UNSUBSCRIBE_SECRET
// (the ONLY tier that's actually immune to a BETTER_AUTH_SECRET/AUTH_SECRET
// rotation) → resolveAuthSecret()'s own chain → a fixed non-secret dev
// fallback (local/test only — the newsletter feature is gated off by default
// anyway, see isNewsletterEnabled). Never throws, never null — a caller can
// always derive a token, but only the first tier survives an auth-secret
// rotation without breaking outstanding unsubscribe links. See the EnvKey doc
// comment above and docs/ops-runbook.md's "Newsletter unsubscribe secret"
// section for the operational guidance.
export function resolveNewsletterUnsubscribeSecret(): string {
  const explicit = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET
  if (explicit && explicit.trim() !== '') return explicit.trim()
  return resolveAuthSecret() ?? 'hop-newsletter-unsubscribe-dev-fallback'
}

// Native cash checkout is GATED. It activates only when BOTH the explicit flag
// is on AND a TEST token is present — otherwise the cash CTA keeps its current
// Kiwi deep-link behavior. This keeps production on deep-link until both are set
// (flip HOP_ENABLE_CHECKOUT and provide DUFFEL_API_KEY_TEST to enable).
export function isCheckoutEnabled(): boolean {
  const flag = process.env.HOP_ENABLE_CHECKOUT ?? ''
  const on = /^(1|true|yes)$/i.test(flag.trim())
  return on && hasEnv('DUFFEL_API_KEY_TEST')
}

// The Gmail travel-history seam is GATED behind an explicit flag AND real Google
// OAuth credentials. Until BOTH are set, the "Connect Gmail" affordance stays in
// its "coming soon" state and getTravelHistory returns the not-connected empty
// history — so production never initiates an OAuth flow against an unconfigured
// client. Flip HOP_ENABLE_GMAIL_HISTORY and provide GOOGLE_OAUTH_CLIENT_ID +
// GOOGLE_OAUTH_CLIENT_SECRET to enable.
export function isGmailHistoryEnabled(): boolean {
  const flag = process.env.HOP_ENABLE_GMAIL_HISTORY ?? ''
  const on = /^(1|true|yes)$/i.test(flag.trim())
  return on && hasEnv('GOOGLE_OAUTH_CLIENT_ID') && hasEnv('GOOGLE_OAUTH_CLIENT_SECRET')
}

// Balance sync (paste / email-forward balance extraction — the AwardWallet-
// independent syncing seam) is GATED behind an explicit flag ONLY: the
// deterministic fallback parser needs no key, and the AI path already degrades
// to it when AI_GATEWAY_API_KEY is absent (lib/ai-gateway returns null). Off →
// the /account affordance doesn't render, the paste route answers 503, and the
// email-ingest route refuses even with a valid secret. The email rail
// additionally needs HOP_BALANCE_INGEST_SECRET + the deployed
// cloudflare/balance-sync-worker (see docs/plans/2026-07-05-balance-sync.md).
export function isBalanceSyncEnabled(): boolean {
  const flag = process.env.HOP_ENABLE_BALANCE_SYNC ?? ''
  return /^(1|true|yes)$/i.test(flag.trim())
}

// Credential-based auto-sync (hop signs in to a loyalty site and reads the
// balance) is GATED behind an explicit flag AND a real vault key — without a
// proper AES key no credential may ever be stored. Off → the /account
// affordance doesn't render and the credential actions refuse softly. The
// scheduled FETCH additionally needs the Browser Rendering worker configured
// (isCredentialAutosyncLive) — vault on + worker absent means credentials can
// be stored but sync stays "pending", and the UI says so honestly.
export function isCredentialSyncEnabled(): boolean {
  const flag = process.env.HOP_ENABLE_CREDENTIAL_SYNC ?? ''
  const on = /^(1|true|yes)$/i.test(flag.trim())
  return on && /^[0-9a-f]{64}$/i.test((process.env.HOP_CREDENTIAL_KEY ?? '').trim())
}

// The scheduled credential fetch runs only when the vault is enabled AND the
// Cloudflare Browser Rendering worker is deployed + shared-secret configured.
export function isCredentialAutosyncLive(): boolean {
  return (
    isCredentialSyncEnabled() &&
    hasEnv('HOP_BALANCE_FETCH_WORKER_URL') &&
    hasEnv('HOP_BALANCE_FETCH_SECRET')
  )
}

// The standing-orders watcher (app/api/cron/standing-orders) only re-checks
// watches while STANDING_ORDERS_CRON_ENABLED is truthy — byte-identical
// matching to the cron route's own isEnabled() (no trim: if the two ever
// disagree, it must be this one saying "not live" while the runner works,
// never a promised ping the runner won't send). Surfaces read this so watch
// copy stays truthful (roadmap R1.3): off → "alerts go live soon".
export function isStandingOrdersCronLive(): boolean {
  return /^(1|true|yes)$/i.test(process.env.STANDING_ORDERS_CRON_ENABLED ?? '')
}

// The AwardWallet balance-cache cron (app/api/cron/awardwallet-sync) only
// re-syncs connected users' cached balances while AWARDWALLET_SYNC_CRON_ENABLED
// is truthy — flag-only, same shape as isStandingOrdersCronLive (no extra key:
// AWARDWALLET_API_KEY/AWARDWALLET_USER_ID already gate the underlying client).
// Off → bootstrap-on-connect and the manual Refresh button still populate the
// cache; only the periodic re-sync is gated. Flip AWARDWALLET_SYNC_CRON_ENABLED
// once npm run check/build are green and Refresh has been exercised for real.
export function isAwardWalletSyncCronLive(): boolean {
  return /^(1|true|yes)$/i.test(process.env.AWARDWALLET_SYNC_CRON_ENABLED ?? '')
}

// The live-valuation sync seam is GATED behind an explicit flag AND a configured
// Worker URL + shared secret. Until BOTH are set, lib/valuation-telemetry.ts
// no-ops (never POSTs an observation) and lib/valuations-live.ts still resolves
// (overrides just stay empty, so it's the pure lib/valuations.ts baseline).
// Flip HOP_ENABLE_VALUATION_SYNC and provide HOP_VALUATION_WORKER_URL +
// HOP_VALUATION_SYNC_SECRET to enable.
export function isValuationSyncEnabled(): boolean {
  const flag = process.env.HOP_ENABLE_VALUATION_SYNC ?? ''
  const on = /^(1|true|yes)$/i.test(flag.trim())
  return on && hasEnv('HOP_VALUATION_WORKER_URL') && hasEnv('HOP_VALUATION_SYNC_SECRET')
}

// Premium billing (Stripe-hosted Checkout unlocking unlimited alerts) is GATED
// behind an explicit flag AND the full Stripe config it needs: the secret key
// (checkout session creation), the webhook secret (signed tier writes), and the
// monthly price id (the thing being sold). The yearly price id is optional.
// Off → /account shows no billing section, the checkout/webhook routes refuse
// softly ({ok:false}/503), and the alert-cap copy stays unchanged — the deploy
// is a byte-for-byte no-op even with Stripe keys present in Vercel. Exactly the
// isCheckoutEnabled() double-lock pattern.
export function isBillingEnabled(): boolean {
  const flag = process.env.HOP_ENABLE_BILLING ?? ''
  const on = /^(1|true|yes)$/i.test(flag.trim())
  return (
    on &&
    hasEnv('STRIPE_SECRET_KEY') &&
    hasEnv('STRIPE_WEBHOOK_SECRET') &&
    hasEnv('STRIPE_PRICE_ID_PRO_MONTHLY')
  )
}

// Durable conversation MEMORY (rolling summaries of older concierge turns) is
// GATED behind an explicit flag AND the AI Gateway key it needs to condense. Off
// by default: the concierge reads no summary and writes none, and even when the
// flag is flipped the read/write no-op gracefully until the hop_conversation_summary
// table exists (withDb returns the fallback). Flip HOP_ENABLE_CONVO_MEMORY once
// the table is created to let resumed threads stay context-aware.
export function isConversationMemoryEnabled(): boolean {
  const flag = process.env.HOP_ENABLE_CONVO_MEMORY ?? ''
  const on = /^(1|true|yes)$/i.test(flag.trim())
  return on && Boolean(process.env.AI_GATEWAY_API_KEY?.trim())
}

// AI Customer Support Agent behind /support is GATED behind an explicit flag
// AND the AI Gateway key it needs to stream replies. Off by default: /support
// renders byte-identical static FAQ, and the route returns a calm 200 text line.
// Flip HOP_ENABLE_SUPPORT_AGENT and provide AI_GATEWAY_API_KEY to enable.
export function isSupportAgentEnabled(): boolean {
  const flag = process.env.HOP_ENABLE_SUPPORT_AGENT ?? ''
  const on = /^(1|true|yes)$/i.test(flag.trim())
  return on && Boolean(process.env.AI_GATEWAY_API_KEY?.trim())
}

// Inferred-facts ("hop noticed …") is GATED behind an explicit flag AND the AI
// Gateway key it needs to infer. Off by default: no inference runs, the glass box
// shows no "noticed" rows, and even flipped on the read/write no-op gracefully
// until the hop_inferred_facts table exists (withDb fallback). Nothing is ever
// auto-applied — inferred facts land as PENDING suggestions the user confirms.
// Flip HOP_ENABLE_INFERRED_FACTS once the table is created.
export function isInferredFactsEnabled(): boolean {
  const flag = process.env.HOP_ENABLE_INFERRED_FACTS ?? ''
  const on = /^(1|true|yes)$/i.test(flag.trim())
  return on && Boolean(process.env.AI_GATEWAY_API_KEY?.trim())
}

// Observed-outcomes ("hop learned from what you DO") is GATED behind an explicit
// flag ONLY — the aggregator is DETERMINISTIC (no LLM), so unlike the memory /
// inference seams it needs no gateway key. Off by default: verdict cards show no
// "Not for me" dismiss, nothing is recorded, and the glass box shows no "observed"
// rows. Even flipped on the read/write no-op gracefully until the
// hop_memory_outcomes table exists (withDb fallback). Flip
// HOP_ENABLE_OBSERVED_OUTCOMES once the table is created.
export function isObservedOutcomesEnabled(): boolean {
  const flag = process.env.HOP_ENABLE_OBSERVED_OUTCOMES ?? ''
  return /^(1|true|yes)$/i.test(flag.trim())
}

// Email/password sign-in (required verification + reset-by-email) is GATED
// behind an explicit flag AND a working Resend key — delivery is load-bearing
// here (a user who can't receive the verification email can never finish
// signing up), unlike e.g. isCheckoutEnabled's payments gate. Off → GoogleSignIn
// stays the only /login option; existing Google accounts are unaffected either
// way. Flip HOP_ENABLE_EMAIL_PASSWORD_AUTH and set RESEND_API_KEY to enable.
export function isEmailPasswordAuthEnabled(): boolean {
  const flag = process.env.HOP_ENABLE_EMAIL_PASSWORD_AUTH ?? ''
  const on = /^(1|true|yes)$/i.test(flag.trim())
  return on && hasEnv('RESEND_API_KEY')
}

// Newsletter foundation (R1.6 capture + R2.3 weekly digest) is GATED behind
// an explicit flag AND a working Resend key — same double-lock shape as
// isEmailPasswordAuthEnabled, because delivery is load-bearing here too (no
// confirmation email means no confirmed subscriber, ever). Off → the signup
// route is a full no-op (no DB write, generic success so the client never
// sees a broken form) and the digest cron returns 503 disabled, so nothing
// sends to a real inbox until Oliver flips both HOP_ENABLE_NEWSLETTER and a
// real RESEND_API_KEY.
export function isNewsletterEnabled(): boolean {
  const flag = process.env.HOP_ENABLE_NEWSLETTER ?? ''
  const on = /^(1|true|yes)$/i.test(flag.trim())
  return on && hasEnv('RESEND_API_KEY')
}

// Passkey/WebAuthn sign-in (@better-auth/passkey) is GATED behind its own
// explicit flag — no upstream credential is needed (WebAuthn needs only the
// `passkey` table plus the browser's platform authenticator), but flipping
// this changes what's stored in Neon and adds a new client SDK surface, so
// it's a deliberate opt-in rather than automatic once the table exists.
// Flip HOP_ENABLE_PASSKEY_AUTH to enable.
export function isPasskeyEnabled(): boolean {
  const flag = process.env.HOP_ENABLE_PASSKEY_AUTH ?? ''
  return /^(1|true|yes)$/i.test(flag.trim())
}

// The self-improvement loop (ADR 0007 — degradation telemetry + the daily
// health sentinel) is GATED behind an explicit flag ONLY — detection is
// DETERMINISTIC (counted rows, timestamp math, named constants; no LLM), so
// like the observed-outcomes seam it needs no key to detect. Off by default:
// recordDegradation() returns before touching anything, the sentinel route
// answers 503 disabled, and heartbeat READS degrade to null. The deploy is a
// byte-for-byte no-op until flipped, with ONE recorded exception: heartbeat
// WRITES are deliberately ungated (see ADR 0007's exception list). Filing
// findings as Linear issues additionally requires LINEAR_API_KEY +
// LINEAR_TEAM_ID (lib/linear.ts#isLinearConfigured) — the isEmailEnabled()
// split: detection is free, delivery needs a key.
export function isSelfImproveEnabled(): boolean {
  const flag = process.env.HOP_ENABLE_SELF_IMPROVE ?? ''
  return /^(1|true|yes)$/i.test(flag.trim())
}

// The AI-sourced sweet-spot candidate pipeline
// (docs/plans/2026-07-05-content-candidate-pipeline.md) is GATED behind an
// explicit flag AND the two live pricing keys it needs (SEATS_AERO_API_KEY for
// award space, DUFFEL_API_KEY_LIVE for the cash comparison) — the SAME
// credentials /search already requires live, so enabling costs no new secret.
// Deliberately independent of isValuationSyncEnabled()/the Worker: this
// pipeline mines assembleSearch directly rather than the Worker's aggregated
// telemetry (see the plan's §2 rejection of the Worker-extension path). Off →
// the cron answers 503 and the "Find candidates now" owner action refuses
// softly — the deploy is a byte-for-byte no-op until flipped.
export function isContentCandidatesEnabled(): boolean {
  const flag = process.env.HOP_ENABLE_CONTENT_CANDIDATES ?? ''
  const on = /^(1|true|yes)$/i.test(flag.trim())
  return on && hasEnv('SEATS_AERO_API_KEY') && hasEnv('DUFFEL_API_KEY_LIVE')
}

// Shareable verdict receipts (/v/[id] + OG cards, docs/plans/2026-07-02-viral-
// differentiation.md) are GATED behind an explicit flag ONLY — the seam needs
// no external key: the engine re-run uses upstream credentials that are
// already configured (or MOCK), and Neon persistence degrades gracefully via
// withDb like every other hop_* table. Off (default) → VerdictRail never
// renders the share button, shareVerdict() answers {ok:false,'disabled'}
// before touching anything, and /v/[id] + its OG image 404 before the DB
// read. Also the seam's emergency brake: flipping this off 404s every
// already-shared receipt link. Flip HOP_ENABLE_SHARE_RECEIPTS once
// drizzle/0010_nervous_clea.sql has been applied.
export function isShareReceiptsEnabled(): boolean {
  const flag = process.env.HOP_ENABLE_SHARE_RECEIPTS ?? ''
  return /^(1|true|yes)$/i.test(flag.trim())
}

// Partner API is off the paid path (ADR 0014). Flag defaults off. Even when
// a leftover key is present, lib/seatsaero.ts#searchAwards is a hard stub.
export function isSeatsAeroEnabled(): boolean {
  const flag = process.env.HOP_ENABLE_SEATSAERO ?? ''
  const on = /^(1|true|yes)$/i.test(flag.trim())
  return on && hasEnv('SEATS_AERO_API_KEY')
}
