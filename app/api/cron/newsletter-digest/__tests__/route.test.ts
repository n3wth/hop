import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Everything downstream of the auth check is mocked — this suite is only
// about ORDERING: isAuthorizedCron must run before isNewsletterEnabled, so an
// unauthenticated caller gets 401 regardless of the feature flag's state and
// never learns whether the flag is on (no 503-vs-401 signal to probe with).
vi.mock('@/lib/env', () => ({
  isNewsletterEnabled: vi.fn(),
}))
vi.mock('@/lib/newsletter', () => ({
  listDueDigestSubscribers: vi.fn(async () => []),
  markDigestSent: vi.fn(async () => true),
}))
vi.mock('@/lib/cron-heartbeat', () => ({
  recordHeartbeat: vi.fn(),
}))
vi.mock('@/lib/email-suppressions', () => ({
  isSuppressed: vi.fn(async () => false),
}))
vi.mock('@/lib/email', () => ({
  sendWeeklyDigestEmail: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/accounts', () => ({
  getUserBalances: vi.fn(async () => []),
}))
vi.mock('@/lib/ledger-dream', () => ({
  ledgerDream: vi.fn(() => ({})),
}))
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => null),
}))

import { GET } from '../route'
import { isNewsletterEnabled } from '@/lib/env'
import { listDueDigestSubscribers } from '@/lib/newsletter'
import { recordHeartbeat } from '@/lib/cron-heartbeat'

const mockEnabled = vi.mocked(isNewsletterEnabled)
const mockListDue = vi.mocked(listDueDigestSubscribers)
const mockHeartbeat = vi.mocked(recordHeartbeat)

function unauthorizedRequest(): Request {
  // No Authorization header at all — isAuthorizedCron must reject this.
  return new Request('http://localhost/api/cron/newsletter-digest')
}

function authorizedRequest(): Request {
  return new Request('http://localhost/api/cron/newsletter-digest', {
    headers: { authorization: 'Bearer test-cron-secret' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Force isAuthorizedCron's real fail-closed path: a secret IS configured, so
  // only the correct bearer header passes (mirrors lib/__tests__/cron-auth.test.ts).
  vi.stubEnv('CRON_SECRET', 'test-cron-secret')
  vi.stubEnv('NODE_ENV', 'production')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/cron/newsletter-digest — auth ordering', () => {
  it('unauthorized + newsletter ENABLED → 401, never reaches the flag check or the db', async () => {
    mockEnabled.mockReturnValue(true)
    const res = await GET(unauthorizedRequest())
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ ok: false, reason: 'unauthorized' })
    expect(mockEnabled).not.toHaveBeenCalled()
    expect(mockListDue).not.toHaveBeenCalled()
  })

  it('unauthorized + newsletter DISABLED → still 401, not 503 — flag state leaks nothing to an unauthorized caller', async () => {
    mockEnabled.mockReturnValue(false)
    const res = await GET(unauthorizedRequest())
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ ok: false, reason: 'unauthorized' })
    expect(mockEnabled).not.toHaveBeenCalled()
  })

  it('authorized + newsletter disabled → 503 disabled, heartbeat recorded, no db read', async () => {
    mockEnabled.mockReturnValue(false)
    const res = await GET(authorizedRequest())
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false, disabled: true, reason: 'newsletter is off' })
    expect(mockHeartbeat).toHaveBeenCalledWith('newsletter-digest', false, 'disabled')
    expect(mockListDue).not.toHaveBeenCalled()
  })

  it('authorized + newsletter enabled → proceeds past both gates to the db', async () => {
    mockEnabled.mockReturnValue(true)
    mockListDue.mockResolvedValue([])
    const res = await GET(authorizedRequest())
    expect(res.status).toBe(200)
    expect(mockListDue).toHaveBeenCalled()
  })
})
