import { describe, it, expect } from 'vitest'
import { sanitizeMessages, MAX_MESSAGES } from '@/lib/conversations'

// Pure tests for the message sanitizer — the DB-touching get/save are thin
// wrappers that degrade to [] / false and are exercised via the route.

describe('sanitizeMessages() — defends the thread shape', () => {
  it('returns [] for non-arrays', () => {
    expect(sanitizeMessages(null)).toEqual([])
    expect(sanitizeMessages('hi')).toEqual([])
    expect(sanitizeMessages({ role: 'user', content: 'x' })).toEqual([])
  })

  it('keeps valid user/assistant/system turns and trims content', () => {
    const out = sanitizeMessages([
      { role: 'user', content: '  hello  ' },
      { role: 'assistant', content: 'hi there' },
      { role: 'system', content: 'sys' },
    ])
    expect(out).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
      { role: 'system', content: 'sys' },
    ])
  })

  it('drops turns with bad role, non-string content, or empty content', () => {
    const out = sanitizeMessages([
      { role: 'robot', content: 'x' },
      { role: 'user', content: 123 },
      { role: 'user', content: '   ' },
      { role: 'assistant', content: 'kept' },
      null,
      'nope',
    ])
    expect(out).toEqual([{ role: 'assistant', content: 'kept' }])
  })

  it('caps to the most recent MAX_MESSAGES turns', () => {
    const many = Array.from({ length: MAX_MESSAGES + 10 }, (_, i) => ({
      role: 'user' as const,
      content: `m${i}`,
    }))
    const out = sanitizeMessages(many)
    expect(out).toHaveLength(MAX_MESSAGES)
    // Oldest rolled off; newest retained.
    expect(out[0].content).toBe(`m10`)
    expect(out[out.length - 1].content).toBe(`m${MAX_MESSAGES + 9}`)
  })
})
