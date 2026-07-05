// Direct coverage for the Postgrest-compat shim (lib/supabase-helpers.ts) —
// the single choke point every hop_* library queries through. These lock the
// contracts that silently broke during the Supabase → Drizzle cutover:
// `.select()` after a write must NOT clobber the write, array payloads must
// survive, composite onConflict targets must resolve, and unknown columns must
// fail CLOSED rather than widen the query.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withDb } from '@/lib/supabase-helpers'

type Log = {
  op?: string
  values?: unknown
  conflict?: { target: unknown[]; set?: Record<string, unknown> }
  projection?: Record<string, unknown>
  where?: unknown
  calls: string[]
}

const holder: { db: unknown; log: Log } = { db: null, log: { calls: [] } }

vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>()
  return { ...mod, getDb: () => holder.db }
})

function makeFakeDb(rows: Record<string, unknown>[] = []) {
  const log: Log = { calls: [] }
  const chain = (result: unknown[]) => {
    const b: Record<string, unknown> = {}
    Object.assign(b, {
      where: (w: unknown) => ((log.where = w), b),
      orderBy: () => b,
      limit: () => b,
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
        Promise.resolve(result).then(res, rej),
    })
    return b
  }
  const db = {
    select: (projection?: Record<string, unknown>) => {
      log.calls.push('select')
      log.projection = projection
      return {
        from: () => chain(projection && 'count' in projection ? [{ count: rows.length }] : rows),
      }
    },
    insert: () => ({
      values: (v: unknown) => {
        log.calls.push('insert')
        log.op = log.op ?? 'insert'
        log.values = v
        const written = Array.isArray(v) ? v : [v]
        return {
          returning: () => Promise.resolve(written),
          onConflictDoUpdate: (opts: Log['conflict']) => {
            log.op = 'upsert'
            log.conflict = opts
            return { returning: () => Promise.resolve(written) }
          },
          onConflictDoNothing: (opts: Log['conflict']) => {
            log.op = 'upsert-ignore'
            log.conflict = opts
            return { returning: () => Promise.resolve([]) }
          },
        }
      },
    }),
    update: () => ({
      set: (v: unknown) => {
        log.calls.push('update')
        log.op = 'update'
        log.values = v
        const b: Record<string, unknown> = {}
        Object.assign(b, {
          where: (w: unknown) => ((log.where = w), b),
          returning: () => Promise.resolve(rows),
        })
        return b
      },
    }),
    delete: () => {
      log.calls.push('delete')
      log.op = 'delete'
      const b: Record<string, unknown> = {}
      Object.assign(b, {
        where: (w: unknown) => ((log.where = w), b),
        returning: () => Promise.resolve(rows),
      })
      return b
    },
  }
  holder.db = db
  holder.log = log
  return log
}

beforeEach(() => {
  holder.db = null
  holder.log = { calls: [] }
})

describe('write + .select() read-back (Postgrest chaining)', () => {
  it('insert(...).select().single() executes the INSERT, not a table scan', async () => {
    const log = makeFakeDb()
    const res = await withDb(null as unknown, async (db) =>
      await db
        .from('hop_manual_balances')
        .insert({ user_id: 'u1', program: 'Amex MR', balance: 1000 })
        .select('id,user_id')
        .single(),
    )
    expect(log.op).toBe('insert')
    expect(log.calls).not.toContain('select')
    expect((res as { data: { user_id: string } }).data.user_id).toBe('u1')
  })

  it('update(...).eq(...).select() keeps the update and its scoping filter', async () => {
    const log = makeFakeDb([{ userId: 'u1', program: 'Amex MR' }])
    await withDb(null as unknown, async (db) =>
      await db.from('hop_manual_balances').update({ balance: 5 }).eq('user_id', 'u1').select(),
    )
    expect(log.op).toBe('update')
    expect(log.where).toBeDefined()
  })
})

describe('array payloads', () => {
  it('bulk insert passes the array through row-by-row (camel-mapped)', async () => {
    const log = makeFakeDb()
    await withDb(null as unknown, async (db) =>
      await db
        .from('hop_degradation_events')
        .insert([{ source: 'cash' }, { source: 'awards', route: 'SFO-NRT' }]),
    )
    expect(log.op).toBe('insert')
    expect(Array.isArray(log.values)).toBe(true)
    expect((log.values as unknown[]).length).toBe(2)
  })
})

describe('upsert semantics', () => {
  it('resolves composite onConflict targets (user_id,kind,value)', async () => {
    const log = makeFakeDb()
    await withDb(null as unknown, async (db) =>
      await db
        .from('hop_inferred_facts')
        .upsert(
          { user_id: 'u1', kind: 'cabin', value: 'business', confidence: 0.8 },
          { onConflict: 'user_id,kind,value' },
        ),
    )
    expect(log.op).toBe('upsert')
    expect(log.conflict?.target).toHaveLength(3)
    // non-target columns update from EXCLUDED, so multi-row upserts stay per-row
    expect(Object.keys(log.conflict?.set ?? {})).toContain('confidence')
    expect(Object.keys(log.conflict?.set ?? {})).not.toContain('userId')
  })

  it('ignoreDuplicates maps to ON CONFLICT DO NOTHING', async () => {
    const log = makeFakeDb()
    await withDb(null as unknown, async (db) =>
      await db
        .from('hop_support_tickets')
        .upsert(
          { message_id: 'm1', from_email: 'a@b.c' },
          { onConflict: 'message_id', ignoreDuplicates: true },
        ),
    )
    expect(log.op).toBe('upsert-ignore')
  })

  it('unknown onConflict column fails closed', async () => {
    makeFakeDb()
    const res = await withDb(null as unknown, async (db) =>
      await db.from('hop_user_prefs').upsert({ user_id: 'u1' }, { onConflict: 'nonexistent_col' }),
    )
    expect((res as { error: unknown }).error).toBeTruthy()
  })
})

describe('fail-closed filters', () => {
  it('unknown filter column returns an error instead of widening the query', async () => {
    const log = makeFakeDb([{ userId: 'someone-else' }])
    const res = await withDb(null as unknown, async (db) =>
      await db.from('hop_manual_balances').select().eq('not_a_column', 'x'),
    )
    expect((res as { error: unknown; data: unknown }).error).toBeTruthy()
    expect((res as { data: unknown }).data).toBeNull()
    expect(log.calls).not.toContain('select')
  })
})

describe('count/head', () => {
  it("{ count: 'exact', head: true } counts without fetching rows", async () => {
    makeFakeDb([{ id: 1 }, { id: 2 }, { id: 3 }])
    const res = await withDb(null as unknown, async (db) =>
      await db.from('hop_outclicks').select('*', { count: 'exact', head: true }).eq('kind', 'card'),
    )
    expect((res as { count: number }).count).toBe(3)
    expect((res as { data: unknown }).data).toBeNull()
  })
})

describe('single/maybeSingle', () => {
  it('maybeSingle with zero rows → null data, no error', async () => {
    makeFakeDb([])
    const res = await withDb(null as unknown, async (db) =>
      await db.from('hop_user_prefs').select().eq('user_id', 'u1').maybeSingle(),
    )
    expect((res as { data: unknown; error: unknown }).data).toBeNull()
    expect((res as { error: unknown }).error).toBeNull()
  })

  it('single with multiple rows errors (Postgrest contract)', async () => {
    makeFakeDb([{ userId: 'a' }, { userId: 'b' }])
    const res = await withDb(null as unknown, async (db) =>
      await db.from('hop_manual_balances').select().single(),
    )
    expect((res as { error: unknown }).error).toBeTruthy()
  })
})

describe('unconfigured database', () => {
  it('returns a per-query error result (withDb fallback semantics preserved by callers)', async () => {
    holder.db = null
    const res = await withDb(null as unknown, async (db) =>
      await db.from('hop_user_prefs').select().eq('user_id', 'u1').maybeSingle(),
    )
    expect((res as { data: unknown; error: unknown }).data).toBeNull()
    expect((res as { error: unknown }).error).toBeTruthy()
  })
})
