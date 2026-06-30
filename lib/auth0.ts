import { Auth0Client } from '@auth0/nextjs-auth0/server'

// On Vercel preview deployments VERCEL_URL is the unique deployment hostname
// (e.g. hop-abc123-n3wth.vercel.app). Auth0 needs this as the base URL so
// /auth/callback resolves back to the preview rather than production.
// Production keeps APP_BASE_URL; local dev falls through to Auth0's default.
function resolveBaseUrl(): string | undefined {
  if (process.env.VERCEL_URL && process.env.VERCEL_ENV !== 'production') {
    return `https://${process.env.VERCEL_URL}`
  }
  return process.env.APP_BASE_URL
}

export const auth0 = new Auth0Client({ appBaseUrl: resolveBaseUrl() })

// Graceful degradation (house style): when Auth0 isn't configured for the
// current environment — e.g. preview deployments and local dev without the
// AUTH0_* secrets — `getSession()` would otherwise throw an
// InvalidConfigurationError and crash any page/route that reads the session
// (the home page, /ask, /account, …) straight into the error boundary.
//
// middleware.ts already skips the Auth0 layer when AUTH0_DOMAIN is absent
// ("so the app loads instead of 500ing"); this brings session reads to the
// same contract. Every caller already treats a missing session as signed-out
// (`session?.user`), so the unconfigured path simply renders signed-out.
//
// Behavior where Auth0 IS configured (production) is unchanged: we delegate to
// the real getSession verbatim — no error is swallowed — so a genuine auth
// failure still surfaces exactly as before. AUTH0_DOMAIN is the same sentinel
// the middleware uses.
const realGetSession = auth0.getSession.bind(auth0)
auth0.getSession = ((...args: Parameters<typeof realGetSession>) => {
  if (!process.env.AUTH0_DOMAIN) return Promise.resolve(null)
  return realGetSession(...args)
}) as typeof auth0.getSession
