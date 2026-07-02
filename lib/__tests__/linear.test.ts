import { afterEach, describe, expect, it, vi } from 'vitest'
import { fileIssue, isLinearConfigured } from '@/lib/linear'

// The filing client is GATED on LINEAR_API_KEY + LINEAR_TEAM_ID and returns a
// discriminated {ok} result — it NEVER throws. Unconfigured → no fetch at
// all. The `[hop:<fingerprint>]` title marker is both the human-greppable
// identity and the secondary dedupe key.

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

const INPUT = {
  title: 'valuation-sync cron has not completed in 52h',
  body: 'What was observed\n- …',
  fingerprint: 'cron-dead:valuation-sync',
}

type Call = { url: string; init: RequestInit; body: { query: string; variables: Record<string, unknown> } }

// A scripted GraphQL server: routes on the operation in the query text.
function stubGraphql(handlers: {
  preflight?: () => Response | Promise<Response>
  labelCreate?: () => Response | Promise<Response>
  issueCreate?: () => Response | Promise<Response>
}) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as Call['body']
      calls.push({ url, init, body })
      if (body.query.includes('issueLabelCreate')) {
        return handlers.labelCreate?.() ?? json({ data: { issueLabelCreate: { success: true, issueLabel: { id: 'lbl-created' } } } })
      }
      if (body.query.includes('issueCreate')) {
        return handlers.issueCreate?.() ?? json({ data: { issueCreate: { success: true, issue: { id: 'iss-1', identifier: 'HOP-1' } } } })
      }
      return (
        handlers.preflight?.() ??
        json({ data: { issues: { nodes: [] }, issueLabels: { nodes: [{ id: 'lbl-1' }] } } })
      )
    }),
  )
  return calls
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status })
}

describe('isLinearConfigured()', () => {
  it('needs BOTH the key and the team id', () => {
    delete process.env.LINEAR_API_KEY
    delete process.env.LINEAR_TEAM_ID
    expect(isLinearConfigured()).toBe(false)
    process.env.LINEAR_API_KEY = 'k'
    expect(isLinearConfigured()).toBe(false)
    process.env.LINEAR_TEAM_ID = 't'
    expect(isLinearConfigured()).toBe(true)
  })
})

describe('fileIssue() — gated no-op', () => {
  it('no key → {ok:false, unconfigured}; fetch is never called', async () => {
    delete process.env.LINEAR_API_KEY
    delete process.env.LINEAR_TEAM_ID
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await expect(fileIssue(INPUT)).resolves.toEqual({ ok: false, reason: 'unconfigured' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('fileIssue() — configured', () => {
  it('creates the issue with the [hop:…] title marker, the team id, and the auto-filed label', async () => {
    configure()
    const calls = stubGraphql({})

    const res = await fileIssue(INPUT)
    expect(res).toEqual({ ok: true, issueId: 'iss-1', identifier: 'HOP-1', alreadyExisted: false })

    // Two round trips: preflight (dedupe + label lookup), then create.
    expect(calls).toHaveLength(2)
    for (const call of calls) {
      expect(call.url).toBe('https://api.linear.app/graphql')
      const headers = call.init.headers as Record<string, string>
      // Personal API keys go bare in the Authorization header — and the key
      // never appears anywhere else (never logged).
      expect(headers.Authorization).toBe('lin_api_test_key')
    }
    const create = calls[1].body.variables.input as Record<string, unknown>
    expect(create.teamId).toBe('team-1')
    expect(create.title).toBe(`${INPUT.title} [hop:${INPUT.fingerprint}]`)
    expect(create.description).toBe(INPUT.body)
    expect(create.labelIds).toEqual(['lbl-1'])
  })

  it('secondary dedupe: an existing [hop:…] issue short-circuits — no create call', async () => {
    configure()
    const calls = stubGraphql({
      preflight: () =>
        json({ data: { issues: { nodes: [{ id: 'iss-9', identifier: 'HOP-9' }] }, issueLabels: { nodes: [] } } }),
    })

    const res = await fileIssue(INPUT)
    expect(res).toEqual({ ok: true, issueId: 'iss-9', identifier: 'HOP-9', alreadyExisted: true })
    expect(calls).toHaveLength(1)
  })

  it('creates the auto-filed label when missing (best-effort), then files with it', async () => {
    configure()
    const calls = stubGraphql({
      preflight: () => json({ data: { issues: { nodes: [] }, issueLabels: { nodes: [] } } }),
    })

    const res = await fileIssue(INPUT)
    expect(res.ok).toBe(true)
    expect(calls).toHaveLength(3) // preflight, labelCreate, issueCreate
    const create = calls[2].body.variables.input as Record<string, unknown>
    expect(create.labelIds).toEqual(['lbl-created'])
  })

  it('a failed label lookup/create never blocks filing — issue goes out unlabeled', async () => {
    configure()
    const calls = stubGraphql({
      preflight: () => json({ data: { issues: { nodes: [] }, issueLabels: { nodes: [] } } }),
      labelCreate: () => json({ errors: [{ message: 'nope' }] }),
    })

    const res = await fileIssue(INPUT)
    expect(res.ok).toBe(true)
    const create = calls[2].body.variables.input as Record<string, unknown>
    expect(create.labelIds).toBeUndefined()
  })

  it('never throws when fetch rejects → {ok:false, send-failed}', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))))

    await expect(fileIssue(INPUT)).resolves.toEqual({ ok: false, reason: 'send-failed' })
  })

  it('non-2xx on create → send-failed', async () => {
    configure()
    stubGraphql({ issueCreate: () => json({ error: 'boom' }, 500) })

    await expect(fileIssue(INPUT)).resolves.toEqual({ ok: false, reason: 'send-failed' })
  })

  it('429 → rate-limited (the sentinel leaves the finding open and retries tomorrow)', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'slow down' }, 429)))

    await expect(fileIssue(INPUT)).resolves.toEqual({ ok: false, reason: 'rate-limited' })
  })

  it('GraphQL-level errors → send-failed', async () => {
    configure()
    stubGraphql({ issueCreate: () => json({ errors: [{ message: 'bad input' }] }) })

    await expect(fileIssue(INPUT)).resolves.toEqual({ ok: false, reason: 'send-failed' })
  })

  it('issueCreate success:false → send-failed (no fabricated ids)', async () => {
    configure()
    stubGraphql({ issueCreate: () => json({ data: { issueCreate: { success: false } } }) })

    await expect(fileIssue(INPUT)).resolves.toEqual({ ok: false, reason: 'send-failed' })
  })
})
