'use client'

// Client-side PostHog — the browser half of the R0.5 funnel (the server half
// is lib/posthog-server.ts). Same contract as every hop telemetry seam:
// gated on key presence (no NEXT_PUBLIC_POSTHOG_KEY → every call is a no-op),
// fire-and-forget, and NEVER throws to the caller. NEXT_PUBLIC_* vars are
// inlined at build time, so this reads process.env directly (the lib/env.ts
// lazy accessors are a server pattern — same precedent as lib/seo.ts).
//
// PII rule: identify() takes the opaque Better Auth user.id only — never an
// email or name. Event properties must stay PII-free (routes, cabins, counts).

import posthog from 'posthog-js'

let booted = false

function ready(): boolean {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key || key.trim() === '') return false
  if (!booted) {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      // Pageviews on load + history changes (App Router client nav); no DOM
      // autocapture — the five funnel events are explicit and named.
      capture_pageview: 'history_change',
      autocapture: false,
      persistence: 'localStorage+cookie',
    })
    booted = true
  }
  return true
}

/** Boot PostHog (idempotent). Called by components/PostHogBoot on mount. */
export function bootAnalytics(): void {
  try {
    ready()
  } catch {
    // Analytics must never break the page.
  }
}

/** Tie this browser's events to the signed-in Better Auth user id. */
export function identifyUser(userId: string): void {
  try {
    if (!userId || !ready()) return
    posthog.identify(userId)
  } catch {
    // Never throws to the caller.
  }
}

/** Capture one named product event (PII-free properties only). */
export function track(event: string, properties?: Record<string, unknown>): void {
  try {
    if (!event || !ready()) return
    posthog.capture(event, properties)
  } catch {
    // Never throws to the caller.
  }
}
