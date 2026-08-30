import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the withDb seam so the insert body is observable without Supabase.
// recordOutclick's contract (fire-and-forget, never throws) is what's under test.
vi.mock('@/lib/supabase-helpers', () => ({
  withDb: vi.fn(async (fallback: unknown) => fallback),
}))

// Mock the PostHog seam so the funnel shadow is observable and controllable.
vi.mock('@/lib/posthog-server', () => ({
  captureServerEvent: vi.fn(() => Promise.resolve()),
}))

import { withDb } from '@/lib/supabase-helpers'
import { captureServerEvent } from '@/lib/posthog-server'
import { recordOutclick, getOutclickSummary, listRecentOutclicks, type Outclick } from '@/lib/outclicks'

const mockWithDb = vi.mocked(withDb)
const mockCapture = vi.mocked(captureServerEvent)

const CLICK: Outclick = {
  kind: 'card',
  target: 'chase-ur',
  url: 'https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred?ref=hop-card',
  program: 'Chase Ultimate Rewards',
  userAgent: 'test-agent/1.0',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockWithDb.mockImplementation(async (fallback: unknown) => fallback)
  mockCapture.mockImplementation(() => Promise.resolve())
})

describe('recordOutclick', () => {
  it('maps the click onto a hop_outclicks insert (snake_case columns)', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    const from = vi.fn(() => ({ insert }))
    mockWithDb.mockImplementation(async (_fallback, fn) =>
      (fn as (db: unknown) => Promise<unknown>)({ from }),
    )

    recordOutclick(CLICK)

    await vi.waitFor(() => expect(insert).toHaveBeenCalled())
    expect(from).toHaveBeenCalledWith('hop_outclicks')
    expect(insert).toHaveBeenCalledWith({
      kind: 'card',
      target: 'chase-ur',
      url: CLICK.url,
      program: 'Chase Ultimate Rewards',
      user_agent: 'test-agent/1.0',
    })
  })

  it('stores null (not undefined) for absent program/user-agent context', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    mockWithDb.mockImplementation(async (_fallback, fn) =>
      (fn as (db: unknown) => Promise<unknown>)({ from: () => ({ insert }) }),
    )

    recordOutclick({ kind: 'card', target: 'united', url: 'https://example.com' })

    await vi.waitFor(() => expect(insert).toHaveBeenCalled())
    expect(insert).toHaveBeenCalledWith({
      kind: 'card',
      target: 'united',
      url: 'https://example.com',
      program: null,
      user_agent: null,
    })
  })

  it('returns a promise that resolves — so after() can track the write to completion', async () => {
    await expect(recordOutclick(CLICK)).resolves.toBeUndefined()
  })

  it('emits the outclick funnel shadow beside the ledger insert', async () => {
    await recordOutclick(CLICK)
    expect(mockCapture).toHaveBeenCalledWith('outclick', { kind: 'card', target: 'chase-ur' })
  })

  it('resolves only after the PostHog capture settles — after() keeps it alive too', async () => {
    let releaseCapture!: () => void
    mockCapture.mockReturnValue(
      new Promise<void>((resolve) => {
        releaseCapture = resolve
      }),
    )

    let done = false
    const p = recordOutclick(CLICK).then(() => {
      done = true
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(done).toBe(false)

    releaseCapture()
    await p
    expect(done).toBe(true)
  })

  it('never throws or rejects, even if the withDb seam itself throws synchronously', async () => {
    mockWithDb.mockImplementation(() => {
      throw new Error('boom')
    })
    await expect(recordOutclick(CLICK)).resolves.toBeUndefined()
  })

  it('no-ops silently when the DB is unconfigured (withDb falls back)', () => {
    // Default mock: withDb resolves straight to the fallback (no client).
    expect(() => recordOutclick(CLICK)).not.toThrow()
    expect(mockWithDb).toHaveBeenCalledTimes(1)
  })
})

// hop_outclicks has NO created_at column — only clicked_at (lib/db/schema.ts).
// This fake mirrors lib/supabase-helpers.ts's real behavior: a filter/select
// naming any other column fails the query (Drizzle's compat shim fails closed
// on an unknown column). That's what made the real bug reproduce as "Outclick
// ledger unavailable" on /admin/ops — listRecentOutclicks/getOutclickSummary
// queried created_at and every call errored out to null.
const KNOWN_COLUMNS = new Set(['kind', 'target', 'program', 'clicked_at'])

function fakeOutclicksDb(rows: Array<Record<string, unknown>>) {
  let failed: Error | null = null
  function checkCol(col: string) {
    if (!KNOWN_COLUMNS.has(col)) failed = new Error(`Unknown column "${col}"`)
  }
  function checkCols(cols: string) {
    cols.split(',').map((c) => c.trim()).forEach(checkCol)
  }
  const terminal = () => (failed ? { data: null, error: failed } : { data: rows, error: null })
  const builder = {
    select(cols: string) {
      checkCols(cols)
      return builder
    },
    order(col: string) {
      checkCol(col)
      return builder
    },
    gte(col: string) {
      checkCol(col)
      return terminal()
    },
    limit() {
      return terminal()
    },
  }
  return { from: () => builder }
}

describe('listRecentOutclicks / getOutclickSummary — real column names', () => {
  const ROW = { kind: 'card', target: 'chase-ur', program: 'Chase UR', clicked_at: '2026-07-04T10:00:00Z' }

  it('listRecentOutclicks reads clicked_at, not created_at', async () => {
    mockWithDb.mockImplementation(async (_fallback, fn) =>
      (fn as (db: unknown) => Promise<unknown>)(fakeOutclicksDb([ROW])),
    )
    const out = await listRecentOutclicks(15)
    expect(out).not.toBeNull()
    expect(out?.[0]).toEqual({
      kind: 'card',
      target: 'chase-ur',
      program: 'Chase UR',
      createdAt: '2026-07-04T10:00:00Z',
    })
  })

  it('getOutclickSummary reads clicked_at, not created_at', async () => {
    mockWithDb.mockImplementation(async (_fallback, fn) =>
      (fn as (db: unknown) => Promise<unknown>)(fakeOutclicksDb([ROW, { ...ROW, kind: 'cash' }])),
    )
    const out = await getOutclickSummary()
    expect(out).toEqual({ last7d: { card: 1, cash: 1 }, total: 2 })
  })
})
