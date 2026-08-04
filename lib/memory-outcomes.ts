// OBSERVED outcomes — the "hop learned from what you DO" layer (M4). hop watches
// discrete, EXPLICIT signals a traveler gives through the product (today: a
// verdict card they dismiss with "Not for me") and folds RECURRING ones into
// human "hop observed …" rows in the glass box + a soft CONTEXT block in the
// concierge prompt. It closes the compounding loop: M3 notices what you say, M4
// grades hop against what you do.
//
// INVARIANTS:
//   - NO economics, and DETERMINISTIC. There is no LLM here — the aggregator is
//     pure code, and the table has no price/miles/cpp column by design. An
//     observation shapes PROSE + ordering only; it never asserts a number and
//     never changes a verdict or a stated fact.
//   - Never a one-off. A subject surfaces only after it RECURS (>= MIN_PATTERN),
//     so a single dismissal is never treated as a durable preference — the
//     roadmap's "never a one-off" guardrail, enforced in code.
//   - Graceful + gated. Every DB path is withDb (returns a fallback, never
//     throws). isObservedOutcomesEnabled() gates BOTH record + read, so the seam
//     ships dark until the table + flag are in place (append/read no-op until then).
//   - user_id-scoped. Every query filters by the Auth0 sub; a record is only ever
//     written for the acting user.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { withDb } from '@/lib/supabase-helpers'
import { isObservedOutcomesEnabled } from '@/lib/env'

const TABLE = 'hop_memory_outcomes'

// The discrete outcomes hop may record. An allowlist so a bad kind can never
// land; extensible for the later action outcomes (M6/M7: 'added_to_calendar',
// 'started_watch').
export const OUTCOME_KINDS = ['dismissed_verdict'] as const
export type OutcomeKind = (typeof OUTCOME_KINDS)[number]

// A raw event to record. `subject` is the human place label the user saw (city,
// falling back to an IATA code); `cabin` is optional context.
export interface OutcomeEvent {
  kind: OutcomeKind
  subject: string
  cabin?: string
}

// A derived, human-readable observation for the glass box. No economics.
export interface Observation {
  id: string
  text: string
}

// A raw row shape the aggregator consumes (kept loose — the DB may hand back
// strings/nulls; the aggregator is defensive).
interface OutcomeRow {
  kind: string
  subject: string
  cabin?: string | null
}

const MAX_SUBJECT = 48
// Surface a subject only once it recurs — a single dismissal is noise, not a
// pattern. Two-plus is a signal.
const MIN_PATTERN = 2
const MAX_OBSERVATIONS = 4
// Bound the read so a chatty account can't blow up the aggregate.
const READ_LIMIT = 200

function isOutcomeKind(k: unknown): k is OutcomeKind {
  return typeof k === 'string' && (OUTCOME_KINDS as readonly string[]).includes(k)
}

// Clean a subject to a bounded, trimmed label — or null if unusable. Pure.
export function normalizeSubject(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().slice(0, MAX_SUBJECT)
  return s || null
}

// The pure core: recurring dismissed subjects (>= MIN_PATTERN), most-frequent
// first, case-insensitively grouped. Shared by the glass-box rows and the prompt
// block so the two never drift. Pure + total: garbage rows are skipped.
export function recurringDismissed(rows: OutcomeRow[]): { subject: string; count: number }[] {
  const counts = new Map<string, { subject: string; count: number }>()
  for (const r of rows) {
    if (!r || r.kind !== 'dismissed_verdict') continue
    const subject = normalizeSubject(r.subject)
    if (!subject) continue
    const key = subject.toLowerCase()
    const cur = counts.get(key)
    if (cur) cur.count += 1
    else counts.set(key, { subject, count: 1 })
  }
  return [...counts.values()]
    .filter((c) => c.count >= MIN_PATTERN)
    .sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject))
}

// Fold raw rows into human "hop observed …" rows for the glass box. Pure + total.
export function deriveObservations(rows: OutcomeRow[]): Observation[] {
  return recurringDismissed(rows)
    .slice(0, MAX_OBSERVATIONS)
    .map(({ subject, count }) => ({
      id: `dismissed:${subject.toLowerCase()}`,
      text:
        count > 2
          ? `You've set aside ${subject} a few times — hop keeps it out of the way unless you ask.`
          : `You've passed on ${subject} more than once — hop keeps it out of the way unless you ask.`,
    }))
}

// Record one outcome. Gated, withDb, best-effort — NEVER throws. No-ops when
// signed out (no userId), the seam is off, or the kind/subject is invalid.
export async function recordOutcome(
  userId: string | undefined,
  event: OutcomeEvent,
): Promise<boolean> {
  if (!userId || !isObservedOutcomesEnabled()) return false
  if (!event || !isOutcomeKind(event.kind)) return false
  const subject = normalizeSubject(event.subject)
  if (!subject) return false
  const cabin = normalizeSubject(event.cabin)
  return withDb(false, async (db) => {
    const { error } = await db.from(TABLE).insert({
      user_id: userId,
      kind: event.kind,
      subject,
      cabin,
      created_at: new Date().toISOString(),
    })
    return !error
  })
}

// Read a user's recent raw outcome rows. [] when off / no table / error — so it
// no-ops until the migration + flag are in place.
async function readOutcomes(userId: string): Promise<OutcomeRow[]> {
  return withDb<OutcomeRow[]>([], async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select('kind, subject, cabin')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(READ_LIMIT)
    if (error || !data) return []
    return data.map((r: any) => ({
      kind: String(r.kind),
      subject: String(r.subject),
      cabin: r.cabin == null ? null : String(r.cabin),
    }))
  })
}

// The glass-box observations for a user. [] when the seam is off (also avoids a
// DB round-trip while dark). Gated read.
export async function listObservations(userId: string): Promise<Observation[]> {
  if (!isObservedOutcomesEnabled()) return []
  return deriveObservations(await readOutcomes(userId))
}

// A soft CONTEXT block for the concierge system prompt — the places the traveler
// has repeatedly set aside, so hop stops leading with them. '' when off / none,
// mirroring getConversationMemory. Model-facing phrasing (not the glass-box copy).
export async function getObservedContext(userId: string): Promise<string> {
  if (!isObservedOutcomesEnabled()) return ''
  const recurring = recurringDismissed(await readOutcomes(userId))
  if (!recurring.length) return ''
  return recurring
    .slice(0, MAX_OBSERVATIONS)
    .map((c) => c.subject)
    .join(', ')
}
