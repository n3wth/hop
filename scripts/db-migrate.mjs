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
  // Local dev: npm run db:migrate is often run outside Next, which doesn't
  // auto-load .env.local. Pull DATABASE_URL from there when present.
  try {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const envPath = path.join(process.cwd(), '.env.local')
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        if (!line || line.startsWith('#')) continue
        const i = line.indexOf('=')
        if (i < 1) continue
        const key = line.slice(0, i)
        if (process.env[key]) continue
        let value = line.slice(i + 1)
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        process.env[key] = value
      }
    }
  } catch {
    // fall through to skip
  }
}

const resolvedUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!resolvedUrl) {
  console.warn('[db:migrate] DATABASE_URL not set — skipping migrations')
  process.exit(0)
}

try {
  const db = drizzle(neon(resolvedUrl))
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('[db:migrate] migrations applied')
} catch (error) {
  console.error('[db:migrate] migration failed:', error)
  process.exit(1)
}
