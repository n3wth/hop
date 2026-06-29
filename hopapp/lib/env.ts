// Lazy, typed accessors for upstream API credentials.
// Reads from process.env at CALL time (never at import time) so that
// importing a client never throws, and tests can run without real keys.
// Never logs secret values.

type EnvKey =
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
