// Lazy, typed accessors for upstream API credentials.
// Reads from process.env at CALL time (never at import time) so that
// importing a client never throws, and tests can run without real keys.
// Never logs secret values.

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
}

// True when a key is present without throwing — lets a client degrade
// gracefully (return {ok:false}) instead of surfacing a config error.
export function hasEnv(key: EnvKey): boolean {
  const value = process.env[key]
  return Boolean(value && value.trim() !== '')
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
