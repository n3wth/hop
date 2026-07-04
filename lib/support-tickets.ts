// Support tickets — inbound emails to support@hop.flights captured for the team.
//
// The Cloudflare Email Routing Worker (support@) POSTs each inbound message to
// /api/support-ingest, which calls this module to persist a ticket. Service-role
// client, server-only; like every owner lib it degrades gracefully via withDb and
// NEVER throws. Idempotent on the email Message-ID so a redelivered email doesn't
// create a duplicate ticket.
//
// SQL (run manually — this code does NOT run DDL):
//   CREATE TABLE public.hop_support_tickets (
//     id          uuid primary key default gen_random_uuid(),
//     message_id  text unique,                -- inbound Message-ID (dedupe; nulls allowed)
//     from_email  text not null,
//     to_email    text,
//     subject     text,
//     body        text,
//     status      text not null default 'new',
//     received_at timestamptz,
//     created_at  timestamptz default now()
//   );
//   ALTER TABLE public.hop_support_tickets ENABLE ROW LEVEL SECURITY;
//   -- service-role bypasses RLS; no anon/auth policy (the team reads server-side).

import { withDb } from '@/lib/supabase-helpers'
import { normalizeEmail } from '@/lib/escalation'

const TABLE = 'hop_support_tickets'

const MAX_SUBJECT = 500
const MAX_BODY = 50_000
const MAX_MSGID = 998 // RFC 5322 line-length ceiling for a Message-ID

export interface SupportTicketInput {
  /** Sender address — required (it's who we reply to). */
  from: string
  /** The address it was sent to (e.g. support@hop.flights). */
  to?: string
  subject?: string
  /** Plain-text body. */
  text?: string
  /** Inbound Message-ID — the idempotency key. */
  messageId?: string
  /** When the message was received (ISO). */
  receivedAt?: string
}

// Trim + cap a free-form string field; returns null when empty/!string.
function clamp(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().slice(0, max)
  return s || null
}

// Coerce an inbound timestamp to an ISO string; null when unparseable. Defensive:
// the Worker passes the received time, but we never trust the shape.
function normalizeReceivedAt(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  if (!t) return null
  const ms = Date.parse(t)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

// Store an inbound support email as a ticket. Validates + clamps. Idempotent on
// message_id (a redelivered email is ignored, not duplicated; a null id always
// inserts since SQL nulls are distinct). Returns the NEW row id on insert, or null
// on a duplicate / bad sender / unconfigured db / write error — NEVER throws. The
// id lets the caller attach an AI draft + owner notification for genuinely-new
// tickets only (a duplicate returns null, so it isn't re-notified).
export async function createSupportTicket(input: SupportTicketInput): Promise<string | null> {
  return withDb<string | null>(null, async (db) => {
    const from = normalizeEmail(input?.from)
    if (!from) return null // no sender → not a usable ticket
    const row = {
      message_id: clamp(input?.messageId, MAX_MSGID),
      from_email: from,
      to_email: normalizeEmail(input?.to),
      subject: clamp(input?.subject, MAX_SUBJECT),
      body: clamp(input?.text, MAX_BODY),
      status: 'new',
      received_at: normalizeReceivedAt(input?.receivedAt),
    }
    const { data, error } = await db
      .from(TABLE)
      .upsert(row, { onConflict: 'message_id', ignoreDuplicates: true })
      .select('id')
      .maybeSingle()
    if (error) return null
    return (data?.id as string | undefined) ?? null // null = duplicate (already stored)
  })
}

// Stamp a ticket with its AI-drafted reply + the time the owner was notified.
// Best-effort; never throws.
export async function recordDraftAndNotified(id: string, draft: string | null): Promise<void> {
  if (!id) return
  await withDb<null>(null, async (db) => {
    await db
      .from(TABLE)
      .update({ draft_reply: draft ?? null, notified_at: new Date().toISOString() })
      .eq('id', id)
    return null
  })
}

// --- Read / reply (the owner-gated admin console) ---------------------------

// A full ticket as the admin console reads it (camelCase, normalized).
export interface SupportTicket {
  id: string
  messageId: string | null
  fromEmail: string
  toEmail: string | null
  subject: string | null
  body: string | null
  status: string
  draftReply: string | null
  notifiedAt: string | null
  replyText: string | null
  repliedAt: string | null
  receivedAt: string | null
  createdAt: string | null
}

interface FullRow {
  id: string
  message_id: string | null
  from_email: string | null
  to_email: string | null
  subject: string | null
  body: string | null
  status: string | null
  draft_reply: string | null
  notified_at: string | null
  reply_text: string | null
  replied_at: string | null
  received_at: string | null
  created_at: string | null
}

const SELECT_COLS =
  'id, message_id, from_email, to_email, subject, body, status, draft_reply, notified_at, reply_text, replied_at, received_at, created_at'

function rowToTicket(row: FullRow): SupportTicket | null {
  const from = normalizeEmail(row.from_email)
  if (!from) return null
  return {
    id: row.id,
    messageId: row.message_id,
    fromEmail: from,
    toEmail: normalizeEmail(row.to_email),
    subject: row.subject,
    body: row.body,
    status: row.status ?? 'new',
    draftReply: row.draft_reply,
    notifiedAt: row.notified_at,
    replyText: row.reply_text,
    repliedAt: row.replied_at,
    receivedAt: row.received_at,
    createdAt: row.created_at,
  }
}

// Recent tickets, newest first (the admin console list). null when the db is
// unconfigured or the read fails ("unknown", so the console can say so); [] only
// when the table is genuinely empty. Mirrors lib/cron-heartbeat.ts#listHeartbeats.
export async function listRecentTickets(limit = 100): Promise<SupportTicket[] | null> {
  return withDb<SupportTicket[] | null>(null, async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select(SELECT_COLS)
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(1, limit), 250))
    if (error || !data) return null
    return (data as FullRow[]).map(rowToTicket).filter((t): t is SupportTicket => t !== null)
  })
}

// A single ticket by id (the send route loads it to address the reply). Null on
// any failure / not found.
export async function getSupportTicket(id: string): Promise<SupportTicket | null> {
  if (!id) return null
  return withDb<SupportTicket | null>(null, async (db) => {
    const { data, error } = await db.from(TABLE).select(SELECT_COLS).eq('id', id).maybeSingle()
    if (error || !data) return null
    return rowToTicket(data as FullRow)
  })
}

// Record that a reply was sent — stamps the text + time and flips status to
// 'replied'. Returns false on failure; never throws.
export async function markReplied(id: string, replyText: string): Promise<boolean> {
  if (!id) return false
  return withDb(false, async (db) => {
    const { error } = await db
      .from(TABLE)
      .update({
        reply_text: replyText.slice(0, MAX_BODY),
        replied_at: new Date().toISOString(),
        status: 'replied',
      })
      .eq('id', id)
    return !error
  })
}

// Lifecycle writes the console can make on the existing status column. 'closed'
// is the one terminal state; 'open' reopens a closed ticket. (Ingest still writes
// 'new' and a sent reply still writes 'replied' — this union is only what the
// owner can set by hand.)
export type TicketLifecycleStatus = 'open' | 'closed'

// Flip a ticket's status ('open' | 'closed'). Returns false on a bad id/status,
// unconfigured db, or write error; NEVER throws.
export async function setTicketStatus(id: string, status: TicketLifecycleStatus): Promise<boolean> {
  if (!id) return false
  if (status !== 'open' && status !== 'closed') return false
  return withDb(false, async (db) => {
    const { error } = await db.from(TABLE).update({ status }).eq('id', id)
    return !error
  })
}
