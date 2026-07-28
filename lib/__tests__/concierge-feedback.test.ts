import { beforeEach, describe, expect, it, vi } from 'vitest'

const { track } = vi.hoisted(() => ({ track: vi.fn() }))

vi.mock('@/lib/posthog-client', () => ({ track }))

import { trackConciergeFeedback } from '@/lib/concierge-feedback'

describe('concierge trace feedback', () => {
  beforeEach(() => track.mockClear())

  it('sends only a bounded rating and valid trace id', () => {
    const traceId = '1234567890abcdef1234567890abcdef'
    trackConciergeFeedback(traceId, 'down')

    expect(track).toHaveBeenCalledWith('concierge_feedback', {
      rating: 'down',
      $ai_trace_id: traceId,
    })
  })

  it('drops invalid, fake, and all-zero trace ids', () => {
    trackConciergeFeedback('not-a-trace', 'up')
    trackConciergeFeedback('0'.repeat(32), 'down')

    expect(track).not.toHaveBeenCalled()
  })
})
