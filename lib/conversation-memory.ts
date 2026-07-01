// Durable conversation MEMORY for the concierge. The live thread caps at 40 turns
// (lib/conversations.ts) — anything older scrolls off and a resumed thread turns
// amnesiac. This keeps ONE rolling summary per user of those older turns, folded
// in fire-and-forget after a turn, and read back into the agent's system prompt
// so hop remembers "you were weighing Lisbon vs Tokyo, fly business" a month later.
//
// INVARIANTS:
//   - NO economics. The summary captures durable HUMAN context (places discussed,
//     trip intent, preferences, decisions) and is explicitly told to never record
//     a price/miles/cpp/verdict — the engine computes every number live, so a
//     number here would be stale + misleading. It is CONTEXT for prose, never a
//     source of truth for figures.
//   - Graceful. Every DB path is withDb (returns fallback, never throws). The
//     summarize call is best-effort inside try/catch. A missing table → '' read
//     and a no-op write, so this ships dark until the migration is run.
//   - Gated. isConversationMemoryEnabled() (flag + gateway key) gates BOTH the
//     read into the prompt and the write, so production is unchanged until opted in.

import { generateText, gateway } from 'ai'
import { withDb } from '@/lib/supabase-helpers'
import { isConversationMemoryEnabled } from '@/lib/env'
import { GATEWAY_MODEL } from '@/lib/ai-gateway'
import type { ConversationMessage } from '@/lib/conversations'

const TABLE = 'hop_conversation_summary'

// How long a thread must get before it's worth summarizing (short threads fit in
// the live window whole). RETAIN = recent turns still shown live; everything OLDER
// is folded into the summary. SOURCE_CAP bounds the summarizer input; the summary
// itself is length-capped so the prompt stays cheap.
export const SUMMARIZE_AFTER = 24
export const RETAIN = 16
export const SOURCE_CAP = 160
const MAX_SUMMARY_CHARS = 1400

// Keep only well-formed user/assistant turns (client input is untrusted).
function cleanThread(thread: ConversationMessage[] | undefined): ConversationMessage[] {
  if (!Array.isArray(thread)) return []
  const out: ConversationMessage[] = []
  for (const m of thread) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue
    if (typeof m.content !== 'string') continue
    const content = m.content.trim()
    if (content) out.push({ role: m.role, content })
  }
  return out
}

// The older turns worth condensing: everything past the retained live window,
// capped so the summarizer input stays bounded. Pure + total.
export function olderTurns(thread: ConversationMessage[]): ConversationMessage[] {
  const clean = cleanThread(thread)
  if (clean.length <= SUMMARIZE_AFTER) return []
  const older = clean.slice(0, Math.max(0, clean.length - RETAIN))
  return older.length > SOURCE_CAP ? older.slice(older.length - SOURCE_CAP) : older
}

// Read the stored summary. '' on miss / no table / error — so it no-ops until the
// hop_conversation_summary table exists.
export async function getConversationSummary(userId: string): Promise<string> {
  return withDb('', async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select('summary')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return ''
    return typeof data.summary === 'string' ? data.summary.trim() : ''
  })
}

// Gated read for the agent prompt — '' when the feature is off (also avoids a DB
// round-trip on every concierge request while the seam is dark).
export async function getConversationMemory(userId: string): Promise<string> {
  if (!isConversationMemoryEnabled()) return ''
  return getConversationSummary(userId)
}

async function setConversationSummary(userId: string, summary: string): Promise<boolean> {
  return withDb(false, async (db) => {
    const { error } = await db.from(TABLE).upsert(
      {
        user_id: userId,
        summary: summary.slice(0, MAX_SUMMARY_CHARS),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    return !error
  })
}

// Deterministic defense-in-depth: strip figure-shaped tokens from the summary
// before it's stored, so the "no economics in memory" invariant is CODE-enforced,
// not merely prompt-enforced (the summarizer may be a cheaper, weaker model set
// via AI_GATEWAY_SUMMARY_MODEL). The summarizer is ALSO told to omit numbers; this
// guarantees the outcome — a stale price/miles/cpp can never be persisted into the
// prompt, matching the house rule that every number is COMPUTED live, never stored.
// Pure + total.
export function scrubEconomics(text: string): string {
  return text
    // $1,234 / $ 420.50 → cash
    .replace(/\$\s?\d[\d,]*(?:\.\d+)?/g, 'the cash price')
    // 3.1cpp / 2.5 cents per point / 3 ¢/pt → good value
    .replace(
      /\b\d+(?:\.\d+)?\s?(?:cpp|¢\s?\/?\s?pt?|cents?\s?[-\s]?per[-\s]?point)\b/gi,
      'good value',
    )
    // 45k miles / 40,000 points / 12k pts → some miles/points
    .replace(/\b\d[\d,]*\.?\d*\s?k?\s?(?:miles?|mi|points?|pts?)\b/gi, 'some miles')
}

const SUMMARY_SYSTEM = [
  "You maintain a hop travel-concierge's durable memory of ONE traveler.",
  'Rewrite the running memory so it captures what still MATTERS for future help:',
  'places discussed or planned, trip intent and rough timing, stated preferences',
  'and constraints, and decisions reached. Keep it a tight bulleted note (max 12',
  'short bullets). Write in the third person ("the traveler ...").',
  'NEVER include prices, miles, cents-per-point, fares, award availability, or any',
  'economic figure — hop computes those live every time, so a number here would be',
  'stale and misleading. No preamble; output only the note.',
].join(' ')

// Fold the older turns (with any prior summary) into a fresh durable summary.
// Fire-and-forget, gated, best-effort — NEVER throws to the caller. `thread` is
// the FULL conversation (the client resends its whole prior thread each turn), so
// this is lossless even past the 40-turn live cap.
export async function updateConversationMemory(
  userId: string | undefined,
  thread: ConversationMessage[] | undefined,
): Promise<void> {
  if (!userId || !isConversationMemoryEnabled()) return
  const older = olderTurns(thread ?? [])
  if (older.length === 0) return
  try {
    const prior = await getConversationSummary(userId)
    const transcript = older
      .map((m) => `${m.role === 'user' ? 'Traveler' : 'hop'}: ${m.content}`)
      .join('\n')
    const { text } = await generateText({
      model: gateway(process.env.AI_GATEWAY_SUMMARY_MODEL || GATEWAY_MODEL),
      system: SUMMARY_SYSTEM,
      prompt: `Running memory so far:\n${prior || '(none yet)'}\n\nNewer conversation to fold in:\n${transcript}\n\nUpdated memory note:`,
    })
    // Scrub any figure-shaped token the summarizer let slip (defense-in-depth).
    const summary = scrubEconomics((text ?? '').trim())
    if (summary) await setConversationSummary(userId, summary)
  } catch (err) {
    // Best-effort: a failed summarize just leaves the prior summary in place. Log
    // a breadcrumb so a persistently-failing fold is diagnosable once enabled.
    console.error('[convo-memory] summarize failed', err)
  }
}
