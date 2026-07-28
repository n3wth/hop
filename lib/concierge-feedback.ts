// Thumbs up/down feedback on a /ask answer, joined to that turn's exact LLM
// call via $ai_trace_id (the OTel trace id PostHogSpanProcessor forwards as
// $ai_generation's trace id — see app/api/concierge/route.ts and
// instrumentation.ts). Properties are PII-free by construction: one bounded
// rating plus a valid OTel trace id, never user-entered text.
//
// Fire-and-forget via lib/posthog-client.ts#track — never throws to the caller.

import { track } from '@/lib/posthog-client'

export type ConciergeFeedbackRating = 'up' | 'down'

export function trackConciergeFeedback(traceId: string, rating: ConciergeFeedbackRating): void {
  if (!/^[0-9a-f]{32}$/i.test(traceId) || /^0{32}$/.test(traceId)) return
  track('concierge_feedback', { rating, $ai_trace_id: traceId })
}
