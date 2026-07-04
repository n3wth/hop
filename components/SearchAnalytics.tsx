'use client'

// The funnel's two search-surface events (N-301 / R0.5), fired client-side so
// they carry the visitor's device/session: `search_ran` for every executed
// search, `verdict_viewed` only when a verdict hero actually rendered (the
// page's own rule — result.pick exists; empty/degraded searches show
// EmptyState instead of a verdict). Also identify(): the Better Auth user id
// joins these device events to the person the server-side signed_up /
// first_program_added events land on.
//
// Renders nothing. Silent no-op without NEXT_PUBLIC_POSTHOG_KEY and never
// throws (lib/analytics-client's contract). All prop values are engine
// output passed through — nothing here computes or generates a number.

import { useEffect, useRef } from 'react'

import { FUNNEL_EVENTS } from '@/lib/analytics'
import { captureClientEvent, identifyUser } from '@/lib/analytics-client'

export interface SearchAnalyticsProps {
  /** Better Auth user id when signed in — null stays anonymous. */
  userId: string | null
  origin: string
  destination: string
  /** The engine verdict behind the rendered hero; null → no verdict shown. */
  verdict: string | null
  /** The pick's computed cents-per-point, when a verdict rendered. */
  cpp: number | null
  /** The pick's program, when a verdict rendered. */
  program: string | null
}

export default function SearchAnalytics({
  userId,
  origin,
  destination,
  verdict,
  cpp,
  program,
}: SearchAnalyticsProps) {
  // One capture per distinct search: the signature guard swallows Strict Mode
  // double-effects and same-search re-renders, while a client-side navigation
  // to new params still fires fresh events.
  const fired = useRef<string | null>(null)

  useEffect(() => {
    const signature = `${origin}|${destination}|${verdict ?? ''}`
    if (fired.current === signature) return
    fired.current = signature

    if (userId) identifyUser(userId)
    captureClientEvent(FUNNEL_EVENTS.searchRan, { origin, destination })
    if (verdict) {
      captureClientEvent(FUNNEL_EVENTS.verdictViewed, { verdict, cpp, program })
    }
  }, [userId, origin, destination, verdict, cpp, program])

  return null
}
