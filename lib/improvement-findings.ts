// The findings store (ADR 0007) — hop_improvement_findings, the durable queue
// between detection and delivery. Findings are idempotent and fingerprinted
// (`kind:subject`, UNIQUE): re-detection bumps last_seen_at, never a second
// row; re-detection within REOPEN_WINDOW_DAYS of resolving REOPENS the same
// row (same Linear issue — a flapping source can never pile up issues);
// re-detection after the window resets the row to a fresh episode (filing
// cleared, so a real regression correctly files a NEW issue).
//
// SYSTEM-SCOPED: no user_id column exists on this table, by design. Titles
// and bodies come from lib/improvement-templates.ts (engine numbers only).
//
// Every call goes through withDb with an explicit fallback — null/false means
// "the store degraded", which callers treat as UNKNOWN, never as success.

import { withDb } from '@/lib/supabase-helpers'
import { MAX_ISSUES_PER_RUN, REOPEN_WINDOW_DAYS, type FindingKind, type FindingSeverity } from '@/lib/health-checks'
import { fileIssue, isLinearConfigured } from '@/lib/linear'
import { sendOwnerNotification } from '@/lib/email'

const TABLE = 'hop_improvement_findings'
const DAY_MS = 24 * 60 * 60 * 1000

export interface ImprovementFinding {
  id: string
  fingerprint: string
  kind: string
  severity: string
  title: string
  body: string
  status: 'open' | 'resolved'
  linearIssueId: string | null
  linearIdentifier: string | null
  deliveredVia: string | null
  firstSeenAt: string | null
  lastSeenAt: string | null
  filedAt: string | null
  resolvedAt: string | null
}

interface FindingRow {
  id: string
  fingerprint: string
  kind: string
  severity: string
  title: string
  body: string
  status: string
  linear_issue_id: string | null
  linear_identifier: string | null
  delivered_via: string | null
  first_seen_at: string | null
  last_seen_at: string | null
  filed_at: string | null
  resolved_at: string | null
}

function rowToFinding(row: FindingRow): ImprovementFinding {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    kind: row.kind,
    severity: row.severity,
    title: row.title,
    body: row.body,
    status: row.status === 'resolved' ? 'resolved' : 'open',
    linearIssueId: row.linear_issue_id ?? null,
    linearIdentifier: row.linear_identifier ?? null,
    deliveredVia: row.delivered_via ?? null,
    firstSeenAt: row.first_seen_at ?? null,
    lastSeenAt: row.last_seen_at ?? null,
    filedAt: row.filed_at ?? null,
    resolvedAt: row.resolved_at ?? null,
  }
}

export interface UpsertFindingInput {
  fingerprint: string
  kind: FindingKind
  severity: FindingSeverity
  title: string
  body: string
}

// What happened to the row this run: created (first sighting, or a fresh
// episode after the reopen window), seen (open row, last_seen bumped),
// reopened (resolved within the window, same row + same Linear issue back).
export type UpsertOutcome = 'created' | 'seen' | 'reopened'

export interface UpsertFindingResult {
  finding: ImprovementFinding
  outcome: UpsertOutcome
}

// Idempotent upsert keyed by fingerprint. null = the store degraded (the
// sentinel reports it; nothing is retried within the run — the next daily run
// is the retry).
export async function upsertFinding(input: UpsertFindingInput): Promise<UpsertFindingResult | null> {
  return withDb<UpsertFindingResult | null>(null, async (db) => {
    const now = new Date().toISOString()
    const { data: existing, error } = await db
      .from(TABLE)
      .select('*')
      .eq('fingerprint', input.fingerprint)
      .maybeSingle()
    if (error) return null

    if (!existing) {
      const { data, error: insErr } = await db
        .from(TABLE)
        .insert({
          fingerprint: input.fingerprint,
          kind: input.kind,
          severity: input.severity,
          title: input.title,
          body: input.body,
          status: 'open',
          first_seen_at: now,
          last_seen_at: now,
        })
        .select('*')
        .single()
      if (insErr || !data) return null
      return { finding: rowToFinding(data as FindingRow), outcome: 'created' }
    }

    const row = existing as FindingRow

    // Open re-fire: bump last_seen_at and refresh the rendered numbers (the
    // "52h" in a cron-dead title grows) — never a second row, never a re-file.
    if (row.status !== 'resolved') {
      const { data, error: updErr } = await db
        .from(TABLE)
        .update({ last_seen_at: now, severity: input.severity, title: input.title, body: input.body })
        .eq('id', row.id)
        .select('*')
        .single()
      if (updErr || !data) return null
      return { finding: rowToFinding(data as FindingRow), outcome: 'seen' }
    }

    // Resolved: inside the flap window → reopen the SAME row (filing state
    // kept, so it stays the same Linear issue). Outside → a fresh episode on
    // the same unique row: filing state cleared, so a real regression
    // correctly files a NEW issue.
    const resolvedMs = Date.parse(row.resolved_at ?? '')
    const withinWindow =
      Number.isFinite(resolvedMs) && Date.now() - resolvedMs <= REOPEN_WINDOW_DAYS * DAY_MS
    const patch = withinWindow
      ? {
          status: 'open',
          resolved_at: null,
          last_seen_at: now,
          severity: input.severity,
          title: input.title,
          body: input.body,
        }
      : {
          status: 'open',
          resolved_at: null,
          first_seen_at: now,
          last_seen_at: now,
          filed_at: null,
          linear_issue_id: null,
          linear_identifier: null,
          delivered_via: null,
          severity: input.severity,
          title: input.title,
          body: input.body,
        }
    const { data, error: updErr } = await db
      .from(TABLE)
      .update(patch)
      .eq('id', row.id)
      .select('*')
      .single()
    if (updErr || !data) return null
    return { finding: rowToFinding(data as FindingRow), outcome: withinWindow ? 'reopened' : 'created' }
  })
}

// Mark an OPEN finding resolved. true only when a row actually flipped —
// resolving an already-resolved (or absent) fingerprint is a no-op false.
export async function resolveFinding(fingerprint: string): Promise<boolean> {
  return withDb(false, async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('fingerprint', fingerprint)
      .eq('status', 'open')
      .select('id')
    if (error || !data) return false
    return data.length > 0
  })
}

// Every open finding, oldest first. null = the store degraded (UNKNOWN — the
// digest omits its section; the sentinel skips resolution and filing).
export async function listOpenFindings(): Promise<ImprovementFinding[] | null> {
  return withDb<ImprovementFinding[] | null>(null, async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select('*')
      .eq('status', 'open')
      .order('first_seen_at', { ascending: true })
    if (error || !data) return null
    return (data as FindingRow[]).map(rowToFinding)
  })
}

// One finding by fingerprint — the re-read immediately before a Linear create
// (the primary dedupe). null = absent or degraded.
export async function getFinding(fingerprint: string): Promise<ImprovementFinding | null> {
  return withDb<ImprovementFinding | null>(null, async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select('*')
      .eq('fingerprint', fingerprint)
      .maybeSingle()
    if (error || !data) return null
    return rowToFinding(data as FindingRow)
  })
}

// Stamp a finding as filed (at-most-once per episode: the update is guarded
// on filed_at IS NULL, so a second call is a no-op false).
export async function markFiled(
  id: string,
  opts: { linearIssueId?: string; linearIdentifier?: string; deliveredVia: 'linear' | 'email' },
): Promise<boolean> {
  return withDb(false, async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .update({
        filed_at: new Date().toISOString(),
        delivered_via: opts.deliveredVia,
        linear_issue_id: opts.linearIssueId ?? null,
        linear_identifier: opts.linearIdentifier ?? null,
      })
      .eq('id', id)
      .is('filed_at', null)
      .select('id')
    if (error || !data) return false
    return data.length > 0
  })
}

export interface FiledRecord {
  fingerprint: string
  via: 'linear' | 'email'
  identifier?: string
}

// Deliver up to MAX_ISSUES_PER_RUN unfiled open findings: Linear when
// configured (P1s falling back to the owner email when a create fails), owner
// email for P1s when Linear is unconfigured (detect-and-record mode — non-P1s
// simply stay open for the digest to report). Never throws; the findings
// table is the durable queue, so anything undelivered is retried on the next
// daily run.
export async function fileFindings(candidates: ImprovementFinding[]): Promise<FiledRecord[]> {
  const linearOn = isLinearConfigured()
  const sorted = [...candidates].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'p1' ? -1 : 1
    return (a.firstSeenAt ?? '').localeCompare(b.firstSeenAt ?? '')
  })

  const filed: FiledRecord[] = []
  let attempts = 0
  for (const candidate of sorted) {
    if (attempts >= MAX_ISSUES_PER_RUN) break
    // No Linear → only P1s are deliverable (by owner email). The rest stay
    // open: detection is free, delivery needs a key.
    if (!linearOn && candidate.severity !== 'p1') continue

    // Re-read immediately before filing — the primary dedupe. A crash between
    // create and markFiled is narrowed to one rare, visible duplicate.
    const fresh = await getFinding(candidate.fingerprint)
    if (!fresh || fresh.filedAt || fresh.status !== 'open') continue

    attempts++
    if (linearOn) {
      const res = await fileIssue({ title: fresh.title, body: fresh.body, fingerprint: fresh.fingerprint })
      if (res.ok) {
        await markFiled(fresh.id, {
          linearIssueId: res.issueId,
          linearIdentifier: res.identifier,
          deliveredVia: 'linear',
        })
        filed.push({ fingerprint: fresh.fingerprint, via: 'linear', identifier: res.identifier })
        continue
      }
      // Linear down/misconfigured: only a P1 warrants the email channel; the
      // rest stay open and retry tomorrow.
      if (fresh.severity !== 'p1') continue
    }

    const sent = await sendOwnerNotification(
      fresh.title,
      `${fresh.body}\n\nDelivered by email: Linear is ${linearOn ? 'failing' : 'unconfigured'}.`,
    )
    if (sent.ok) {
      await markFiled(fresh.id, { deliveredVia: 'email' })
      filed.push({ fingerprint: fresh.fingerprint, via: 'email' })
    }
  }
  return filed
}
