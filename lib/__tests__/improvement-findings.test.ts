import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fileFindings,
  getFinding,
  listOpenFindings,
  markFiled,
  resolveFinding,
  upsertFinding,
  type ImprovementFinding,
  type UpsertFindingInput,
} from '@/lib/improvement-findings'
import { MAX_ISSUES_PER_RUN, REOPEN_WINDOW_DAYS } from '@/lib/health-checks'
import { fileIssue, isLinearConfigured } from '@/lib/linear'
import { sendOwnerNotification } from '@/lib/email'

// The findings store, with withDb mocked over an in-memory table so the
// idempotency contract is testable without Supabase: fingerprint identity,
// last_seen bumps, the reopen-within-7-days flap guard, the post-window
// episode reset, at-most-once filing, and the ≤3-per-run delivery cap.

type Row = Record<string, unknown>
let rows: Row[] = []
let idSeq = 0
let fakeDb: unknown = null

function matches(row: Row, filters: Array<{ col: string; val: unknown }>): boolean {
  return filters.every((f) => (row[f.col] ?? null) === f.val)
}

class FakeQuery {
  private mode: 'select' | 'insert' | 'update' = 'select'
  private payload: Row | Row[] | null = null
  private filters: Array<{ col: string; val: unknown }> = []
  private wantSingle = false
  private wantMaybeSingle = false

  select() {
    return this
  }
  insert(p: Row | Row[]) {
    this.mode = 'insert'
    this.payload = p
    return this
  }
  update(p: Row) {
    this.mode = 'update'
    this.payload = p
    return this
  }
  eq(col: string, val: unknown) {
    this.filters.push({ col, val })
    return this
  }
  is(col: string, val: unknown) {
    this.filters.push({ col, val })
    return this
  }
  order() {
    return this
  }
  single() {
    this.wantSingle = true
    return this
  }
  maybeSingle() {
    this.wantMaybeSingle = true
    return this
  }

  private exec(): { data: unknown; error: { message: string } | null } {
    if (this.mode === 'insert') {
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[]
      const inserted = list.map((r) => ({
        id: `row-${++idSeq}`,
        linear_issue_id: null,
        linear_identifier: null,
        delivered_via: null,
        filed_at: null,
        resolved_at: null,
        ...r,
      }))
      rows.push(...inserted)
      return { data: this.wantSingle || this.wantMaybeSingle ? inserted[0] : inserted, error: null }
    }
    if (this.mode === 'update') {
      const hit = rows.filter((r) => matches(r, this.filters))
      for (const r of hit) Object.assign(r, this.payload)
      if (this.wantSingle || this.wantMaybeSingle) {
        return hit[0] ? { data: hit[0], error: null } : { data: null, error: { message: 'no row' } }
      }
      return { data: hit, error: null }
    }
    const hit = rows.filter((r) => matches(r, this.filters))
    if (this.wantMaybeSingle) return { data: hit[0] ?? null, error: null }
    if (this.wantSingle) {
      return hit[0] ? { data: hit[0], error: null } : { data: null, error: { message: 'no row' } }
    }
    return { data: hit, error: null }
  }

  then<T>(resolve: (v: { data: unknown; error: { message: string } | null }) => T) {
    return Promise.resolve(this.exec()).then(resolve)
  }
}

const makeDb = () => ({ from: () => new FakeQuery() })

vi.mock('@/lib/supabase-helpers', () => ({
  withDb: async <T>(fallback: T, fn: (db: unknown) => Promise<T>): Promise<T> => {
    if (!fakeDb) return fallback
    try {
      return await fn(fakeDb)
    } catch {
      return fallback
    }
  },
}))

vi.mock('@/lib/linear', () => ({
  isLinearConfigured: vi.fn(() => false),
  fileIssue: vi.fn(async () => ({ ok: false, reason: 'unconfigured' })),
}))

vi.mock('@/lib/email', () => ({
  sendOwnerNotification: vi.fn(async () => ({ ok: false, reason: 'unconfigured' })),
}))

const DAY_MS = 24 * 60 * 60 * 1000
const T0 = new Date('2026-07-02T11:17:00.000Z')

function input(fingerprint = 'cron-dead:valuation-sync', severity: 'p1' | 'p3' = 'p1'): UpsertFindingInput {
  return {
    fingerprint,
    kind: fingerprint.startsWith('cron-dead') ? 'cron-dead' : 'upstream-spike',
    severity,
    title: `finding ${fingerprint}`,
    body: 'What was observed\n- …',
  }
}

beforeEach(() => {
  rows = []
  idSeq = 0
  fakeDb = makeDb()
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  vi.mocked(isLinearConfigured).mockReturnValue(false)
  vi.mocked(fileIssue).mockResolvedValue({ ok: false, reason: 'unconfigured' })
  vi.mocked(sendOwnerNotification).mockResolvedValue({ ok: false, reason: 'unconfigured' })
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('degraded store — every call falls back, never throws', () => {
  it('unconfigured db → null/false fallbacks', async () => {
    fakeDb = null
    await expect(upsertFinding(input())).resolves.toBeNull()
    await expect(listOpenFindings()).resolves.toBeNull()
    await expect(getFinding('x')).resolves.toBeNull()
    await expect(resolveFinding('x')).resolves.toBe(false)
    await expect(markFiled('id', { deliveredVia: 'email' })).resolves.toBe(false)
  })
})

describe('upsertFinding — fingerprint idempotency', () => {
  it('first sighting creates one open row', async () => {
    const res = await upsertFinding(input())
    expect(res?.outcome).toBe('created')
    expect(res?.finding.status).toBe('open')
    expect(rows).toHaveLength(1)
  })

  it('re-fire of an open finding bumps last_seen_at only — never a second row', async () => {
    await upsertFinding(input())
    vi.setSystemTime(new Date(T0.getTime() + DAY_MS))
    const res = await upsertFinding(input())
    expect(res?.outcome).toBe('seen')
    expect(rows).toHaveLength(1)
    expect(rows[0].first_seen_at).toBe(T0.toISOString())
    expect(rows[0].last_seen_at).toBe(new Date(T0.getTime() + DAY_MS).toISOString())
  })

  it('re-fire refreshes the rendered numbers (title/body) in place', async () => {
    await upsertFinding(input())
    await upsertFinding({ ...input(), title: 'valuation-sync cron has not completed in 52h' })
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toBe('valuation-sync cron has not completed in 52h')
  })
})

describe('reopen window — the flap guard', () => {
  async function createFileResolve() {
    const created = await upsertFinding(input())
    await markFiled(created!.finding.id, {
      linearIssueId: 'iss-1',
      linearIdentifier: 'HOP-1',
      deliveredVia: 'linear',
    })
    await resolveFinding(input().fingerprint)
    return created!.finding.id
  }

  it('re-detected within REOPEN_WINDOW_DAYS → SAME row reopened, SAME Linear issue', async () => {
    const id = await createFileResolve()
    vi.setSystemTime(new Date(T0.getTime() + (REOPEN_WINDOW_DAYS - 1) * DAY_MS))
    const res = await upsertFinding(input())
    expect(res?.outcome).toBe('reopened')
    expect(res?.finding.id).toBe(id)
    expect(res?.finding.status).toBe('open')
    expect(res?.finding.linearIssueId).toBe('iss-1')
    expect(res?.finding.filedAt).not.toBeNull()
    expect(res?.finding.resolvedAt).toBeNull()
    expect(rows).toHaveLength(1)
  })

  it('exactly at the window edge → still a reopen', async () => {
    await createFileResolve()
    vi.setSystemTime(new Date(T0.getTime() + REOPEN_WINDOW_DAYS * DAY_MS))
    const res = await upsertFinding(input())
    expect(res?.outcome).toBe('reopened')
    expect(res?.finding.linearIssueId).toBe('iss-1')
  })

  it('past the window → a fresh episode: filing cleared so a real regression files a NEW issue', async () => {
    await createFileResolve()
    const later = new Date(T0.getTime() + REOPEN_WINDOW_DAYS * DAY_MS + 1)
    vi.setSystemTime(later)
    const res = await upsertFinding(input())
    expect(res?.outcome).toBe('created')
    expect(res?.finding.status).toBe('open')
    expect(res?.finding.filedAt).toBeNull()
    expect(res?.finding.linearIssueId).toBeNull()
    expect(res?.finding.deliveredVia).toBeNull()
    expect(res?.finding.firstSeenAt).toBe(later.toISOString())
    // Still one row per fingerprint — the UNIQUE constraint holds.
    expect(rows).toHaveLength(1)
  })
})

describe('resolveFinding / markFiled — no-op guards', () => {
  it('resolve flips an open row once; a second resolve is a no-op false', async () => {
    await upsertFinding(input())
    await expect(resolveFinding(input().fingerprint)).resolves.toBe(true)
    await expect(resolveFinding(input().fingerprint)).resolves.toBe(false)
    expect(rows[0].status).toBe('resolved')
  })

  it('markFiled twice → the second is a no-op (filed_at guard)', async () => {
    const created = await upsertFinding(input())
    await expect(
      markFiled(created!.finding.id, { linearIssueId: 'iss-1', linearIdentifier: 'HOP-1', deliveredVia: 'linear' }),
    ).resolves.toBe(true)
    await expect(
      markFiled(created!.finding.id, { linearIssueId: 'iss-2', linearIdentifier: 'HOP-2', deliveredVia: 'email' }),
    ).resolves.toBe(false)
    expect(rows[0].linear_issue_id).toBe('iss-1')
    expect(rows[0].delivered_via).toBe('linear')
  })
})

describe('fileFindings — cap + severity routing', () => {
  async function openFindings(count: number, severity: 'p1' | 'p3' = 'p3'): Promise<ImprovementFinding[]> {
    for (let i = 0; i < count; i++) {
      await upsertFinding(input(`upstream-spike:source-${i}`, severity))
    }
    const open = await listOpenFindings()
    return open ?? []
  }

  it('5 findings, cap 3 → exactly 3 fileIssue calls; the remainder stays open and unfiled', async () => {
    vi.mocked(isLinearConfigured).mockReturnValue(true)
    vi.mocked(fileIssue).mockResolvedValue({ ok: true, issueId: 'iss-x', identifier: 'HOP-X', alreadyExisted: false })

    const candidates = await openFindings(5)
    expect(candidates).toHaveLength(5)

    const filed = await fileFindings(candidates)
    expect(vi.mocked(fileIssue)).toHaveBeenCalledTimes(MAX_ISSUES_PER_RUN)
    expect(filed).toHaveLength(MAX_ISSUES_PER_RUN)
    expect(filed.every((f) => f.via === 'linear')).toBe(true)
    expect(rows.filter((r) => r.filed_at === null)).toHaveLength(5 - MAX_ISSUES_PER_RUN)
  })

  it('P1s file first', async () => {
    vi.mocked(isLinearConfigured).mockReturnValue(true)
    vi.mocked(fileIssue).mockResolvedValue({ ok: true, issueId: 'iss-x', identifier: 'HOP-X', alreadyExisted: false })

    await openFindings(3, 'p3')
    await upsertFinding(input('cron-dead:standing-orders', 'p1'))
    const candidates = (await listOpenFindings()) ?? []

    await fileFindings(candidates)
    const firstCall = vi.mocked(fileIssue).mock.calls[0][0]
    expect(firstCall.fingerprint).toBe('cron-dead:standing-orders')
  })

  it('Linear {ok:false} + P1 → owner email fallback, delivered_via=email', async () => {
    vi.mocked(isLinearConfigured).mockReturnValue(true)
    vi.mocked(fileIssue).mockResolvedValue({ ok: false, reason: 'send-failed' })
    vi.mocked(sendOwnerNotification).mockResolvedValue({ ok: true })

    await upsertFinding(input('cron-dead:standing-orders', 'p1'))
    const filed = await fileFindings((await listOpenFindings()) ?? [])

    expect(vi.mocked(sendOwnerNotification)).toHaveBeenCalledTimes(1)
    expect(filed).toEqual([{ fingerprint: 'cron-dead:standing-orders', via: 'email' }])
    expect(rows[0].delivered_via).toBe('email')
  })

  it('Linear {ok:false} + P3 → stays open (no email, retried next daily run)', async () => {
    vi.mocked(isLinearConfigured).mockReturnValue(true)
    vi.mocked(fileIssue).mockResolvedValue({ ok: false, reason: 'send-failed' })

    const filed = await fileFindings(await openFindings(1, 'p3'))
    expect(filed).toHaveLength(0)
    expect(vi.mocked(sendOwnerNotification)).not.toHaveBeenCalled()
    expect(rows[0].filed_at).toBeNull()
    expect(rows[0].status).toBe('open')
  })

  it('Linear unconfigured → detect-and-record: P1 goes by email, P3 is not delivered at all', async () => {
    vi.mocked(isLinearConfigured).mockReturnValue(false)
    vi.mocked(sendOwnerNotification).mockResolvedValue({ ok: true })

    await upsertFinding(input('cron-dead:standing-orders', 'p1'))
    await upsertFinding(input('upstream-spike:cash', 'p3'))
    const filed = await fileFindings((await listOpenFindings()) ?? [])

    expect(vi.mocked(fileIssue)).not.toHaveBeenCalled()
    expect(filed).toEqual([{ fingerprint: 'cron-dead:standing-orders', via: 'email' }])
    const p3row = rows.find((r) => r.fingerprint === 'upstream-spike:cash')!
    expect(p3row.filed_at).toBeNull()
  })

  it('an already-filed finding is skipped without consuming a slot (re-read dedupe)', async () => {
    vi.mocked(isLinearConfigured).mockReturnValue(true)
    vi.mocked(fileIssue).mockResolvedValue({ ok: true, issueId: 'iss-x', identifier: 'HOP-X', alreadyExisted: false })

    const candidates = await openFindings(4)
    // Simulate another writer having filed the first candidate between the
    // list and the loop — the re-read must skip it.
    const first = rows.find((r) => r.fingerprint === candidates[0].fingerprint)!
    first.filed_at = T0.toISOString()

    const filed = await fileFindings(candidates)
    expect(filed.map((f) => f.fingerprint)).not.toContain(candidates[0].fingerprint)
    expect(vi.mocked(fileIssue)).toHaveBeenCalledTimes(3)
  })
})
