import { beforeEach, describe, expect, it, vi } from 'vitest'

const { generateText } = vi.hoisted(() => ({
  generateText: vi.fn().mockResolvedValue({ text: 'The traveler prefers window seats.' }),
}))

vi.mock('ai', () => ({
  generateText,
  gateway: vi.fn(() => 'test-model'),
}))

vi.mock('@/lib/env', () => ({ isConversationMemoryEnabled: () => true }))
vi.mock('@/lib/supabase-helpers', () => ({
  withDb: vi.fn((fallback: unknown) => Promise.resolve(fallback)),
}))

import { RETAIN, SUMMARIZE_AFTER, updateConversationMemory } from '@/lib/conversation-memory'
import type { ConversationMessage } from '@/lib/conversations'

describe('conversation memory generation privacy', () => {
  beforeEach(() => generateText.mockClear())

  it('passes an explicit telemetry opt-out with the accumulated transcript', async () => {
    const thread: ConversationMessage[] = Array.from(
      { length: SUMMARIZE_AFTER + RETAIN },
      (_, index) => ({
        role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
        content: `private turn ${index}`,
      }),
    )

    await updateConversationMemory('user-test', thread)

    expect(generateText).toHaveBeenCalledOnce()
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({ telemetry: { isEnabled: false } }),
    )
  })
})
