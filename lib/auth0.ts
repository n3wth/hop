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
