/* eslint-disable @typescript-eslint/no-explicit-any */
// Better Auth config — identity and social login provider using Drizzle Adapter on Neon.
//
// Gated: reads getDb() lazily so that static builds or offline environments
// never fail if DATABASE_URL is not configured.

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { getDb } from './db'
import * as schema from './db/schema'

const getAdapter = () => {
  const db = getDb()
  if (!db) {
    // Return a dummy schema-conforming adapter for static next builds
    return drizzleAdapter({} as any, { provider: 'pg', schema })
  }
  return drizzleAdapter(db, { provider: 'pg', schema })
}

export const auth = betterAuth({
  database: getAdapter(),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
  },
})
export type Auth = typeof auth
