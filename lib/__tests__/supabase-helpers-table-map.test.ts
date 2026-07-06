import { describe, it, expect, vi } from 'vitest'
import { getTableName, is } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'

// Regression guard for a real bug: hop_email_suppressions was added to
// lib/db/schema.ts but never added to lib/supabase-helpers.ts's TABLE_MAP,
// so every withDb .from('hop_email_suppressions') call silently resolved to
// "Table not found" — the whole suppression-list feature was permanently
// inert in production, invisible because every other test mocks withDb
// entirely. This walks every hop_* table Drizzle actually knows about and
// proves SupabaseCompatClient can resolve it, so the next added table can't
// go unwired the same way.

vi.mock('@/lib/db', () => ({ getDb: () => ({}) }))

import * as schema from '@/lib/db/schema'
import { SupabaseCompatClient } from '@/lib/supabase-helpers'

const hopTableNames = Object.values(schema)
  .filter((value) => is(value, PgTable))
  .map((table) => getTableName(table as PgTable))
  .filter((name) => name.startsWith('hop_'))

describe('TABLE_MAP covers every hop_* Drizzle table', () => {
  it('found at least the known set of hop_* tables (sanity check the walk itself works)', () => {
    expect(hopTableNames).toEqual(expect.arrayContaining(['hop_email_suppressions', 'hop_outclicks']))
  })

  it.each(hopTableNames)('%s resolves in SupabaseCompatClient (not "Table not found")', async (name) => {
    const db = new SupabaseCompatClient()
    const { error } = await db.from(name).select('*').limit(1)
    expect(error?.message ?? '').not.toMatch(/Table not found/)
  })
})
