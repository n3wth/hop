// The Neon + Drizzle client — hop's data layer for the Neon migration.
//
// Uses Neon's HTTP driver (one-shot queries; no connection pool to manage on
// serverless, and it works through HTTPS-only egress). Lazy: the env is read at
// CALL time, never at import, so a build or a Supabase-still-primary code path
// never throws when DATABASE_URL is absent. Returns null when unconfigured —
// callers (via withDb) fall back exactly as they do for Supabase today.

import { neon } from '@neondatabase/serverless'
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'

let cached: NeonHttpDatabase<typeof schema> | null | undefined

export function getDb(): NeonHttpDatabase<typeof schema> | null {
  if (cached !== undefined) return cached
  const url = process.env.DATABASE_URL
  cached = url ? drizzle(neon(url), { schema }) : null
  return cached
}

export { schema }
