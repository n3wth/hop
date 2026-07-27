// Owner-drafted sweet-spot entries — the HITL pipeline that adds new rows to
// the /sweet-spots SEO guide without a code deploy. THESIS ALIGNMENT: facts
// (route, program, cabin, miles) are always typed in by the owner; the AI
// call (draftSweetSpotWhy) only ever writes the prose "why" line, grounded in
// the facts it's given. It never originates or alters a number — mirrors
// lib/support-reply.ts's contract exactly.
//
// Lifecycle: pending_review (owner drafted it, not yet live) → approved (live,
// merged into lib/sweet-spots.ts's getSweetSpotsByProgram/getProgramBySlug) or
// rejected (discarded, kept for the record). approved can be flipped back to
// pending_review to pull an entry down without deleting it.
//
// Single-owner tool (see lib/owner.ts) — every mutator here is called from an
// owner-gated server action (app/actions/admin.ts); this module does no
// auth itself, only persistence + the drafting call. NEVER throws — every
// function degrades via withDb or a null gateway response.
//
// SQL (run manually — this code does NOT run DDL). CREATE TABLE lives in
// drizzle/0004_flat_gorgon.sql, generated from lib/db/schema.ts#sweetSpotDrafts:
//
//   CREATE TABLE public.hop_sweet_spot_drafts (
//     id            uuid primary key default gen_random_uuid(),
//     seq           serial not null,        -- derives SweetSpot#id, see toSweetSpot
//     route         text not null,
//     program       text not null,
//     program_slug  text not null,          -- must match an existing lib/sweet-spots.ts program
//     metal         text,
//     cabin         text not null,          -- 'Economy' | 'Business' | 'First'
//     miles_ow      integer,
//     miles_label   text not null,
//     why           text not null default '',
//     confidence    text not null default 'med',   -- 'high' | 'med'
//     status        text not null default 'pending_review',
//     created_by    text not null,          -- owner email
//     created_at    timestamptz default now(),
//     reviewed_at   timestamptz
//   );
//   ALTER TABLE public.hop_sweet_spot_drafts ENABLE ROW LEVEL SECURITY;
//   -- service-role bypasses RLS; single-owner tool, no per-user scoping.

import { withDb } from '@/lib/supabase-helpers'
import { callGatewayText } from '@/lib/ai-gateway'
import { allPrograms, sweetSpotsByProgram, type Cabin, type Confidence, type SweetSpot } from '@/lib/sweet-spots'

const TABLE = 'hop_sweet_spot_drafts'

// Numeric SweetSpot#id space reserved for draft-sourced rows — comfortably
// above the static table's small hand-assigned integers (currently 1-16).
const ID_OFFSET = 100_000

const MAX_TEXT = 400
const MAX_WHY = 1000

export const DRAFT_STATUSES = ['pending_review', 'approved', 'rejected'] as const
export type DraftStatus = (typeof DRAFT_STATUSES)[number]

const CABINS: readonly Cabin[] = ['Economy', 'Business', 'First']

export interface SweetSpotDraft {
  id: string
  seq: number
  route: string
  program: string
  programSlug: string
  metal: string | null
  cabin: Cabin
  milesOw: number | null
  milesLabel: string
  why: string
  confidence: Confidence
  status: DraftStatus
  createdBy: string
  createdAt?: string
  reviewedAt?: string | null
}

// New-draft input — the facts the owner types in. `programSlug` must name an
// existing program (lib/sweet-spots.ts#allPrograms) so the merged entry always
// lands on a page that's already statically generated; see lib/sweet-spots.ts
// for why new programs aren't supported by this flow.
export interface SweetSpotDraftInput {
  route: string
  programSlug: string
  metal?: string
  cabin: string
  milesOw?: number
  milesLabel: string
  confidence?: string
  /** The "why" line, if already drafted/edited by the time the row is saved. */
  why?: string
  createdBy: string
}

interface DraftRow {
  id: string
  seq: number
  route: string | null
  program: string | null
  program_slug: string | null
  metal: string | null
  cabin: string | null
  miles_ow: number | null
  miles_label: string | null
  why: string | null
  confidence: string | null
  status: string | null
  created_by: string | null
  created_at: string | null
  reviewed_at: string | null
}

function clampText(raw: unknown, max = MAX_TEXT): string {
  return typeof raw === 'string' ? raw.trim().slice(0, max) : ''
}

function rowToDraft(row: DraftRow): SweetSpotDraft | null {
  const route = clampText(row.route)
  const program = clampText(row.program)
  const programSlug = clampText(row.program_slug)
  const milesLabel = clampText(row.miles_label)
  const cabin = CABINS.includes(row.cabin as Cabin) ? (row.cabin as Cabin) : null
  if (!route || !program || !programSlug || !milesLabel || !cabin) return null
  return {
    id: row.id,
    seq: row.seq,
    route,
    program,
    programSlug,
    metal: row.metal?.trim() || null,
    cabin,
    milesOw: typeof row.miles_ow === 'number' ? row.miles_ow : null,
    milesLabel,
    why: row.why ?? '',
    confidence: row.confidence === 'high' ? 'high' : 'med',
    status: DRAFT_STATUSES.includes(row.status as DraftStatus) ? (row.status as DraftStatus) : 'pending_review',
    createdBy: row.created_by ?? '',
    createdAt: row.created_at ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
  }
}

const SELECT_COLS =
  'id, seq, route, program, program_slug, metal, cabin, miles_ow, miles_label, why, confidence, status, created_by, created_at, reviewed_at'

// Store a new draft in 'pending_review'. Rejects an unknown programSlug (must
// already have a page) or an invalid cabin. Returns the new row id, or null on
// any validation/db failure. NEVER throws.
export async function createSweetSpotDraft(input: SweetSpotDraftInput): Promise<string | null> {
  const route = clampText(input?.route)
  const programSlug = clampText(input?.programSlug)
  const milesLabel = clampText(input?.milesLabel)
  const createdBy = clampText(input?.createdBy, 200)
  const cabin = input?.cabin as Cabin
  if (!route || !milesLabel || !createdBy) return null
  if (!CABINS.includes(cabin)) return null
  const known = sweetSpotsByProgram().find((p) => p.slug === programSlug)
  if (!known) return null // programSlug must already exist — see module doc
  const confidence: Confidence = input?.confidence === 'high' ? 'high' : 'med'
  const milesOw =
    typeof input?.milesOw === 'number' && Number.isFinite(input.milesOw) && input.milesOw > 0
      ? Math.round(input.milesOw)
      : null

  return withDb<string | null>(null, async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .insert({
        route,
        program: known.name,
        program_slug: programSlug,
        metal: clampText(input.metal) || null,
        cabin,
        miles_ow: milesOw,
        miles_label: milesLabel,
        why: clampText(input.why, MAX_WHY),
        confidence,
        status: 'pending_review',
        created_by: createdBy,
      })
      .select('id')
      .maybeSingle()
    if (error || !data) return null
    return (data.id as string) ?? null
  })
}

// All drafts, newest first; optionally filtered to one status. null when the db
// read failed/unconfigured (distinct from a genuinely empty queue). NEVER throws.
export async function listSweetSpotDrafts(status?: DraftStatus): Promise<SweetSpotDraft[] | null> {
  return withDb<SweetSpotDraft[] | null>(null, async (db) => {
    let query = db.from(TABLE).select(SELECT_COLS).order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error || !data) return null
    return (data as DraftRow[]).map(rowToDraft).filter((d): d is SweetSpotDraft => d !== null)
  })
}

// Replace a pending draft's `why` copy (agent-drafted or owner-edited).
// Returns false on a bad id/empty text/db failure. NEVER throws.
export async function updateSweetSpotDraftWhy(id: string, why: string): Promise<boolean> {
  if (!id) return false
  const text = clampText(why, MAX_WHY)
  if (!text) return false
  return withDb(false, async (db) => {
    const { error } = await db.from(TABLE).update({ why: text }).eq('id', id)
    return !error
  })
}

// Flip a draft's status (approve / reject / pull an approved entry back to
// pending_review). Stamps reviewed_at. Returns false on a bad id/status or db
// failure. NEVER throws. The caller (app/actions/admin.ts) is responsible for
// revalidating the affected /sweet-spots paths after a status change.
export async function setSweetSpotDraftStatus(id: string, status: DraftStatus): Promise<boolean> {
  if (!id) return false
  if (!DRAFT_STATUSES.includes(status)) return false
  return withDb(false, async (db) => {
    const { error } = await db
      .from(TABLE)
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id)
    return !error
  })
}

function toSweetSpot(d: SweetSpotDraft): SweetSpot {
  return {
    id: ID_OFFSET + d.seq,
    route: d.route,
    program: d.program,
    programSlug: d.programSlug,
    metal: d.metal ?? undefined,
    cabin: d.cabin,
    milesOW: d.milesOw ?? undefined,
    milesLabel: d.milesLabel,
    why: d.why,
    confidence: d.confidence,
  }
}

// Approved drafts, shaped as SweetSpot rows ready to merge into the static
// table. [] on empty or db failure — a down db just means the live pages fall
// back to the static seed set. NEVER throws.
export async function getApprovedDraftSpots(): Promise<SweetSpot[]> {
  const drafts = await listSweetSpotDrafts('approved')
  if (!drafts) return []
  return drafts.filter((d) => d.why.trim().length > 0).map(toSweetSpot)
}

// Program slug + display name pairs the owner can attach a new draft to —
// exactly the static table's existing programs (see module doc: this flow
// never creates a brand-new program page). Pure, no I/O.
export function draftableProgramOptions(): { slug: string; name: string }[] {
  return allPrograms().map((slug) => {
    const p = sweetSpotsByProgram().find((x) => x.slug === slug)!
    return { slug, name: p.name }
  })
}

// hop's UI copy voice, restated for the drafting prompt — keep in sync with
// docs/design/copy-spec.md (terse, confident, plain, no marketing slop).
//
// ENGINE INVARIANT: this prompt must never ask the model to produce a cpp or
// cash figure — the model is never given a cash price, so "estimate the cpp"
// would just mean fabricating one (a real P1 caught in review: the previous
// wording asked for "the rough cents-per-point or cash comparison" despite
// facts never including a price). Any such number must instead be supplied by
// the human as a context note and only ever restated verbatim, never computed.
// Exported (not just module-private) so tests can assert on the invariant
// directly — see lib/__tests__/sweet-spot-drafts.test.ts.
export const SWEET_SPOT_WHY_SYSTEM_PROMPT = [
  "You are hop's content assistant, drafting the one-line \"why it's a deal\" copy for an award " +
    'sweet-spot guide entry. hop is a points-vs-cash flight optimizer.',
  "Write in hop's voice: terse, confident, plain. No marketing language, no clichés, no emoji.",
  'HARD RULES:',
  '- You are given the facts (route, program, cabin, miles) and optional context notes. NEVER ' +
    'invent, change, compute, or estimate a number, route, program, or cabin — use only what you ' +
    'are given.',
  '- A cents-per-point or cash-price figure may appear in your output ONLY if it is already ' +
    'written verbatim in the context notes below — restate it exactly, never calculate or guess ' +
    'one yourself. If no such figure is given, describe the value qualitatively (fees, scarcity, ' +
    'stopovers) using only the facts and notes provided — do not add a number to fill the gap.',
  '- One or two short sentences, plain prose, no markdown, no bullet points.',
  '- A human reviews every word before this goes live — if you are unsure, write a plainer, ' +
    'more conservative line rather than an embellished one.',
  '- Output ONLY the why line — no preamble, no quotes, no "Why:" label.',
].join('\n')

// Draft the "why" copy for a sweet-spot entry, grounded ONLY in the given
// facts + notes. `notes` is the human's own free-text context (e.g. a cash
// price, fee policy, or award-space scarcity) — the only channel through
// which a number can reach the drafted copy; the model is never asked to
// originate one. Returns the drafted text, or null when the gateway is
// unconfigured / the call fails / the reply is empty. NEVER throws — the
// owner can always type the line by hand instead.
export async function draftSweetSpotWhy(facts: {
  route: string
  program: string
  metal?: string
  cabin: string
  milesLabel: string
  milesOw?: number
  notes?: string
}): Promise<string | null> {
  const route = clampText(facts?.route)
  const program = clampText(facts?.program)
  const milesLabel = clampText(facts?.milesLabel)
  const cabin = clampText(facts?.cabin)
  if (!route || !program || !milesLabel || !cabin) return null
  const metal = clampText(facts?.metal)
  const milesOw = typeof facts?.milesOw === 'number' && Number.isFinite(facts.milesOw) ? facts.milesOw : null
  const notes = clampText(facts?.notes, MAX_WHY)

  const user = [
    `Route: ${route}`,
    `Program (book with): ${program}`,
    metal ? `Operating metal: ${metal}` : null,
    `Cabin: ${cabin}`,
    `Miles one-way: ${milesLabel}${milesOw ? ` (~${milesOw})` : ''}`,
    notes
      ? `Context notes (human-supplied — any number here may be restated verbatim; never compute a new one): ${notes}`
      : 'Context notes: (none given — describe the value qualitatively, do not add a number)',
    '',
    'Write the why line only.',
  ]
    .filter(Boolean)
    .join('\n')

  const text = await callGatewayText({ system: SWEET_SPOT_WHY_SYSTEM_PROMPT, user, maxTokens: 200 })
  return text ? text.slice(0, MAX_WHY) : null
}
