// First-party affiliate outclick ledger (hop_outclicks) — the conversion
// baseline behind the /api/go/* redirects (monetization Phase 1.5). Today's
// card applyUrls are placeholder landing pages; when the CJ/Impact network
// links land, this table is the first-party click record we verify network
// reporting against.
//
// Fire-and-forget by contract, mirroring lib/valuation-telemetry.ts:
// recordOutclick() is synchronous (void), the insert runs behind withDb — an
// unconfigured DB, a dead DB, or a not-yet-applied drizzle/0006_outclicks.sql
// all degrade to a silent no-op — and nothing here can throw to or slow down
// the redirect that triggered it.
//
// SERVER ONLY (pulls in the service-role client via withDb) — never import
// from a client component. Anonymous by design: no user_id is recorded.

import { withDb } from '@/lib/supabase-helpers'

export interface Outclick {
  /** Outclick family, e.g. 'card' (the credit-card affiliate CTA). */
  kind: string
  /** What was clicked — for kind 'card', the canonical card id. */
  target: string
  /** The destination URL the route redirected to. */
  url: string
  /** Optional verdict context (the pick's free-text program). */
  program?: string | null
  /** Optional User-Agent header — bot filtering later, never identity. */
  userAgent?: string | null
}

// Record one outclick. Synchronous (returns void) so the caller can never be
// blocked or broken by the ledger: the insert is fired and every failure path
// is swallowed (withDb already never throws; the try/catch is belt and
// suspenders for a synchronous throw while kicking it off).
export function recordOutclick(click: Outclick): void {
  try {
    void withDb(undefined, async (db) => {
      await db.from('hop_outclicks').insert({
        kind: click.kind,
        target: click.target,
        url: click.url,
        program: click.program ?? null,
        user_agent: click.userAgent ?? null,
      })
      return undefined
    })
  } catch {
    // Fire-and-forget contract: a lost click row costs analytics, never UX.
  }
}
