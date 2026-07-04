import { describe, it, expect, vi, beforeEach } from 'vitest'

// The cash redirect route's contract, with the ledger seam mocked (the
// allowlist — lib/booking.ts#isAllowedCashOutclickUrl — runs for real; it's
// pure and is THE open-redirect guard under test here):
//
//   allowlisted ?to= → 302 to that exact destination, one 'cash' outclick logged
//   anything else (other hosts, javascript:, userinfo tricks, missing ?to=)
//     → 302 to '/', nothing logged — never a 500, never an open redirect

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
import { cashBookingUrl, kiwiSearchUrl } from '@/lib/booking'

const mockRecord = vi.mocked(recordOutclick)

const KIWI_URL = 'https://www.kiwi.com/en/search/results/SFO/LAX/2026-07-09?adults=1'

function request(path: string, headers?: Record<string, string>): Request {
  return new Request(`http://localhost${path}`, { headers })
}

function go(to: string, route?: string): string {
  const query = new URLSearchParams({ to })
  if (route !== undefined) query.set('route', route)
  return `/api/go/kiwi?${query.toString()}`
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/go/kiwi', () => {
  it('302s (temporary, not permanent) an allowlisted destination unchanged', async () => {
    const res = await GET(request(go(KIWI_URL, 'SFO-LAX')))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(KIWI_URL)
  })

  it('accepts the exact href cashBookingUrl mints — builder and route agree', async () => {
    const params = { from: 'SFO', to: 'LAX', depart: '2026-07-09', return: '2026-07-12', adults: 1 }
    const res = await GET(request(cashBookingUrl(params)))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(kiwiSearchUrl(params))
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'cash', target: 'SFO-LAX' }),
    )
  })

  it('logs one cash outclick with route + user-agent context, post-response', async () => {
    await GET(request(go(KIWI_URL, 'SFO-LAX'), { 'user-agent': 'test-agent/1.0' }))
    expect(mockRecord).toHaveBeenCalledTimes(1)
    expect(mockRecord).toHaveBeenCalledWith({
      kind: 'cash',
      target: 'SFO-LAX',
      url: KIWI_URL,
      userAgent: 'test-agent/1.0',
    })
  })

  it("stores 'unknown' when the route context is absent or malformed", async () => {
    await GET(request(go(KIWI_URL)))
    expect(mockRecord).toHaveBeenLastCalledWith(expect.objectContaining({ target: 'unknown' }))
    await GET(request(go(KIWI_URL, 'https://evil.example')))
    expect(mockRecord).toHaveBeenLastCalledWith(expect.objectContaining({ target: 'unknown' }))
  })

  it('302s home and logs nothing when ?to= is missing — never a 500', async () => {
    const res = await GET(request('/api/go/kiwi'))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('http://localhost/')
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it.each([
    ['other host', 'https://evil.example/flights'],
    ['allowlisted host as subdomain of attacker', 'https://www.kiwi.com.evil.example/'],
    ['attacker subdomain of allowlisted apex', 'https://evil.kiwi.com/'],
    ['userinfo trick', 'https://www.kiwi.com@evil.example/'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,<script>alert(1)</script>'],
    ['plain http downgrade', 'http://www.kiwi.com/en/'],
    ['protocol-relative', '//evil.example/'],
    ['nested redirect in query of attacker URL', 'https://evil.example/r?to=https://www.kiwi.com'],
  ])('never open-redirects: %s → 302 home, nothing logged', async (_label, to) => {
    const res = await GET(request(go(to, 'SFO-LAX')))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('http://localhost/')
    expect(mockRecord).not.toHaveBeenCalled()
  })
})
