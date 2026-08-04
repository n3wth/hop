// INFERRED facts — the "hop noticed …" layer. hop watches how a traveler chats
// and, when the signal is strong, proposes a durable preference it INFERRED (a
// cabin lean, who they travel with, places they gravitate toward or away from).
// Unlike save_profile_fact (which records what the user STATED), nothing here is
// ever auto-applied: each inference lands as a confidence-scored PENDING row the
// user confirms (→ promoted into their stated travel_profile) or dismisses
// (→ rejected, never re-suggested). That's what keeps a "growing" memory
// trustworthy — hop's guesses are always visible and reversible in the glass box.
//
// INVARIANTS:
//   - NO economics. hop only infers human preferences; it never records a
//     price/miles/cpp/verdict. The extraction prompt forbids it and the validator
//     only admits the four allowed kinds.
//   - Sensitive fields are STATED-ONLY. dietary + accessibility are never inferred
//     (medical/personal — a wrong guess there is worse than none); only cabin,
//     travelParty, lovedDestinations, avoidedDestinations are inferable.
//   - Graceful + gated. Every DB path is withDb (never throws); extraction is
//     best-effort via callGateway (null on any failure). isInferredFactsEnabled()
//     gates read + write, so it ships dark until the table + flag are set.
//   - user_id-scoped. Every query filters by the Auth0 sub; a confirm/dismiss is
//     re-scoped to the caller's own row.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { withDb } from '@/lib/supabase-helpers'
import { callGateway } from '@/lib/ai-gateway'
import { isInferredFactsEnabled } from '@/lib/env'
import { getProfile, saveProfileFact } from '@/lib/travel-profile'
import { CABINS } from '@/lib/prefs-model'
import { TRAVEL_PARTIES, type TravelProfile } from '@/lib/travel-profile-model'
import type { ConversationMessage } from '@/lib/conversations'

const TABLE = 'hop_inferred_facts'

// The ONLY kinds hop may infer. Sensitive fields (dietary/accessibility) and
// scalars hop shouldn't guess (vacationDays) are deliberately excluded.
export const INFERRABLE_KINDS = [
  'cabin',
  'travelParty',
  'lovedDestinations',
  'avoidedDestinations',
] as const
export type InferredFactKind = (typeof INFERRABLE_KINDS)[number]

export type InferredFactStatus = 'pending' | 'confirmed' | 'rejected'

export interface InferredFact {
  id: string
  kind: InferredFactKind
  value: string
  confidence: number
}

// Only propose when we're genuinely confident; cap how many we add per turn so a
// single chatty session can't flood the glass box. Only the most recent slice of
// the thread is scanned (fresh signal), bounded for cost.
const MIN_CONFIDENCE = 0.65
const MAX_PER_RUN = 3
const RECENT_WINDOW = 24
const MAX_VALUE = 60

function isInferrableKind(k: unknown): k is InferredFactKind {
  return typeof k === 'string' && (INFERRABLE_KINDS as readonly string[]).includes(k)
}

// Clamp a raw candidate to a valid, high-confidence inference — or null. Pure.
// cabin/travelParty must be real enum members; loved/avoided are cleaned place
// strings. Confidence must be a number in (0,1] and clear MIN_CONFIDENCE.
export function validateCandidate(raw: unknown): { kind: InferredFactKind; value: string; confidence: number } | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!isInferrableKind(r.kind)) return null
  const conf = typeof r.confidence === 'number' ? r.confidence : Number(r.confidence)
  if (!Number.isFinite(conf) || conf < MIN_CONFIDENCE || conf > 1) return null
  if (typeof r.value !== 'string') return null
  const raw_value = r.value.trim().slice(0, MAX_VALUE)
  if (!raw_value) return null

  if (r.kind === 'cabin') {
    const c = raw_value.toLowerCase()
    if (!(CABINS as readonly string[]).includes(c)) return null
    return { kind: 'cabin', value: c, confidence: conf }
  }
  if (r.kind === 'travelParty') {
    const p = raw_value.toLowerCase()
    if (!(TRAVEL_PARTIES as readonly string[]).includes(p)) return null
    return { kind: 'travelParty', value: p, confidence: conf }
  }
  // loved / avoided destinations: a cleaned free-text place name.
  return { kind: r.kind, value: raw_value, confidence: conf }
}

// Which (kind,value) pairs the user ALREADY knows about — so we never re-propose
// a stated fact or something already inferred (any status). Pure. Values compared
// case-insensitively; scalars (cabin/party) are "known" once set at all.
export function alreadyKnown(
  profile: TravelProfile,
  existing: { kind: string; value: string }[],
): (c: { kind: InferredFactKind; value: string }) => boolean {
  const seen = new Set(existing.map((e) => `${e.kind}:${e.value.trim().toLowerCase()}`))
  return (c) => {
    if (c.kind === 'cabin' && profile.cabin) return true
    if (c.kind === 'travelParty' && profile.travelParty) return true
    if (c.kind === 'lovedDestinations') {
      if ((profile.lovedDestinations ?? []).some((v) => v.toLowerCase() === c.value.toLowerCase())) return true
    }
    if (c.kind === 'avoidedDestinations') {
      if ((profile.avoidedDestinations ?? []).some((v) => v.toLowerCase() === c.value.toLowerCase())) return true
    }
    return seen.has(`${c.kind}:${c.value.toLowerCase()}`)
  }
}

function cleanThread(thread: ConversationMessage[] | undefined): ConversationMessage[] {
  if (!Array.isArray(thread)) return []
  const out: ConversationMessage[] = []
  for (const m of thread) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue
    if (typeof m.content !== 'string' || !m.content.trim()) continue
    out.push({ role: m.role, content: m.content.trim() })
  }
  return out
}

// Read the user's PENDING inferred facts for the glass box. [] when off / no table
// / error — so it no-ops until the migration + flag are in place.
export async function listPendingInferredFacts(userId: string): Promise<InferredFact[]> {
  if (!isInferredFactsEnabled()) return []
  return withDb<InferredFact[]>([], async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select('id, kind, value, confidence')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('confidence', { ascending: false })
    if (error || !data) return []
    return data
      .filter((r: any): r is typeof r & { kind: InferredFactKind } => isInferrableKind(r.kind))
      .map((r: any) => ({
        id: String(r.id),
        kind: r.kind,
        value: String(r.value),
        confidence: typeof r.confidence === 'number' ? r.confidence : Number(r.confidence) || 0,
      }))
  })
}

// All (kind,value) rows for a user, any status — used to dedupe proposals. [] on
// any failure.
async function existingPairs(userId: string): Promise<{ kind: string; value: string }[]> {
  return withDb<{ kind: string; value: string }[]>([], async (db) => {
    const { data, error } = await db.from(TABLE).select('kind, value').eq('user_id', userId)
    if (error || !data) return []
    return data.map((r: any) => ({ kind: String(r.kind), value: String(r.value) }))
  })
}

const EXTRACT_SYSTEM = [
  "You infer DURABLE travel preferences a traveler reveals through how they chat with hop's concierge.",
  'Return STRICT JSON: {"facts":[{"kind","value","confidence"}]}. Nothing else.',
  'kind is EXACTLY one of: "cabin", "travelParty", "lovedDestinations", "avoidedDestinations".',
  'value: for cabin one of economy|premium|business|first; for travelParty one of solo|couple|family|group;',
  'for lovedDestinations/avoidedDestinations a single place name (city or country).',
  'confidence: 0-1, how strongly the CONVERSATION evidences this as a durable preference.',
  'ONLY include a fact when the signal is strong and repeated — a genuine pattern, not a one-off mention.',
  'Do NOT infer dietary or accessibility needs, and NEVER infer or output any price, miles, cents-per-point, or economic figure.',
  'If nothing is strongly evidenced, return {"facts":[]}. Infer sparingly — a wrong guess erodes trust.',
].join(' ')

// Propose new inferred facts from the conversation. Fire-and-forget, gated,
// best-effort — NEVER throws. Extracts candidates via the gateway (clamped by
// validateCandidate), drops anything already known/stated/proposed, and inserts
// up to MAX_PER_RUN fresh PENDING rows. `thread` is the full conversation.
export async function proposeInferredFacts(
  userId: string | undefined,
  thread: ConversationMessage[] | undefined,
): Promise<void> {
  if (!userId || !isInferredFactsEnabled()) return
  const clean = cleanThread(thread)
  if (clean.length < 4) return // too little to infer a durable pattern
  const recent = clean.slice(-RECENT_WINDOW)
  try {
    const transcript = recent
      .map((m) => `${m.role === 'user' ? 'Traveler' : 'hop'}: ${m.content}`)
      .join('\n')
    const candidates = await callGateway<{ kind: InferredFactKind; value: string; confidence: number }[]>({
      system: EXTRACT_SYSTEM,
      user: `Conversation:\n${transcript}\n\nInferred durable preferences as JSON:`,
      maxTokens: 400,
      validate: (parsed) => {
        const facts = (parsed as { facts?: unknown })?.facts
        if (!Array.isArray(facts)) return null
        const out = facts.map(validateCandidate).filter((c): c is NonNullable<typeof c> => c !== null)
        return out.length ? out : null
      },
    })
    if (!candidates || candidates.length === 0) return

    const [profile, existing] = await Promise.all([getProfile(userId), existingPairs(userId)])
    const known = alreadyKnown(profile, existing)
    // De-dupe within this batch too (same kind+value twice).
    const batchSeen = new Set<string>()
    const fresh = candidates.filter((c) => {
      const key = `${c.kind}:${c.value.toLowerCase()}`
      if (batchSeen.has(key) || known(c)) return false
      batchSeen.add(key)
      return true
    }).slice(0, MAX_PER_RUN)
    if (fresh.length === 0) return

    await withDb(false, async (db) => {
      const now = new Date().toISOString()
      const { error } = await db.from(TABLE).upsert(
        fresh.map((c) => ({
          user_id: userId,
          kind: c.kind,
          value: c.value,
          confidence: String(c.confidence),
          status: 'pending',
          created_at: now,
          updated_at: now,
        })),
        { onConflict: 'user_id,kind,value', ignoreDuplicates: true },
      )
      return !error
    })
  } catch (err) {
    console.error('[inferred-facts] propose failed', err)
  }
}

// Map a confirmed inference onto a stated-profile patch (validated by saveProfileFact).
function toProfilePatch(kind: InferredFactKind, value: string): TravelProfile {
  switch (kind) {
    case 'cabin':
      return { cabin: value as TravelProfile['cabin'] }
    case 'travelParty':
      return { travelParty: value as TravelProfile['travelParty'] }
    case 'lovedDestinations':
      return { lovedDestinations: [value] }
    case 'avoidedDestinations':
      return { avoidedDestinations: [value] }
  }
}

export interface InferredActionResult {
  ok: boolean
}

// Confirm an inference: promote it into the stated travel_profile (via
// saveProfileFact's validate+merge) and mark the row confirmed. Scoped to the
// caller's own row. Best-effort; { ok:false } on any miss.
export async function confirmInferredFact(userId: string, id: string): Promise<InferredActionResult> {
  if (!isInferredFactsEnabled()) return { ok: false }
  const row = await withDb<{ kind: InferredFactKind; value: string } | null>(null, async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select('kind, value')
      .eq('user_id', userId)
      .eq('id', id)
      .eq('status', 'pending')
      .maybeSingle()
    if (error || !data || !isInferrableKind(data.kind)) return null
    return { kind: data.kind, value: String(data.value) }
  })
  if (!row) return { ok: false }

  await saveProfileFact(userId, toProfilePatch(row.kind, row.value))
  const ok = await setStatus(userId, id, 'confirmed')
  return { ok }
}

// Dismiss an inference: mark it rejected so it's never re-proposed. Scoped.
export async function dismissInferredFact(userId: string, id: string): Promise<InferredActionResult> {
  if (!isInferredFactsEnabled()) return { ok: false }
  const ok = await setStatus(userId, id, 'rejected')
  return { ok }
}

async function setStatus(userId: string, id: string, status: InferredFactStatus): Promise<boolean> {
  return withDb(false, async (db) => {
    const { error } = await db
      .from(TABLE)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('id', id)
    return !error
  })
}
