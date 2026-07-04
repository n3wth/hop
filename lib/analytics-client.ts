// Client half of the funnel (N-301) — posthog-js, loaded lazily and gated on
// NEXT_PUBLIC_POSTHOG_KEY. Without the key this whole module is a silent
// no-op: posthog-js is never even imported (it lives in its own async chunk),
// nothing is logged, and no call here can ever throw to a component.
//
// Env reads are DELIBERATELY direct `process.env.NEXT_PUBLIC_*` member
// expressions, not lib/env.ts accessors: Next only inlines env vars into the
// browser bundle when the reference is a static member expression (see
// node_modules/next/dist/docs/01-app/02-guides/environment-variables.md), and
// lib/env.ts's dynamic `process.env[key]` lookup — besides never being
// inlined — pulls in node:crypto, which has no place in a client bundle. The
// keys stay registered in lib/env.ts's EnvKey union for the server-side half.

import type { FunnelEventName, FunnelEventProperties } from '@/lib/analytics'

// Matches lib/posthog-server.ts / instrumentation.ts.
const DEFAULT_HOST = 'https://us.i.posthog.com'

type PostHogLike = {
  init: (key: string, options: Record<string, unknown>) => unknown
  capture: (event: string, properties?: Record<string, unknown>) => unknown
  identify: (distinctId: string) => unknown
}

// Memoized init — posthog-js is imported and initialized at most once per
// page. Resolves null (never rejects) when analytics is off or the SDK fails.
let clientPromise: Promise<PostHogLike | null> | null = null

function getClient(): Promise<PostHogLike | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  const key = (process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '').trim()
  if (!key) return Promise.resolve(null)
  clientPromise ??= import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? '').trim() || DEFAULT_HOST,
        // EXACTLY the five funnel events — no autocapture clicks, no
        // $pageview/$pageleave (pageviews are @vercel/analytics' job).
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        // Anonymous visitors stay cheap anonymous events; a person profile is
        // only created once identifyUser() runs for a signed-in user, and
        // their earlier anonymous events merge into it.
        person_profiles: 'identified_only',
      })
      return posthog as PostHogLike
    })
    .catch(() => null)
  return clientPromise
}

// Capture one funnel event. Fire-and-forget: silent no-op without the key,
// and no failure (SDK load, init, capture) can reach the calling component.
export function captureClientEvent<E extends FunnelEventName>(
  event: E,
  properties: FunnelEventProperties[E],
): void {
  try {
    void getClient()
      .then((posthog) => {
        posthog?.capture(event, properties)
      })
      .catch(() => {})
  } catch {
    // Belt and suspenders — analytics must never break a page.
  }
}

// Tie this device's events to the Better Auth user id — the same distinct_id
// the server-side signed_up / first_program_added events use, so client and
// server halves land on one PostHog person. Same no-op/no-throw contract.
export function identifyUser(userId: string): void {
  if (!userId || userId.trim() === '') return
  try {
    void getClient()
      .then((posthog) => {
        posthog?.identify(userId)
      })
      .catch(() => {})
  } catch {
    // Never to the page.
  }
}
