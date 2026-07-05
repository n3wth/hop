// Thumbs up/down feedback on a /ask answer, joined to that turn's exact LLM
// call via $ai_trace_id (the OTel trace id PostHogSpanProcessor forwards as
// $ai_generation's trace id — see app/api/concierge/route.ts and
// instrumentation.ts). Two events, not one: the rating fires immediately on
// click; the optional reason (thumbs-down only) fires separately since the
// user may close the composer without typing one. Both are PII-free — the
// reason is free text at the user's discretion, capped and never a
// requirement to submit a rating.
//
// Fire-and-forget via lib/posthog-client.ts#track — never throws to the caller.

import { track } from '@/lib/posthog-client'

export const CONCIERGE_FEEDBACK_REASON_MAX = 500

export type ConciergeFeedbackRating = 'up' | 'down'

export function trackConciergeFeedback(traceId: string, rating: ConciergeFeedbackRating): void {
  track('concierge_feedback', { rating, $ai_trace_id: traceId })
}

export function trackConciergeFeedbackReason(traceId: string, reason: string): void {
  const detail = reason.trim().slice(0, CONCIERGE_FEEDBACK_REASON_MAX)
  if (!detail) return
  track('concierge_feedback_reason', { $ai_trace_id: traceId, detail })
}
