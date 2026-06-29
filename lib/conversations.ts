// Persistence for the concierge's MULTI-TURN conversation. One thread per user
// (latest wins) stored in hop_conversations as a jsonb array of messages.
// Service-role client, server-only; identity is Auth0, so we scope every query
// by user_id in code. Signed-in users are remembered across visits; signed-out
// users get a session-only thread (the client holds it, nothing is persisted).
// All functions degrade gracefully — they NEVER throw to the page.
//
// SQL (run manually — this code does NOT run DDL): see lib SQL report. Summary:
//
//   CREATE TABLE public.hop_conversations (
//     id          uuid primary key default gen_random_uuid(),
//     user_id     text not null,
//     messages    jsonb not null default '[]'::jsonb,
//     updated_at  timestamptz not null default now()
//   );
//   CREATE UNIQUE INDEX hop_conversations_user_id_key
//     ON public.hop_conversations (user_id);
//   ALTER TABLE public.hop_conversations ENABLE ROW LEVEL SECURITY;
//   -- service-role bypasses RLS; no anon/auth policy (we scope in code).

import { withDb } from '@/lib/supabase-helpers'

// A single chat turn. MINIMAL by design — role + content only, matching the
// Stage-1 streamText message shape. ONLY user/assistant are allowed: the
// concierge builds its OWN system prompt server-side, so a client- or DB-supplied
// 'system' turn could only ever be a prompt-injection vector (it would sit beside
// buildAgenticSystem with conflicting authority and, once persisted, poison every
// future turn). sanitizeMessages therefore drops system turns entirely.
export type ConversationRole = 'user' | 'assistant'

export interface ConversationMessage {
  role: ConversationRole
  content: string
}

const TABLE = 'hop_conversations'

// Cap how much history we keep/thread so the prompt stays bounded. Most recent
// MAX_MESSAGES turns are retained; older turns roll off.
export const MAX_MESSAGES = 40

// Clamp an arbitrary value into a clean ConversationMessage[]. NEVER trusts the
// stored/incoming shape — drops anything without a valid role + string content,
// trims to the most recent MAX_MESSAGES. Pure, total.
export function sanitizeMessages(raw: unknown): ConversationMessage[] {
  if (!Array.isArray(raw)) return []
  const out: ConversationMessage[] = []
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue
    const r = m as Record<string, unknown>
    const role = r.role
    const content = r.content
    // Only user/assistant survive. A 'system' role (or anything else) is dropped
    // so the server-built system prompt is the SOLE source of instructions.
    if (role !== 'user' && role !== 'assistant') continue
    if (typeof content !== 'string') continue
    const trimmed = content.trim()
    if (!trimmed) continue
    out.push({ role, content: trimmed })
  }
  return out.length > MAX_MESSAGES ? out.slice(out.length - MAX_MESSAGES) : out
}

// Load the user's persisted thread. Returns [] when there's no row, no client,
// or any error — the concierge then starts fresh.
export async function getConversation(userId: string): Promise<ConversationMessage[]> {
  return withDb<ConversationMessage[]>([], async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select('messages')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return []
    return sanitizeMessages(data.messages)
  })
}

// Persist the user's thread (sanitized/capped first). Latest wins (upsert on
// user_id). Returns false on any failure — never throws.
export async function saveConversation(
  userId: string,
  messages: ConversationMessage[],
): Promise<boolean> {
  return withDb(false, async (db) => {
    const clean = sanitizeMessages(messages)
    const { error } = await db.from(TABLE).upsert(
      {
        user_id: userId,
        // ConversationMessage[] is plain JSON-serializable; the jsonb column
        // types as a Json index signature our interface doesn't carry, so map
        // each turn through a fresh object literal to satisfy the Json type.
        messages: clean.map((m) => ({ role: m.role, content: m.content })),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    return !error
  })
}

// Clear the user's thread (user-initiated "start over"). Returns false on any
// failure — never throws.
export async function clearConversation(userId: string): Promise<boolean> {
  return withDb(false, async (db) => {
    const { error } = await db.from(TABLE).delete().eq('user_id', userId)
    return !error
  })
}
