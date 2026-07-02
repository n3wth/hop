import { describe, it, expect, vi, beforeEach } from 'vitest'

// The redirect route's contract, with the ledger seam mocked (the lookup —
// lib/card-affiliates — runs for real; it's pure):
//
//   known id → 302 to the card's applyUrl, one outclick logged
//   unknown id → 302 to '/', nothing logged (never a 500)
//   the redirect target comes ONLY from the static table — query input is
//   context, never a destination (no open redirect)

vi.mock('@/lib/outclicks', () => ({
  recordOutclick: vi.fn(async () => undefined),
}))

// The ledger write is scheduled via next/server's after() so serverless
// doesn't cut it off when the 302 returns. Outside a real Next request scope
// (vitest, node env) after() would throw — run the callback inline instead,
// which also lets the tests assert the write's payload synchronously.
vi.mock('next/server', () => ({
  after: (task: unknown) => {
    if (typeof task === 'function') void (task as () => unknown)()
  },
}))

import { GET } from '../route'
import { recordOutclick } from '@/lib/outclicks'
import { cardById } from '@/lib/card-affiliates'

const mockRecord = vi.mocked(recordOutclick)

function request(path: string, headers?: Record<string, string>): Request {
  return new Request(`http://localhost${path}`, { headers })
}

function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/go/card/[id]', () => {
  it('302s (temporary, not permanent) a known card to its applyUrl', async () => {
    const res = await GET(request('/api/go/card/chase-ur'), ctx('chase-ur'))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(cardById('chase-ur')!.applyUrl)
  })

  it('logs one outclick with program + user-agent context, post-response', async () => {
    await GET(
      request('/api/go/card/united?program=United%20MileagePlus', {
        'user-agent': 'test-agent/1.0',
      }),
      ctx('united'),
    )
    expect(mockRecord).toHaveBeenCalledTimes(1)
    expect(mockRecord).toHaveBeenCalledWith({
      kind: 'card',
      target: 'united',
      url: cardById('united')!.applyUrl,
      program: 'United MileagePlus',
      userAgent: 'test-agent/1.0',
    })
  })

  it('stores null context when program/user-agent are absent', async () => {
    await GET(request('/api/go/card/united'), ctx('united'))
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ program: null, userAgent: null }),
    )
  })

  it('302s an unknown id home and logs nothing — never a 500', async () => {
    const res = await GET(request('/api/go/card/not-a-card'), ctx('not-a-card'))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('http://localhost/')
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('ignores query input as a destination — targets come only from the static table', async () => {
    const res = await GET(
      request('/api/go/card/chase-ur?program=https%3A%2F%2Fevil.example'),
      ctx('chase-ur'),
    )
    expect(res.headers.get('location')).toBe(cardById('chase-ur')!.applyUrl)
    expect(res.headers.get('location')).not.toContain('evil.example')
  })

  it('does not canonicalize free text — only exact ids minted by cardOutclickPath resolve', async () => {
    const res = await GET(
      request('/api/go/card/United%20MileagePlus'),
      ctx('United MileagePlus'),
    )
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('http://localhost/')
    expect(mockRecord).not.toHaveBeenCalled()
  })
})
