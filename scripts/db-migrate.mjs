// Apply drizzle/ migrations to the Neon database over the HTTP driver (the
// same transport lib/db uses — works through HTTPS-only egress, no TCP pool).
//
// Wired into `npm run build` so every production deploy converges the schema
// before `next build`. Degrades by design:
//   - DATABASE_URL absent (CI, local checks, MOCK dev) → skip, exit 0.
//   - DATABASE_URL present but migration fails → exit 1 and FAIL the build:
//     shipping app code whose schema never arrived is the worse outcome.

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!url) {
  console.warn('[db:migrate] DATABASE_URL not set — skipping migrations')
  process.exit(0)
}

try {
  const db = drizzle(neon(url))
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('[db:migrate] migrations applied')
} catch (error) {
  console.error('[db:migrate] migration failed:', error)
  process.exit(1)
}
