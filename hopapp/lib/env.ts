// Lazy, typed accessors for upstream API credentials.
// Reads from process.env at CALL time (never at import time) so that
// importing a client never throws, and tests can run without real keys.
// Never logs secret values.

type EnvKey =
  | 'DUFFEL_API_KEY_LIVE'
  | 'SEATS_AERO_API_KEY'
  | 'AWARDWALLET_API_KEY'
  | 'AWARDWALLET_USER_ID'

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
  seatsAeroApiKey: () => read('SEATS_AERO_API_KEY'),
  awardWalletApiKey: () => read('AWARDWALLET_API_KEY'),
  awardWalletUserId: () => read('AWARDWALLET_USER_ID'),
}

// True when a key is present without throwing — lets a client degrade
// gracefully (return {ok:false}) instead of surfacing a config error.
export function hasEnv(key: EnvKey): boolean {
  const value = process.env[key]
  return Boolean(value && value.trim() !== '')
}
