import { describe, it, expect, afterEach, vi } from 'vitest'
import { isAuthorizedCron } from '@/lib/cron-auth'

function req(auth?: string): Request {
  return new Request('http://localhost/api/cron/test', {
    headers: auth ? { authorization: auth } : {},
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isAuthorizedCron', () => {
  it('accepts the exact bearer token when CRON_SECRET is set', () => {
    vi.stubEnv('CRON_SECRET', 's3cret')
    expect(isAuthorizedCron(req('Bearer s3cret'))).toBe(true)
  })

  it('rejects a wrong or missing token when CRON_SECRET is set', () => {
    vi.stubEnv('CRON_SECRET', 's3cret')
    expect(isAuthorizedCron(req('Bearer wrong'))).toBe(false)
    expect(isAuthorizedCron(req())).toBe(false)
  })

  it('fails CLOSED in production when CRON_SECRET is unset', () => {
    vi.stubEnv('CRON_SECRET', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(isAuthorizedCron(req())).toBe(false)
    expect(isAuthorizedCron(req('Bearer anything'))).toBe(false)
  })

  it('stays open outside production when CRON_SECRET is unset (local runs)', () => {
    vi.stubEnv('CRON_SECRET', '')
    vi.stubEnv('NODE_ENV', 'test')
    expect(isAuthorizedCron(req())).toBe(true)
  })
})
