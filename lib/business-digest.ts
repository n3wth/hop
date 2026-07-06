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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// A counted metric for the current week plus (when cheap to compute) last
// week's count for a plain week-over-week comparison. prev is null when the
// previous-week query degraded — we then state only the current number.
export interface WeeklyMetric {
  count: number
  prev: number | null
}

export interface BusinessDigest {
  /** ISO datetimes bounding the 7-day window [start, end). */
  window: { start: string; end: string }
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

// ---------------------------------------------------------------------------
// Resolver — every count degrades to null, never throws
// ---------------------------------------------------------------------------

// Tables we count created_at rows from. Kept to the ones the digest reads so a
// typo can't silently count the wrong table.
type CountedTable = 'hop_escalations' | 'hop_standing_orders' | 'hop_standing_order_alerts'

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

// A week metric = this week's count + last week's (for the delta). When the
// current week degrades the whole metric is null; when only the previous week
// degrades we keep the current count and drop the comparison.
async function weeklyMetric(
  table: CountedTable,
  w: { start: string; end: string; prevStart: string },
): Promise<WeeklyMetric | null> {
  const [count, prev] = await Promise.all([
    countCreatedBetween(table, w.start, w.end),
    countCreatedBetween(table, w.prevStart, w.start),
  ])
  if (count === null) return null
  return { count, prev }
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

// Paid subscribers (any non-free tier). The table may not exist yet — that
// surfaces as a query error, which degrades to null exactly like everything
// else. null on failure.
async function countActiveSubscriptions(): Promise<number | null> {
  return withDb<number | null>(null, async (db) => {
    const { count, error } = await db
      .from('hop_subscriptions')
      .select('user_id', { count: 'exact', head: true })
      .neq('tier', 'free')
    if (error || typeof count !== 'number') return null
    return count
  })
}

// Compute the week's digest from hop's own tables. Every section is an
// independent query; a failure in one degrades only that section. NEVER throws.
export async function computeBusinessDigest(now: Date = new Date()): Promise<BusinessDigest> {
  const w = weekWindow(now)
  const [escalations, ordersCreated, alertsFired, activeWatches, activeSubscriptions] =
    await Promise.all([
      weeklyMetric('hop_escalations', w),
      weeklyMetric('hop_standing_orders', w),
      weeklyMetric('hop_standing_order_alerts', w),
      countActiveWatches(),
      countActiveSubscriptions(),
    ])
  return {
    window: { start: w.start, end: w.end },
    escalations,
    ordersCreated,
    alertsFired,
    activeWatches,
    activeSubscriptions,
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
export function renderBusinessDigest(d: BusinessDigest): RenderedDigest | null {
  const sections = buildSections(d)
  if (sections.length === 0) return null

  const range = fmtWindow(d.window)
  const summary = sections.map((s) => s.headline).join(' · ')
  const subject = `hop this week: ${summary}`

  // Plain text — canonical body. Summary line, then one line per section.
  const text = [
    `hop, ${range}.`,
    '',
    summary,
    '',
    ...sections.map((s) => s.line),
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
    `<p style="margin:24px 0 0;color:#888;font-size:13px">Counted from hop&#39;s own tables. Sections with a degraded source are omitted.</p>`,
    `</div>`,
  ].join('')

  return { subject, text, html, sections: sections.map((s) => s.key) }
}
