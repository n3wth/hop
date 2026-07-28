import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildSupportTools } from '@/lib/support-agent-tools'

vi.mock('@/lib/escalation', () => ({
  createEscalation: vi.fn().mockResolvedValue('esc_12345'),
  listEscalations: vi.fn().mockResolvedValue([]),
  normalizeEmail: (e: string) => (e && e.includes('@') ? e.toLowerCase().trim() : null),
}))

vi.mock('@/lib/email', () => ({
  sendOwnerNotification: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('next/server', () => ({
  after: (cb: () => void) => cb(),
}))

describe('support-agent-tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('get_account_snapshot returns signedOut for anonymous user', async () => {
    const tools = buildSupportTools({
      balances: [],
    })
    const dummyExecOptions = { toolCallId: '1', messages: [], context: {} } as unknown as Parameters<typeof tools.get_account_snapshot.execute>[1]
    const res = (await tools.get_account_snapshot.execute({}, dummyExecOptions)) as Record<string, unknown>
    expect(res.signedIn).toBe(false)
    expect(res.summary).toContain('User is signed out.')
  })

  it('escalate_to_human succeeds for signed-in user with session email', async () => {
    const tools = buildSupportTools({
      userId: 'user_1',
      sessionEmail: 'user@example.com',
      balances: [],
    })
    const dummyExecOptions = { toolCallId: '2', messages: [], context: {} } as unknown as Parameters<typeof tools.escalate_to_human.execute>[1]
    const res = (await tools.escalate_to_human.execute(
      { reason: 'Check my request', summary: 'I asked about my booking request.' },
      dummyExecOptions
    )) as Record<string, unknown>
    expect(res.ok).toBe(true)
    expect(res.id).toBe('esc_12345')
  })

  it('escalate_to_human fails for signed-out user without email', async () => {
    const tools = buildSupportTools({
      balances: [],
    })
    const dummyExecOptions = { toolCallId: '3', messages: [], context: {} } as unknown as Parameters<typeof tools.escalate_to_human.execute>[1]
    const res = (await tools.escalate_to_human.execute(
      { reason: 'Help me', summary: 'Need help' },
      dummyExecOptions
    )) as Record<string, unknown>
    expect(res.ok).toBe(false)
    expect(res.reason).toContain('email address is required')
  })

  it('escalate_to_human is idempotent within the same tools instance', async () => {
    const tools = buildSupportTools({
      userId: 'user_1',
      sessionEmail: 'user@example.com',
      balances: [],
    })
    const dummyExecOptions4 = { toolCallId: '4', messages: [], context: {} } as unknown as Parameters<typeof tools.escalate_to_human.execute>[1]
    const dummyExecOptions5 = { toolCallId: '5', messages: [], context: {} } as unknown as Parameters<typeof tools.escalate_to_human.execute>[1]
    const res1 = (await tools.escalate_to_human.execute(
      { reason: 'First', summary: 'Summary 1' },
      dummyExecOptions4
    )) as Record<string, unknown>
    expect(res1.ok).toBe(true)

    const res2 = (await tools.escalate_to_human.execute(
      { reason: 'Second', summary: 'Summary 2' },
      dummyExecOptions5
    )) as Record<string, unknown>
    expect(res2.ok).toBe(true)
    expect(res2.already).toBe(true)
  })

  it('search_help returns KB hits for valid query', async () => {
    const tools = buildSupportTools({
      balances: [],
    })
    const dummyExecOptions = { toolCallId: '6', messages: [], context: {} } as unknown as Parameters<typeof tools.search_help.execute>[1]
    const res = (await tools.search_help.execute(
      { query: 'verdict' },
      dummyExecOptions
    )) as Record<string, unknown>
    const hits = res.hits as Array<{ slug: string }>
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].slug).toBe('the-verdict')
  })
})
