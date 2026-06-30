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
// inserts since SQL nulls are distinct). Returns false on a bad sender,
// unconfigured db, or write error — NEVER throws.
export async function createSupportTicket(input: SupportTicketInput): Promise<boolean> {
  return withDb(false, async (db) => {
    const from = normalizeEmail(input?.from)
    if (!from) return false // no sender → not a usable ticket
    const row = {
      message_id: clamp(input?.messageId, MAX_MSGID),
      from_email: from,
      to_email: normalizeEmail(input?.to),
      subject: clamp(input?.subject, MAX_SUBJECT),
      body: clamp(input?.text, MAX_BODY),
      status: 'new',
      received_at: normalizeReceivedAt(input?.receivedAt),
    }
    const { error } = await db
      .from(TABLE)
      .upsert(row, { onConflict: 'message_id', ignoreDuplicates: true })
    return !error
  })
}
