// Better Auth config — identity via Google social login, persisted through the
// Drizzle adapter on Neon (lib/db).
//
// House conventions upheld here:
// - Lazy env: the database is resolved at REQUEST time through a proxy, so
//   importing this module never throws and a process started without
//   DATABASE_URL (build, MOCK=1 dev, tests) still imports cleanly. The first
//   real auth operation without a database fails loudly with a clear message,
//   which lib/session.ts converts into a signed-out state.
// - Secret resolution is explicit (lib/env.ts#resolveAuthSecret):
//   BETTER_AUTH_SECRET → AUTH_SECRET → derived from DATABASE_URL (warned).
// - The Google provider is only registered when fully configured
//   (lib/env.ts#isGoogleAuthEnabled) — no half-configured OAuth dead ends.

import { betterAuth } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { passkey } from '@better-auth/passkey'
import { getDb } from './db'
import * as schema from './db/schema'
import {
  isGoogleAuthEnabled,
  isEmailPasswordAuthEnabled,
  isPasskeyEnabled,
  resolveAuthSecret,
  env,
} from './env'
import { sendVerificationEmail, sendResetPasswordEmail } from './email'
import { captureServerEvent } from './posthog-server'

// Forwards every property access to the live Drizzle client at call time.
// Methods are bound to the real client so drizzle's internal `this` works.
const lazyDb = new Proxy({} as Record<PropertyKey, unknown>, {
  get(_target, prop) {
    const db = getDb()
    if (!db) {
      throw new Error(
        '[auth] DATABASE_URL is not set — auth is disabled until the database is configured',
      )
    }
    const value = (db as unknown as Record<PropertyKey, unknown>)[prop]
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(db) : value
  },
})

// Canonical origin for OAuth callbacks (`${baseURL}/api/auth/callback/google`
// must be registered in the Google console). Falls back to the request origin
// in local dev, where localhost callbacks are conventionally registered too.
function resolveBaseUrl(): string | undefined {
  const explicit = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL
  if (explicit && explicit.trim() !== '') return explicit.trim().replace(/\/$/, '')
  if (process.env.VERCEL_ENV === 'production') return 'https://hop.flights' // matches lib/seo.ts SITE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return undefined
}

const secret = resolveAuthSecret()

export const auth = betterAuth({
  database: drizzleAdapter(lazyDb as never, { provider: 'pg', schema }),
  ...(secret ? { secret } : {}),
  baseURL: resolveBaseUrl(),
  // The app answers on several domains; sign-in POSTs from any of them must
  // pass Better Auth's origin check.
  trustedOrigins: [
    'https://hop.flights',
    'https://www.hop.flights',
    'https://hop.n3wth.com',
    'https://hop-n3wth.vercel.app',
  ],
  socialProviders: isGoogleAuthEnabled()
    ? {
        google: {
          clientId: env.googleClientId(),
          clientSecret: env.googleClientSecret(),
        },
      }
    : {},
  // A user who signed up with Google and later sets a password (or vice versa)
  // shouldn't hit a "this email already exists" dead end — trust Google's own
  // verification of the address rather than treating it as a collision.
  account: {
    accountLinking: { enabled: true, trustedProviders: ['google'] },
  },
  // R0.5 funnel event #1 — signed_up fires exactly once per new user, at the
  // moment Better Auth inserts the row (every sign-up method funnels through
  // here). Fire-and-forget + keyed on the opaque user.id only; can never fail
  // the sign-up itself (captureServerEvent never throws).
  databaseHooks: {
    user: {
      create: {
        after: async (user: { id: string }) => {
          captureServerEvent('signed_up', {}, { distinctId: user.id })
        },
      },
    },
  },
  // Fully inert (no route accepts it) until isEmailPasswordAuthEnabled() — same
  // "no half-configured seam" rule as socialProviders above.
  ...(isEmailPasswordAuthEnabled()
    ? {
        emailAndPassword: {
          enabled: true,
          requireEmailVerification: true,
          sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
            await sendResetPasswordEmail(user.email, url)
          },
        },
        emailVerification: {
          sendOnSignUp: true,
          sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
            await sendVerificationEmail(user.email, url)
          },
        },
      }
    : {}),
  plugins: [
    ...(isPasskeyEnabled() ? [passkey({ rpID: resolvePasskeyRpId(), rpName: 'hop' })] : []),
    // nextCookies must stay LAST so Set-Cookie from server-side auth.api calls
    // (session refresh in RSC, sign-out in route handlers) reaches the browser.
    nextCookies(),
  ],
})
export type Auth = typeof auth

// Canonical rpID is 'hop.flights' (locked decision — WebAuthn scopes a passkey
// to exactly one rpID, so it can't span hop.flights/hop.n3wth.com/preview
// domains the way OAuth's multi-origin trustedOrigins list does). This can
// never work on http://localhost as-is — override via HOP_PASSKEY_RP_ID for
// local testing (e.g. 'localhost' in .env.local). Passkeys don't carry across
// rpIDs: dev-registered credentials won't authenticate in prod, and that's
// expected, not a bug.
function resolvePasskeyRpId(): string {
  const override = process.env.HOP_PASSKEY_RP_ID
  return override && override.trim() ? override.trim() : 'hop.flights'
}
