// Weekly business digest — hop reporting on its own funnel (the "self-aware
// growth" loop). Computes the week's numbers ENTIRELY from hop's own tables and
// renders a terse owner email. Two halves, deliberately separated:
//
//   1. computeBusinessDigest() — the resolver. Each metric is its own withDb
//      query with a null fallback, so one missing table (hop_subscriptions may
//      not exist yet) or a dead db degrades THAT section to null and NEVER
//      throws. No metric is ever guessed: null means "we could not count it".
//   2. renderBusinessDigest() — a PURE formatter. Copy-spec voice: state the
//      number plainly ("3 booking requests · 12 alerts fired · 5 active
//      watches"), omit any section whose source degraded, and return null when
//      every source degraded (nothing to report → nothing sent). Plain text is
//      canonical; the HTML is flat and minimal, matching lib/email.ts.
//
// NO LLM anywhere in this pipeline — every figure is a counted row. Delivered
// by app/api/cron/business-digest/route.ts via sendOwnerNotification, weekly.

import { withDb } from '@/lib/supabase-helpers'
import { getDb, schema } from '@/lib/db'
import { gte } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// A counted metric for the current week plus (when cheap to compute) last
// week's count for a plain week-over-week comparison. prev is null when the
// previous-week query degraded — we then state only the current number.
export interface WeeklyMetric {
  count: number
  prev: number | null
  /** Weekly counts for the trailing TREND_WEEKS weeks, oldest → newest (the
   *  last bucket is the current week). null when the trend query degraded —
   *  the tile then shows the number without a sparkline, never a guessed line. */
  trend?: number[] | null
}

// The outclick metric adds the window total across ALL kinds to the standard
// weekly shape, so the digest keeps one line even as more outclick kinds land.
export interface OutclickMetric extends WeeklyMetric {
  /** All outclicks in the window regardless of kind. null when that count degraded. */
  total: number | null
}

export interface SystemFindingInfo {
  title: string
  identifier: string | null
}

export interface SystemDigest {
  openFindings: SystemFindingInfo[] | null
  counts: { resolved: number; filed: number } | null
  degradations: Record<string, number> | null
  sentinelLastRunAt: string | null
}

export interface BusinessDigest {
  /** ISO datetimes bounding the 7-day window [start, end). */
  window: { start: string; end: string }
  /** Distinct users with a Better Auth session touched in the window (a
   *  weekly-active-users proxy — sessions refresh on use). null = degraded. */
  activeUsers: WeeklyMetric | null
  /** New expert-booking requests (hop_escalations), last 7d. null = degraded. */
  escalations: WeeklyMetric | null
  /** New standing orders created (hop_standing_orders), last 7d. null = degraded. */
  ordersCreated: WeeklyMetric | null
  /** Alerts fired (hop_standing_order_alerts), last 7d. null = degraded. */
  alertsFired: WeeklyMetric | null
  /** Total ACTIVE watches right now (point-in-time). null = degraded. */
  activeWatches: number | null
  /** Users on a paid tier (hop_subscriptions, tier != 'free'). null = degraded
   *  — expected until that table exists/has rows. */
  activeSubscriptions: number | null
  /** Card-affiliate outclicks (hop_outclicks, kind='card'), last 7d, plus the
   *  window total across all kinds. null = degraded — expected until
   *  the hop_outclicks migration has been applied. */
  outclicks: OutclickMetric | null
  /** Verdict receipts minted (hop_shared_verdicts), last 7d — the R1.5 spread
   *  measurement ("is anyone sharing?"). null = degraded — expected until the
   *  drizzle/0010_nervous_clea.sql migration has been applied or the flag is off. */
  receiptsCreated: WeeklyMetric | null
  /** System section (PR 2 of self-improvement loop) — four independent
   *  null-degrading queries. null = degraded entirely. */
  system?: SystemDigest | null
}

export interface RenderedDigest {
  subject: string
  text: string
  html: string
  /** Which sections made it into the email (sources that did NOT degrade). */
  sections: string[]
}

// ---------------------------------------------------------------------------
// Window math (pure, exported for tests)
// ---------------------------------------------------------------------------

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** How many trailing weeks a metric's trend covers (sparkline points). */
export const TREND_WEEKS = 8

// The reporting windows: [start, end) is the last 7 days ending at `now`;
// [prevStart, start) is the 7 days before that.
export function weekWindow(now: Date = new Date()): {
  start: string
  end: string
  prevStart: string
} {
  const end = now.getTime()
  return {
    start: new Date(end - WEEK_MS).toISOString(),
    end: new Date(end).toISOString(),
    prevStart: new Date(end - 2 * WEEK_MS).toISOString(),
  }
}

// Bucket timestamps into TREND_WEEKS trailing 7-day windows ending at `now`,
// oldest bucket first. Pure (exported for tests). Unparseable or out-of-range
// stamps are dropped, never guessed into a bucket.
export function bucketWeeks(
  timestamps: Array<string | Date | null | undefined>,
  now: Date = new Date(),
  weeks: number = TREND_WEEKS,
): number[] {
  const end = now.getTime()
  const start = end - weeks * WEEK_MS
  const buckets = new Array<number>(weeks).fill(0)
  for (const t of timestamps) {
    if (t == null) continue
    const ms = t instanceof Date ? t.getTime() : Date.parse(t)
    if (!Number.isFinite(ms) || ms < start || ms >= end) continue
    buckets[Math.floor((ms - start) / WEEK_MS)]++
  }
  return buckets
}

// ---------------------------------------------------------------------------
// Resolver — every count degrades to null, never throws
// ---------------------------------------------------------------------------

// Tables we count created_at rows from. Kept to the ones the digest reads so a
// typo can't silently count the wrong table.
type CountedTable =
  | 'hop_escalations'
  | 'hop_standing_orders'
  | 'hop_standing_order_alerts'
  | 'hop_shared_verdicts'

// Count rows created in [sinceIso, untilIso). null (not 0) on any failure so a
// degraded source is distinguishable from a genuinely quiet week.
async function countCreatedBetween(
  table: CountedTable,
  sinceIso: string,
  untilIso: string,
): Promise<number | null> {
  return withDb<number | null>(null, async (db) => {
    const { count, error } = await db
      .from(table)
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sinceIso)
      .lt('created_at', untilIso)
    if (error || typeof count !== 'number') return null
    return count
  })
}

// Fetch a table's timestamp column for the trailing trend window so the
// sparkline buckets can be computed in JS (row volumes here are tiny). null on
// any failure — the metric then ships without a trend, never with a guessed one.
async function fetchStampsSince(
  table: CountedTable | 'hop_outclicks',
  column: 'created_at' | 'clicked_at',
  sinceIso: string,
): Promise<string[] | null> {
  return withDb<string[] | null>(null, async (db) => {
    const { data, error } = await db.from(table).select(column).gte(column, sinceIso)
    if (error || !Array.isArray(data)) return null
    return (data as Array<Record<string, string | null>>).map((r) => r[column]).filter(
      (v): v is string => typeof v === 'string',
    )
  })
}

// A week metric = this week's count + last week's (for the delta) + the
// trailing TREND_WEEKS buckets (for the sparkline). When the current week
// degrades the whole metric is null; a degraded prev or trend is dropped
// independently.
async function weeklyMetric(
  table: CountedTable,
  w: { start: string; end: string; prevStart: string },
  now: Date,
): Promise<WeeklyMetric | null> {
  const trendStart = new Date(now.getTime() - TREND_WEEKS * WEEK_MS).toISOString()
  const [count, prev, stamps] = await Promise.all([
    countCreatedBetween(table, w.start, w.end),
    countCreatedBetween(table, w.prevStart, w.start),
    fetchStampsSince(table, 'created_at', trendStart),
  ])
  if (count === null) return null
  return { count, prev, trend: stamps === null ? null : bucketWeeks(stamps, now) }
}

// Distinct users with a Better Auth session row touched per week — the
// weekly-active-users proxy. The session table is Better Auth core (not a
// hop_* table behind the shim), so this reads it via Drizzle directly with the
// same contract: any failure → null, never a throw.
async function activeUsersMetric(
  w: { start: string; end: string; prevStart: string },
  now: Date,
): Promise<WeeklyMetric | null> {
  try {
    const db = getDb()
    if (!db) return null
    const trendStart = new Date(now.getTime() - TREND_WEEKS * WEEK_MS)
    const rows = await db
      .select({ userId: schema.session.userId, updatedAt: schema.session.updatedAt })
      .from(schema.session)
      .where(gte(schema.session.updatedAt, trendStart))
    const distinctBetween = (fromMs: number, toMs: number) => {
      const ids = new Set<string>()
      for (const r of rows) {
        const ms = r.updatedAt instanceof Date ? r.updatedAt.getTime() : Date.parse(String(r.updatedAt))
        if (Number.isFinite(ms) && ms >= fromMs && ms < toMs && r.userId) ids.add(r.userId)
      }
      return ids.size
    }
    const endMs = now.getTime()
    const trend: number[] = []
    for (let i = TREND_WEEKS; i >= 1; i--) {
      trend.push(distinctBetween(endMs - i * WEEK_MS, endMs - (i - 1) * WEEK_MS))
    }
    return {
      count: distinctBetween(Date.parse(w.start), Date.parse(w.end)),
      prev: distinctBetween(Date.parse(w.prevStart), Date.parse(w.start)),
      trend,
    }
  } catch {
    return null
  }
}

// Total active watches right now. null on failure.
async function countActiveWatches(): Promise<number | null> {
  return withDb<number | null>(null, async (db) => {
    const { count, error } = await db
      .from('hop_standing_orders')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)
    if (error || typeof count !== 'number') return null
    return count
  })
}

// Count hop_outclicks rows clicked in [sinceIso, untilIso), optionally
// filtered to one kind. hop_outclicks stamps clicked_at (not created_at), so
// it gets its own counter. The table may not exist yet (migration authored,
// not applied) — that surfaces as a query error → null, like everything else.
async function countOutclicksBetween(
  kind: string | null,
  sinceIso: string,
  untilIso: string,
): Promise<number | null> {
  return withDb<number | null>(null, async (db) => {
    let q = db
      .from('hop_outclicks')
      .select('id', { count: 'exact', head: true })
      .gte('clicked_at', sinceIso)
      .lt('clicked_at', untilIso)
    if (kind !== null) q = q.eq('kind', kind)
    const { count, error } = await q
    if (error || typeof count !== 'number') return null
    return count
  })
}

// Card outclicks this week + last week (the standard weekly shape), plus the
// window total across all kinds. Degrades exactly like weeklyMetric: no
// current-week count → the whole metric is null; a degraded prev/total is
// dropped from the copy, never invented.
async function outclickMetric(
  w: { start: string; end: string; prevStart: string },
  now: Date,
): Promise<OutclickMetric | null> {
  const trendStart = new Date(now.getTime() - TREND_WEEKS * WEEK_MS).toISOString()
  const [count, prev, total, stamps] = await Promise.all([
    countOutclicksBetween('card', w.start, w.end),
    countOutclicksBetween('card', w.prevStart, w.start),
    countOutclicksBetween(null, w.start, w.end),
    fetchStampsSince('hop_outclicks', 'clicked_at', trendStart),
  ])
  if (count === null) return null
  return { count, prev, total, trend: stamps === null ? null : bucketWeeks(stamps, now) }
}

// Paid subscribers (any non-free tier). The table may not exist yet — that
// surfaces as a query error, which degrades to null exactly like everything
// else. null on failure.
async function countActiveSubscriptions(): Promise<number | null> {
  return withDb<number | null>(null, async (db) => {
    const { count, error } = await db
      .from('hop_subscriptions')
      .select('id', { count: 'exact', head: true })
      .in('status', ['active', 'trialing'])
      .gt('current_period_end', new Date().toISOString())
    if (error || typeof count !== 'number') return null
    return count
  })
}

// System section queries (four independent null-degrading queries).
async function computeSystemDigest(
  w: { start: string; end: string },
): Promise<SystemDigest | null> {
  const [openFindings, counts, degradations, sentinelLastRunAt] = await Promise.all([
    // 1. Open findings
    withDb<SystemFindingInfo[] | null>(null, async (db) => {
      const { data, error } = await db
        .from('hop_improvement_findings')
        .select('title, linear_identifier')
        .eq('status', 'open')
        .order('first_seen_at', { ascending: true })
      if (error || !data) return null
      return (data as Array<{ title: string; linear_identifier: string | null }>).map((r) => ({
        title: r.title,
        identifier: r.linear_identifier,
      }))
    }),

    // 2. Resolved/Filed since last week
    withDb<{ resolved: number; filed: number } | null>(null, async (db) => {
      const [resResult, filResult] = await Promise.all([
        db
          .from('hop_improvement_findings')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'resolved')
          .gte('resolved_at', w.start)
          .lt('resolved_at', w.end),
        db
          .from('hop_improvement_findings')
          .select('id', { count: 'exact', head: true })
          .gte('filed_at', w.start)
          .lt('filed_at', w.end),
      ])
      if (
        resResult.error ||
        filResult.error ||
        typeof resResult.count !== 'number' ||
        typeof filResult.count !== 'number'
      ) {
        return null
      }
      return { resolved: resResult.count, filed: filResult.count }
    }),

    // 3. 7d degradation counts per source
    withDb<Record<string, number> | null>(null, async (db) => {
      const { data, error } = await db
        .from('hop_degradation_events')
        .select('source')
        .gte('created_at', w.start)
        .lt('created_at', w.end)
      if (error || !data) return null
      const counts: Record<string, number> = {}
      for (const r of data as Array<{ source: string }>) {
        counts[r.source] = (counts[r.source] ?? 0) + 1
      }
      return counts
    }),

    // 4. Sentinel last run age
    withDb<string | null>(null, async (db) => {
      const { data, error } = await db
        .from('hop_cron_heartbeats')
        .select('last_run_at')
        .eq('job', 'health-sentinel')
        .maybeSingle()
      if (error || !data) return null
      return (data as { last_run_at: string }).last_run_at
    }),
  ])

  if (openFindings === null && counts === null && degradations === null && sentinelLastRunAt === null) {
    return null
  }

  return { openFindings, counts, degradations, sentinelLastRunAt }
}

// Compute the week's digest from hop's own tables. Every section is an
// independent query; a failure in one degrades only that section. NEVER throws.
export async function computeBusinessDigest(now: Date = new Date()): Promise<BusinessDigest> {
  const w = weekWindow(now)
  const [
    activeUsers,
    escalations,
    ordersCreated,
    alertsFired,
    activeWatches,
    activeSubscriptions,
    outclicks,
    receiptsCreated,
    system,
  ] = await Promise.all([
    activeUsersMetric(w, now),
    weeklyMetric('hop_escalations', w, now),
    weeklyMetric('hop_standing_orders', w, now),
    weeklyMetric('hop_standing_order_alerts', w, now),
    countActiveWatches(),
    countActiveSubscriptions(),
    outclickMetric(w, now),
    weeklyMetric('hop_shared_verdicts', w, now),
    computeSystemDigest(w),
  ])
  return {
    window: { start: w.start, end: w.end },
    activeUsers,
    escalations,
    ordersCreated,
    alertsFired,
    activeWatches,
    activeSubscriptions,
    outclicks,
    receiptsCreated,
    system,
  }
}

// ---------------------------------------------------------------------------
// Formatter — PURE. Terse copy-spec voice; degraded sections are omitted.
// ---------------------------------------------------------------------------

// "3 booking requests" / "1 booking request" — plain pluralization, no slop.
function n(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

// Week-over-week suffix, only when last week's count actually resolved. States
// both numbers plainly rather than editorializing.
function vsLastWeek(prev: number | null): string {
  return prev === null ? '' : ` (last week ${prev})`
}

// "Jun 25 – Jul 2" for the subject/header. UTC so the cron's framing is stable.
function fmtWindow(window: BusinessDigest['window']): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `${fmt(window.start)} – ${fmt(window.end)}`
}

interface Section {
  key: string
  /** Short phrase for the subject/summary line, e.g. "3 booking requests". */
  headline: string
  /** Full body line, e.g. "Booking requests: 3 (last week 1)". */
  line: string
}

function buildSections(d: BusinessDigest): Section[] {
  const sections: Section[] = []
  if (d.activeUsers) {
    sections.push({
      key: 'activeUsers',
      headline: n(d.activeUsers.count, 'active user', 'active users'),
      line: `Active users: ${d.activeUsers.count}${vsLastWeek(d.activeUsers.prev)}`,
    })
  }
  if (d.escalations) {
    sections.push({
      key: 'escalations',
      headline: n(d.escalations.count, 'booking request', 'booking requests'),
      line: `Booking requests: ${d.escalations.count}${vsLastWeek(d.escalations.prev)}`,
    })
  }
  if (d.ordersCreated) {
    sections.push({
      key: 'ordersCreated',
      headline: n(d.ordersCreated.count, 'new watch', 'new watches'),
      line: `New watches: ${d.ordersCreated.count}${vsLastWeek(d.ordersCreated.prev)}`,
    })
  }
  if (d.alertsFired) {
    sections.push({
      key: 'alertsFired',
      headline: `${d.alertsFired.count} alerts fired`,
      line: `Alerts fired: ${d.alertsFired.count}${vsLastWeek(d.alertsFired.prev)}`,
    })
  }
  if (d.activeWatches !== null) {
    sections.push({
      key: 'activeWatches',
      headline: n(d.activeWatches, 'active watch', 'active watches'),
      line: `Active watches: ${d.activeWatches}`,
    })
  }
  if (d.activeSubscriptions !== null) {
    sections.push({
      key: 'activeSubscriptions',
      headline: n(d.activeSubscriptions, 'paid subscriber', 'paid subscribers'),
      line: `Paid subscribers: ${d.activeSubscriptions}`,
    })
  }
  if (d.receiptsCreated) {
    sections.push({
      key: 'receiptsCreated',
      headline: n(d.receiptsCreated.count, 'verdict receipt', 'verdict receipts'),
      line: `Verdict receipts: ${d.receiptsCreated.count}${vsLastWeek(d.receiptsCreated.prev)}`,
    })
  }
  if (d.outclicks) {
    // The all-kinds window total is appended only when it differs from the
    // card count — today card is the only kind, so the line stays terse.
    const { count, prev, total } = d.outclicks
    const totalSuffix = total !== null && total !== count ? ` · ${total} total` : ''
    sections.push({
      key: 'outclicks',
      headline: n(count, 'card outclick', 'card outclicks'),
      line: `Card outclicks: ${count}${vsLastWeek(prev)}${totalSuffix}`,
    })
  }
  return sections
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Render the digest email. PURE — formats only what the resolver counted; a
// degraded (null) section is simply omitted. Returns null when EVERY source
// degraded (there is nothing true to say, so we say nothing).
export function renderBusinessDigest(d: BusinessDigest, now: Date = new Date()): RenderedDigest | null {
  const sections = buildSections(d)
  if (sections.length === 0) return null

  const range = fmtWindow(d.window)
  const summary = sections.map((s) => s.headline).join(' · ')
  const subject = `hop this week: ${summary}`

  const systemLines: string[] = []
  const systemHtmlLines: string[] = []
  if (d.system) {
    const s = d.system
    if (s.openFindings && s.openFindings.length > 0) {
      const items = s.openFindings
        .map((f) => {
          const num = f.identifier ? ` (${f.identifier})` : ''
          return `${f.title}${num}`
        })
        .join(' · ')
      systemLines.push(`Needs attention: ${items}`)
      systemHtmlLines.push(`Needs attention: ${items}`)
    }

    if (s.counts) {
      const line = `Resolved since last week: ${s.counts.resolved} · Filed: ${s.counts.filed}`
      systemLines.push(line)
      systemHtmlLines.push(line)
    }

    if (s.degradations) {
      const total = Object.values(s.degradations).reduce((a, b) => a + b, 0)
      const detail = Object.entries(s.degradations)
        .filter((entry) => entry[1] > 0)
        .map(([source, count]) => `${source} ${count}`)
        .join(', ')
      const detailSuffix = detail ? ` (${detail})` : ''
      const line = `Degraded fetches, 7d: ${total}${detailSuffix}`
      systemLines.push(line)
      systemHtmlLines.push(line)
    }

    if (s.sentinelLastRunAt) {
      const t = Date.parse(s.sentinelLastRunAt)
      if (Number.isFinite(t)) {
        const ageHours = Math.round((now.getTime() - t) / (60 * 60 * 1000))
        const line = `Sentinel last ran ${ageHours}h ago.`
        systemLines.push(line)
        systemHtmlLines.push(line)
      }
    }
  }

  const systemBlockText =
    systemLines.length > 0 ? ['', 'System:', ...systemLines.map((l) => `  ${l}`)] : []

  const systemBlockHtml =
    systemHtmlLines.length > 0
      ? [
          `<p style="margin:20px 0 4px;font-size:16px;font-weight:600">System</p>`,
          `<ul style="margin:0;padding-left:18px;color:#1a1a1a">`,
          ...systemHtmlLines.map((l) => `<li style="margin:0 0 4px">${escapeHtml(l)}</li>`),
          `</ul>`,
        ]
      : []

  // Plain text — canonical body. Summary line, then one line per section.
  const text = [
    `hop, ${range}.`,
    '',
    summary,
    '',
    ...sections.map((s) => s.line),
    ...systemBlockText,
    '',
    'Counted from hop’s own tables. Sections with a degraded source are omitted.',
  ].join('\n')

  // Flat, minimal HTML — no shadows/gradients; inline styles only.
  const html = [
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.5;max-width:480px">`,
    `<p style="margin:0 0 8px;font-size:17px;font-weight:600">hop, ${escapeHtml(range)}</p>`,
    `<p style="margin:0 0 16px;color:#555">${escapeHtml(summary)}</p>`,
    `<ul style="margin:0;padding-left:18px;color:#1a1a1a">`,
    ...sections.map((s) => `<li style="margin:0 0 4px">${escapeHtml(s.line)}</li>`),
    `</ul>`,
    ...systemBlockHtml,
    `<p style="margin:24px 0 0;color:#888;font-size:13px">Counted from hop&#39;s own tables. Sections with a degraded source are omitted.</p>`,
    `</div>`,
  ].join('')

  return { subject, text, html, sections: sections.map((s) => s.key) }
}
