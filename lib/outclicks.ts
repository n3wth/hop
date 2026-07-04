// First-party affiliate outclick ledger (hop_outclicks) — the conversion
// baseline behind the /api/go/* redirects (monetization Phase 1.5). Today's
// card applyUrls are placeholder landing pages; when the CJ/Impact network
// links land, this table is the first-party click record we verify network
// reporting against.
//
// Best-effort by contract: the insert runs behind withDb — an unconfigured
// DB, a dead DB, or a not-yet-migrated hop_outclicks table all degrade
// to a silent no-op — and nothing here can throw to or slow down the redirect
// that triggered it. It RETURNS its promise (never rejects) so a route can
// hand it to next/server's after(): on serverless, an untracked async write
// can be cut off the moment the response is sent; after() keeps the function
// alive until the insert settles.
//
// SERVER ONLY (pulls in the service-role client via withDb) — never import
// from a client component. Anonymous by design: no user_id is recorded.

import { FUNNEL_EVENTS } from '@/lib/analytics'
import { captureFunnelEvent } from '@/lib/posthog-server'
import { withDb } from '@/lib/supabase-helpers'

export interface Outclick {
  /**
   * Outclick family: 'card' (the credit-card affiliate CTA, /api/go/card) or
   * 'cash' (the Kiwi cash-booking CTA, /api/go/kiwi).
   */
  kind: string
  /**
   * What was clicked — for kind 'card', the canonical card id; for kind
   * 'cash', the route as "AAA-BBB" (or 'unknown').
   */
  target: string
  /** The destination URL the route redirected to. */
  url: string
  /** Optional verdict context (the pick's free-text program). */
  program?: string | null
  /** Optional User-Agent header — bot filtering later, never identity. */
  userAgent?: string | null
}

// Record one outclick. Never blocks or breaks the caller: every failure path
// is swallowed (withDb already never throws; the try/catch is belt and
// suspenders for a synchronous throw while kicking it off). The returned
// promise always resolves — await it (or pass it to after()) only to keep a
// serverless function alive until the write settles.
//
// Every ledger insert also emits the funnel `outclick` event (N-301 / R0.5)
// through the same never-throws PostHog seam — no distinctId, mirroring the
// ledger's anonymous-by-design shape. Both writes are chained into the
// returned promise so after() keeps the function alive for the capture too.
export function recordOutclick(click: Outclick): Promise<void> {
  try {
    const insert = withDb<undefined>(undefined, async (db) => {
      await db.from('hop_outclicks').insert({
        kind: click.kind,
        target: click.target,
        url: click.url,
        program: click.program ?? null,
        user_agent: click.userAgent ?? null,
      })
      return undefined
    })
    const capture = captureFunnelEvent({
      event: FUNNEL_EVENTS.outclick,
      properties: {
        kind: click.kind,
        target: click.target,
        url: click.url,
        program: click.program ?? null,
      },
    })
    // Both already never reject; allSettled is belt and suspenders.
    return Promise.allSettled([insert, capture]).then(() => undefined)
  } catch {
    // Best-effort contract: a lost click row costs analytics, never UX.
    return Promise.resolve()
  }
}
