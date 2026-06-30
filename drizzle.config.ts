import { defineConfig } from 'drizzle-kit'

// Drizzle Kit config — used for `generate` (offline SQL from lib/db/schema.ts)
// and migrations. The UNPOOLED Neon URL is preferred for DDL/migrations; falls
// back to the pooled URL. Credentials come from the env (never committed).
export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '',
  },
})
