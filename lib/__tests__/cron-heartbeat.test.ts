import { afterEach, describe, expect, it, vi } from 'vitest'

// recordHeartbeat() writes one liveness row per cron run (ADR 0007). The
// contract this guards: it RETURNS a promise callers await so the Neon upsert
// flushes before a serverless handler returns (N-790 — an un-awaited write is
// dropped when the invocation freezes), and that promise ALWAYS resolves,
// never rejects, so awaiting it can never fail the cron's real work.

const { from, upsert } = vi.hoisted(() => {
  const upsert = vi.fn(() => Promise.resolve({ error: null }))
  const from = vi.fn(() => ({ upsert }))
  return { from, upsert }
})

vi.mock('@/lib/supabase-helpers', () => ({
  withDb: vi.fn(async (_fallback: unknown, fn: (db: unknown) => Promise<unknown>) => fn({ from })),
}))

import { recordHeartbeat } from '@/lib/cron-heartbeat'
import { withDb } from '@/lib/supabase-helpers'

afterEach(() => {
  vi.clearAllMocks()
})

describe('recordHeartbeat()', () => {
  it('awaits the upsert — the returned promise resolves only after the write settles', async () => {
    let settled = false
    upsert.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            settled = true
            resolve({ error: null })
          }, 5)
        }),
    )

    await recordHeartbeat('health-sentinel', true, 'findings:0 resolved:0 filed:0')

    expect(settled).toBe(true)
    expect(from).toHaveBeenCalledWith('hop_cron_heartbeats')
  })

  it('writes job, ok, and a note capped at 500 chars, keyed on job', async () => {
    await recordHeartbeat('standing-orders', true, 'x'.repeat(600))

    expect(upsert).toHaveBeenCalledTimes(1)
    const [row, opts] = upsert.mock.calls[0] as unknown as [
      Record<string, unknown>,
      Record<string, unknown>,
    ]
    expect(row.job).toBe('standing-orders')
    expect(row.ok).toBe(true)
    expect(typeof row.last_run_at).toBe('string')
    expect((row.note as string).length).toBe(500)
    expect(opts).toEqual({ onConflict: 'job' })
  })

  it('stores a null note when none is given', async () => {
    await recordHeartbeat('revalidate-seo', false, undefined)
    const [row] = upsert.mock.calls[0] as unknown as [Record<string, unknown>]
    expect(row.note).toBeNull()
    expect(row.ok).toBe(false)
  })

  it('never rejects, even when the db layer throws synchronously', async () => {
    vi.mocked(withDb).mockImplementationOnce(() => {
      throw new Error('db exploded')
    })
    await expect(recordHeartbeat('sync-stripe', true, 'synced:0 total:0')).resolves.toBeUndefined()
  })

  it('never rejects, even when the db layer rejects', async () => {
    vi.mocked(withDb).mockImplementationOnce(() => Promise.reject(new Error('rejected')))
    await expect(
      recordHeartbeat('valuation-sync', true, 'applied:0 skipped:0'),
    ).resolves.toBeUndefined()
  })
})
