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

import { withDb } from '@/lib/supabase-helpers'
import { captureServerEvent } from '@/lib/posthog-server'

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

export interface OutclickRow {
  kind: string
  target: string
  program: string | null
  /** hop_outclicks has no created_at column — this is clicked_at (see schema.ts). */
  createdAt: string | null
}

export interface OutclickSummary {
  /** Clicks per kind in the trailing 7 days. */
  last7d: Record<string, number>
  /** 7-day total across kinds. */
  total: number
}

// The owner's revenue-reconciliation reads (/admin/ops). null = the read
// failed/unconfigured (unknown), never a fake zero — same convention as
// lib/cron-heartbeat.ts.
export async function listRecentOutclicks(limit = 20): Promise<OutclickRow[] | null> {
  return withDb<OutclickRow[] | null>(null, async (db) => {
    const { data, error } = await db
      .from('hop_outclicks')
      .select('kind, target, program, clicked_at')
      .order('clicked_at', { ascending: false })
      .limit(limit)
    if (error || !data) return null
    return (data as Array<Record<string, unknown>>).map((r) => ({
      kind: String(r.kind ?? ''),
      target: String(r.target ?? ''),
      program: typeof r.program === 'string' ? r.program : null,
      // withDb returns Postgrest-style snake_case rows.
      createdAt: typeof r.clicked_at === 'string' ? r.clicked_at : null,
    }))
  })
}

export async function getOutclickSummary(now: Date = new Date()): Promise<OutclickSummary | null> {
  return withDb<OutclickSummary | null>(null, async (db) => {
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await db
      .from('hop_outclicks')
      .select('kind, clicked_at')
      .gte('clicked_at', since)
    if (error || !data) return null
    const last7d: Record<string, number> = {}
    for (const row of data as Array<Record<string, unknown>>) {
      const kind = typeof row.kind === 'string' ? row.kind : 'unknown'
      last7d[kind] = (last7d[kind] ?? 0) + 1
    }
    return { last7d, total: Object.values(last7d).reduce((s, n) => s + n, 0) }
  })
}

// Record one outclick. Never blocks or breaks the caller: every failure path
// is swallowed (withDb already never throws; the try/catch is belt and
// suspenders for a synchronous throw while kicking it off). The returned
// promise always resolves — await it (or pass it to after()) only to keep a
// serverless function alive until the write settles.
export function recordOutclick(click: Outclick): Promise<void> {
  try {
    // R0.5 funnel event #5 — the server-side outclick shadow of this ledger
    // insert, so revenue clicks join the PostHog funnel even when client JS
    // never ran (the /api/go/* redirect IS the click). Anonymous like the
    // ledger row: kind + target only, no URL (it can carry query params).
    const capture = captureServerEvent('outclick', { kind: click.kind, target: click.target })
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
    // Chain BOTH into the returned promise: /api/go/* hands this to after(),
    // which must keep the function alive for the capture as well as the row.
    // Neither ever rejects; allSettled is belt and suspenders.
    return Promise.allSettled([insert, capture]).then(() => undefined)
  } catch {
    // Best-effort contract: a lost click row costs analytics, never UX.
    return Promise.resolve()
  }
}
