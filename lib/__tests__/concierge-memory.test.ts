import { describe, it, expect } from 'vitest'
import { buildMessages, buildAgenticSystemForTest } from '@/app/api/concierge/route'
import type { ConversationMessage } from '@/lib/conversations'

// Multi-turn threading + memory prompt assembly. Pure — no network, no DB.

describe('buildMessages() — multi-turn threading + back-compat', () => {
  it('single-question back-compat: yields one user turn when no history', () => {
    const out = buildMessages('Where to with my points?', undefined, [])
    expect(out).toEqual([{ role: 'user', content: 'Where to with my points?' }])
  })

  it('appends the new question to the client thread', () => {
    const client: ConversationMessage[] = [
      { role: 'user', content: 'Somewhere warm' },
      { role: 'assistant', content: 'How about Bali?' },
    ]
    const out = buildMessages('Is it cheaper with points?', client, [])
    expect(out).toHaveLength(3)
    expect(out[2]).toEqual({ role: 'user', content: 'Is it cheaper with points?' })
  })

  it('does not double-append when the question already is the last user turn', () => {
    const client: ConversationMessage[] = [
      { role: 'assistant', content: 'How about Bali?' },
      { role: 'user', content: 'Tokyo instead' },
    ]
    const out = buildMessages('Tokyo instead', client, [])
    expect(out).toHaveLength(2)
    expect(out.filter((m) => m.content === 'Tokyo instead')).toHaveLength(1)
  })

  it('recovers persisted history when the client sends none (fresh page load)', () => {
    const persisted: ConversationMessage[] = [
      { role: 'user', content: 'I love Japan' },
      { role: 'assistant', content: 'Noted!' },
    ]
    const out = buildMessages('Plan a trip', undefined, persisted)
    expect(out).toHaveLength(3)
    expect(out[0].content).toBe('I love Japan')
    expect(out[2]).toEqual({ role: 'user', content: 'Plan a trip' })
  })

  it('prefers the longer client thread over a shorter persisted one', () => {
    const client: ConversationMessage[] = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
      { role: 'assistant', content: 'd' },
    ]
    const persisted: ConversationMessage[] = [{ role: 'user', content: 'a' }]
    const out = buildMessages('e', client, persisted)
    expect(out.map((m) => m.content)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})

describe('agentic system prompt — memory awareness', () => {
  it('includes the saved profile when present', () => {
    const sys = buildAgenticSystemForTest(undefined, { cabin: 'business', avoidedDestinations: ['Paris'] })
    expect(sys).toContain('business')
    expect(sys).toContain('Paris')
    expect(sys).toContain('save_profile_fact')
  })

  it('tells the agent to save facts when no profile exists', () => {
    const sys = buildAgenticSystemForTest(undefined, {})
    expect(sys.toLowerCase()).toContain("don't have a saved profile")
  })

  it('notes Gmail import is coming when no history is connected', () => {
    const sys = buildAgenticSystemForTest(undefined, {}, undefined)
    expect(sys.toLowerCase()).toContain('coming soon')
  })

  it('injects the engine-computed wallet dollar total and forbids the model from computing its own', () => {
    const context = {
      programs: [
        { program: 'Amex MR', balance: 60000 },
        { program: 'Chase UR', balance: 25000 },
      ],
      totalPoints: 85000,
    }
    const sys = buildAgenticSystemForTest(context, {})
    // lib/valuations#walletValue: 60000 * 2.00cpp + 25000 * 2.05cpp = $1,713 (rounded)
    expect(sys).toContain('Engine-computed wallet dollar value')
    expect(sys).toContain('$1,713')
    expect(sys.toLowerCase()).toContain('never sum or multiply')
  })
})
