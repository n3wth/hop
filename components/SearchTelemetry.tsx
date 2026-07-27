'use client'

import { useEffect, useRef } from 'react'
import { track } from '@/lib/posthog-client'

export interface SearchTelemetryProps {
  from: string
  to: string
  cabin?: string
  travelers: number
  /** The engine's verdict when a pick rendered; omit when there was nothing to
      recommend (no verdict_viewed without a verdict on screen). */
  verdict?: string
}

// R0.5 funnel events #3 + #4 — search_ran fires once per rendered /search
// result, verdict_viewed alongside it when a verdict hero actually rendered.
// Client-side so anonymous visitors carry a PostHog distinct_id that survives
// identify() after sign-up. Properties are PII-free route facts; every number
// on screen stays engine-computed — this only reports that it was seen.
export default function SearchTelemetry({
  from,
  to,
  cabin,
  travelers,
  verdict,
}: SearchTelemetryProps) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    track('search_ran', { from, to, cabin: cabin ?? 'economy', travelers })
    if (verdict) track('verdict_viewed', { verdict, from, to })
  }, [from, to, cabin, travelers, verdict])
  return null
}
