// Coverage for lib/credential-vault.ts#listDueCredentials' retry rule: a row
// stamped `unsupported` must NOT be excluded forever once its program gains a
// verified fetch-worker recipe (RECIPE_SUPPORTED_PROGRAMS). Regression test
// for the #207 review finding — before this fix, `unsupported` rows were
// permanently filtered out regardless of later recipe additions.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { withDbMock } = vi.hoisted(() => ({ withDbMock: vi.fn() }))
vi.mock('@/lib/supabase-helpers', () => ({ withDb: withDbMock }))

const { listDueCredentials, RECIPE_SUPPORTED_PROGRAMS } = await import('@/lib/credential-vault')

const STALE_BEFORE = '2026-06-01T00:00:00.000Z'

const ROWS = [
  {
    id: 'never-synced',
    user_id: 'u1',
    program: 'delta-skymiles',
    secret_enc: 'enc1',
    status: 'pending',
    last_synced_at: null,
  },
  {
    id: 'stale',
    user_id: 'u2',
    program: 'united-mileageplus',
    secret_enc: 'enc2',
    status: 'pending',
    last_synced_at: '2026-01-01T00:00:00.000Z', // before STALE_BEFORE
  },
  {
    id: 'fresh',
    user_id: 'u3',
    program: 'amex-mr',
    secret_enc: 'enc3',
    status: 'ok',
    last_synced_at: '2026-06-15T00:00:00.000Z', // after STALE_BEFORE — not due
  },
  {
    id: 'unsupported-no-recipe',
    user_id: 'u4',
    program: 'no-recipe-program',
    secret_enc: 'enc4',
    status: 'unsupported',
    last_synced_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'unsupported-with-recipe',
    user_id: 'u5',
    program: 'has-recipe-program',
    secret_enc: 'enc5',
    status: 'unsupported',
    last_synced_at: '2026-01-01T00:00:00.000Z',
  },
]

// A minimal chainable fake matching the .select().neq/.eq/.lt/.is/.in().limit()
// subset listDueCredentials issues, filtering an in-memory row set.
function fakeDb(rows: typeof ROWS) {
  return {
    from() {
      const filters: Array<(r: (typeof ROWS)[number]) => boolean> = []
      let limitVal = Infinity
      const builder = {
        select: () => builder,
        neq: (col: string, val: unknown) => {
          filters.push((r) => (r as Record<string, unknown>)[col] !== val)
          return builder
        },
        eq: (col: string, val: unknown) => {
          filters.push((r) => (r as Record<string, unknown>)[col] === val)
          return builder
        },
        lt: (col: string, val: string) => {
          filters.push((r) => {
            const v = (r as Record<string, unknown>)[col]
            return typeof v === 'string' && v < val
          })
          return builder
        },
        is: (col: string, val: unknown) => {
          filters.push((r) => (r as Record<string, unknown>)[col] === val)
          return builder
        },
        in: (col: string, vals: unknown[]) => {
          filters.push((r) => vals.includes((r as Record<string, unknown>)[col]))
          return builder
        },
        limit: (n: number) => {
          limitVal = n
          return builder
        },
        then(resolve: (v: { data: unknown; error: null }) => unknown) {
          const data = rows.filter((r) => filters.every((f) => f(r))).slice(0, limitVal)
          return Promise.resolve({ data, error: null }).then(resolve)
        },
      }
      return builder
    },
  }
}

beforeEach(() => {
  withDbMock.mockImplementation((_fallback: unknown, fn: (db: unknown) => unknown) => fn(fakeDb(ROWS)))
})

afterEach(() => {
  // RECIPE_SUPPORTED_PROGRAMS is a real Set at runtime (typed ReadonlySet only
  // at compile time) — tests mutate it directly and must clean up after.
  ;(RECIPE_SUPPORTED_PROGRAMS as unknown as Set<string>).clear()
  vi.clearAllMocks()
})

describe('listDueCredentials', () => {
  it('includes never-synced and stale rows, excludes fresh and unsupported-without-recipe', async () => {
    const due = await listDueCredentials(STALE_BEFORE, 10)
    const ids = due.map((d) => d.id)
    expect(ids).toContain('never-synced')
    expect(ids).toContain('stale')
    expect(ids).not.toContain('fresh')
    expect(ids).not.toContain('unsupported-no-recipe')
    expect(ids).not.toContain('unsupported-with-recipe')
  })

  it('retries an `unsupported` row once its program gains a verified recipe', async () => {
    ;(RECIPE_SUPPORTED_PROGRAMS as unknown as Set<string>).add('has-recipe-program')
    const due = await listDueCredentials(STALE_BEFORE, 10)
    const ids = due.map((d) => d.id)
    expect(ids).toContain('unsupported-with-recipe')
    // A different program still without a recipe stays excluded.
    expect(ids).not.toContain('unsupported-no-recipe')
  })
})
