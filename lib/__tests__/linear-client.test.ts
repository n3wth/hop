import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchOpenItems, STANDING_ISSUE_TITLES } from '@/lib/linear-client'

// Read-only surface for the admin Team view's "Open items" section. GATED on
// LINEAR_API_KEY + LINEAR_TEAM_ID, discriminated {ok} result, NEVER throws.

const ORIGINAL_ENV = { ...process.env }

function configure() {
  process.env.LINEAR_API_KEY = 'lin_api_test_key'
  process.env.LINEAR_TEAM_ID = 'team-1'
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status })
}

describe('fetchOpenItems() — gated no-op', () => {
  it('no key → {ok:false}; fetch is never called', async () => {
    delete process.env.LINEAR_API_KEY
    delete process.env.LINEAR_TEAM_ID
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await expect(fetchOpenItems()).resolves.toEqual({ ok: false })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('fetchOpenItems() — configured', () => {
  it('filters by team id and the exact standing-issue titles', async () => {
    configure()
    const fetchSpy = vi.fn(async (..._args: [string, RequestInit]) => json({ data: { issues: { nodes: [] } } }))
    vi.stubGlobal('fetch', fetchSpy)

    await fetchOpenItems()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.linear.app/graphql')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('lin_api_test_key')
    const body = JSON.parse(init.body as string)
    expect(body.variables.filter).toEqual({
      team: { id: { eq: 'team-1' } },
      title: { in: STANDING_ISSUE_TITLES },
    })
  })

  it('picks the most recently created comment as the snippet, ignoring array order', async () => {
    configure()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          data: {
            issues: {
              nodes: [
                {
                  identifier: 'N-351',
                  title: 'Finance desk — approvals & budget',
                  url: 'https://linear.app/newth/issue/N-351',
                  updatedAt: '2026-07-06T04:58:56.349Z',
                  description: 'Standing thread for the finance desk.',
                  comments: {
                    nodes: [
                      { body: 'older comment', createdAt: '2026-07-06T04:36:37.580Z' },
                      { body: 'newest comment', createdAt: '2026-07-06T04:57:08.442Z' },
                    ],
                  },
                },
              ],
            },
          },
        })
      )
    )

    const res = await fetchOpenItems()
    expect(res).toEqual({
      ok: true,
      items: [
        {
          identifier: 'N-351',
          title: 'Finance desk — approvals & budget',
          url: 'https://linear.app/newth/issue/N-351',
          updatedAt: '2026-07-06T04:58:56.349Z',
          snippet: 'newest comment',
        },
      ],
    })
  })

  it('falls back to the issue description when there are no comments', async () => {
    configure()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          data: {
            issues: {
              nodes: [
                {
                  identifier: 'N-352',
                  title: 'Growth desk — drafts & approvals',
                  url: 'https://linear.app/newth/issue/N-352',
                  updatedAt: '2026-07-06T05:03:39.722Z',
                  description: 'Standing thread for the growth desk.',
                  comments: { nodes: [] },
                },
              ],
            },
          },
        })
      )
    )

    const res = await fetchOpenItems()
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.items[0].snippet).toBe('Standing thread for the growth desk.')
  })

  it('truncates a long snippet', async () => {
    configure()
    const long = 'x'.repeat(400)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          data: {
            issues: {
              nodes: [
                {
                  identifier: 'N-353',
                  title: 'Strategy desk — weekly market & priority review',
                  url: 'https://linear.app/newth/issue/N-353',
                  updatedAt: '2026-07-06T05:04:34.723Z',
                  description: null,
                  comments: { nodes: [{ body: long, createdAt: '2026-07-06T05:04:34.723Z' }] },
                },
              ],
            },
          },
        })
      )
    )

    const res = await fetchOpenItems()
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.items[0].snippet).toHaveLength(241) // 240 chars + the ellipsis
      expect(res.items[0].snippet?.endsWith('…')).toBe(true)
    }
  })

  it('never throws when fetch rejects → {ok:false}', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))))

    await expect(fetchOpenItems()).resolves.toEqual({ ok: false })
  })

  it('non-2xx → {ok:false}', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'boom' }, 500)))

    await expect(fetchOpenItems()).resolves.toEqual({ ok: false })
  })

  it('GraphQL-level errors → {ok:false}', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn(async () => json({ errors: [{ message: 'bad filter' }] })))

    await expect(fetchOpenItems()).resolves.toEqual({ ok: false })
  })

  it('skips malformed issue nodes instead of throwing', async () => {
    configure()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          data: {
            issues: {
              nodes: [{ title: 'missing identifier and url' }],
            },
          },
        })
      )
    )

    await expect(fetchOpenItems()).resolves.toEqual({ ok: true, items: [] })
  })
})
