// Balance sync — the AwardWallet-independent syncing seam (see
// docs/plans/2026-07-05-balance-sync.md). Turns text the user already has (a
// statement email, an account-page copy) into hop_manual_balances rows through
// ONE extraction + clamp pipeline shared by the paste route and the email rail.
//
// Extraction follows the NL-translator shape (lib/ai-gateway.ts): a cheap
// gateway model translates freeform text into strict JSON, then EVERY entry is
// clamped deterministically before it can touch the DB — and a balance is only
// accepted when its digits literally appear in the source text
// (balanceAppearsInText). The model can transcribe a number the user gave us;
// it can never invent one. No key / failed call → a pure regex fallback parser.
// NEVER throws anywhere on this path.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { callGateway } from '@/lib/ai-gateway'
import { canonicalizeProgram, PROGRAMS } from '@/lib/programs'
import { deriveCode } from '@/lib/awardwallet'
import {
  addManualBalance,
  findManualByProgram,
  updateManualBalance,
} from '@/lib/accounts'

// Cheap translator model — extraction is transcription, not judgment. Override
// with HOP_BALANCE_SYNC_MODEL (same pattern as ai-gateway's GATEWAY_MODEL).
const BALANCE_SYNC_MODEL = process.env.HOP_BALANCE_SYNC_MODEL || 'anthropic/claude-haiku-4-5'

// Input/output bounds. A statement email fits well under the cap; anything
// bigger is truncated, not rejected (a missed tail balance is fine).
export const MAX_SYNC_TEXT_CHARS = 20_000
const MAX_ENTRIES = 25
const MAX_BALANCE = 50_000_000

export interface ExtractedBalance {
  // Canonical display name when the program resolves in lib/programs, else the
  // sanitized free text (same contract as a manual add).
  program: string
  code: string
  balance: number
  // True when the program resolved to a canonical registry identity.
  canonical: boolean
}

export interface ExtractionResult {
  balances: ExtractedBalance[]
  // Which path produced the entries — surfaced in the preview so copy can stay
  // honest about a degraded (regex-only) read.
  source: 'ai' | 'parsed'
}

// --- Clamp helpers (pure) ----------------------------------------------------

// Every distinct digit-run in the text, punctuation-stripped ("45,230" → 45230).
// A candidate balance must be one of these — the transcription check.
export function textNumberSet(text: string): Set<string> {
  const out = new Set<string>()
  for (const token of text.match(/\d[\d,.\s]*\d|\d/g) ?? []) {
    const digits = token.replace(/\D/g, '')
    if (digits) out.add(digits.replace(/^0+(?=\d)/, ''))
  }
  return out
}

export function balanceAppearsInText(balance: number, numbers: Set<string>): boolean {
  return numbers.has(String(balance))
}

// Sanitize a model/user-supplied program string: printable, single-spaced,
// length-bounded. Returns null when nothing usable remains.
function sanitizeProgram(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const cleaned = raw.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim()
  if (cleaned.length < 2 || cleaned.length > 60) return null
  return cleaned
}

// Clamp one candidate entry against the source text. Null on ANY doubt — a
// missed balance is fine, a wrong one is not.
function clampEntry(
  entry: { program?: unknown; balance?: unknown },
  numbers: Set<string>,
): ExtractedBalance | null {
  const program = sanitizeProgram(entry.program)
  if (!program) return null
  const n =
    typeof entry.balance === 'number'
      ? entry.balance
      : typeof entry.balance === 'string'
        ? parseFloat(entry.balance.replace(/[^0-9.]/g, ''))
        : NaN
  if (!Number.isFinite(n)) return null
  const balance = Math.round(n)
  if (balance < 0 || balance > MAX_BALANCE) return null
  if (!balanceAppearsInText(balance, numbers)) return null
  const def = canonicalizeProgram(program)
  return {
    program: def ? def.name : program,
    code: def ? def.code : deriveCode(program),
    balance,
    canonical: Boolean(def),
  }
}

// De-dupe by program code (the same merge identity lib/accounts uses), keeping
// the first occurrence, capped at MAX_ENTRIES.
function dedupe(entries: ExtractedBalance[]): ExtractedBalance[] {
  const byCode = new Map<string, ExtractedBalance>()
  for (const e of entries) {
    const key = e.code.toUpperCase()
    if (!byCode.has(key)) byCode.set(key, e)
    if (byCode.size >= MAX_ENTRIES) break
  }
  return [...byCode.values()]
}

// The validator handed to callGateway — maps raw model JSON onto clamped
// entries, or null when nothing survives (→ deterministic fallback).
export function validateExtracted(parsed: unknown, text: string): ExtractedBalance[] | null {
  if (!parsed || typeof parsed !== 'object') return null
  const list = (parsed as { balances?: unknown }).balances
  if (!Array.isArray(list)) return null
  const numbers = textNumberSet(text)
  const clamped = list
    .slice(0, MAX_ENTRIES * 2)
    .map((e) => (e && typeof e === 'object' ? clampEntry(e as Record<string, unknown>, numbers) : null))
    .filter((e): e is ExtractedBalance => e !== null)
  const out = dedupe(clamped)
  return out.length > 0 ? out : null
}

// --- Deterministic fallback parser (pure) ------------------------------------

// Number tokens that plausibly read as a points balance on a statement line:
// comma-grouped, or a bare run of 3+ digits. Bare 4-digit year-looking tokens
// (19xx/20xx) are skipped — "Statement date: 2026" is not a balance.
const NUMBER_TOKEN_RE = /\d{1,3}(?:,\d{3})+|\d{3,9}/g

function lineNumbers(line: string): number[] {
  const out: number[] = []
  for (const token of line.match(NUMBER_TOKEN_RE) ?? []) {
    const n = parseInt(token.replace(/,/g, ''), 10)
    if (!Number.isFinite(n) || n > MAX_BALANCE) continue
    if (!token.includes(',') && /^(19|20)\d{2}$/.test(token)) continue
    out.push(n)
  }
  return out
}

const BALANCE_WORDS_RE = /\b(miles|points|pts|avios|balance|available)\b/i

// Match known programs (canonical names + aliases ≥4 chars — short aliases
// like "mr"/"ua" false-positive on prose) against each line and pair them with
// a number on the same line — or, when the program line itself has none, with
// a balance-keyword line within the next two lines (statement emails often put
// the program name and the number on separate lines). Conservative: ambiguous
// lines are skipped.
export function parseBalancesDeterministic(text: string): ExtractedBalance[] {
  const found: ExtractedBalance[] = []
  const numbers = textNumberSet(text)
  // A program named without a number, still eligible to pair for `ttl` lines.
  let pending: { def: (typeof PROGRAMS)[number]; ttl: number } | null = null
  for (const rawLine of text.slice(0, MAX_SYNC_TEXT_CHARS).split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const lower = line.toLowerCase()
    const def = PROGRAMS.find(
      (p) =>
        lower.includes(p.name.toLowerCase()) ||
        p.aliases.some((a) => a.length >= 4 && new RegExp(`\\b${escapeRe(a)}\\b`).test(lower)),
    )
    const nums = lineNumbers(line)
    // A line's number is used only when it's unambiguous: exactly one candidate,
    // or a balance keyword confirms the line is about points.
    const balance =
      nums.length === 1 ? nums[0] : nums.length > 1 && BALANCE_WORDS_RE.test(line) ? Math.max(...nums) : null
    const usable = balance !== null && balanceAppearsInText(balance, numbers) ? balance : null

    if (def) {
      if (usable !== null) {
        found.push({ program: def.name, code: def.code, balance: usable, canonical: true })
        pending = null
      } else {
        // Program named, no number here — allow a short look-ahead.
        pending = { def, ttl: 2 }
      }
      continue
    }
    if (pending && usable !== null && BALANCE_WORDS_RE.test(line)) {
      found.push({ program: pending.def.name, code: pending.def.code, balance: usable, canonical: true })
      pending = null
      continue
    }
    if (pending && --pending.ttl <= 0) pending = null
  }
  return dedupe(found)
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// --- Extraction entrypoint ---------------------------------------------------

const SYSTEM_PROMPT = `You extract loyalty-program point/mile balances from text a traveler pasted or forwarded (statement emails, account pages).
Return ONLY a JSON object: {"balances":[{"program":"<program name>","balance":<integer>}]}.
Rules:
- Only include CURRENT redeemable point/mile balances that appear verbatim in the text. Never estimate, never sum, never convert.
- Copy each balance's digits exactly as written (drop separators). Skip earned/spent line items, elite-qualifying counters, and dollar amounts.
- Use the program's common name (e.g. "United MileagePlus", "Amex Membership Rewards").
- No balances found → {"balances":[]}.`

// Extract balances from freeform text: gateway translator first (when a key is
// configured), pure regex parser otherwise. Truncates oversized input. NEVER
// throws; an empty list is a valid outcome.
export async function extractBalances(text: string): Promise<ExtractionResult> {
  const input = text.slice(0, MAX_SYNC_TEXT_CHARS)
  const ai = await callGateway<ExtractedBalance[]>({
    system: SYSTEM_PROMPT,
    user: input,
    model: BALANCE_SYNC_MODEL,
    maxTokens: 1200,
    validate: (parsed) => validateExtracted(parsed, input),
  })
  if (ai) return { balances: ai, source: 'ai' }
  return { balances: parseBalancesDeterministic(input), source: 'parsed' }
}

// --- Apply -------------------------------------------------------------------

export interface ApplyResult {
  added: number
  updated: number
  unchanged: number
  failed: number
}

// Upsert extracted balances through the existing manual-balances helpers, so a
// synced row IS a manual row: editable in ProgramsManager, merged by
// getUserBalances, dedupe by canonical program identity. Re-applying the same
// text is naturally idempotent. Never throws (the helpers never do).
export async function applyExtractedBalances(
  userId: string,
  balances: ExtractedBalance[],
): Promise<ApplyResult> {
  const result: ApplyResult = { added: 0, updated: 0, unchanged: 0, failed: 0 }
  for (const b of balances.slice(0, MAX_ENTRIES)) {
    const existing = await findManualByProgram(userId, b.program)
    if (existing) {
      if (Number(existing.balance) === b.balance) {
        result.unchanged++
      } else if (await updateManualBalance(userId, existing.id, { balance: b.balance })) {
        result.updated++
      } else {
        result.failed++
      }
    } else if (await addManualBalance(userId, b.program, b.balance)) {
      result.added++
    } else {
      result.failed++
    }
  }
  return result
}

// --- Personal sync address ---------------------------------------------------
// The email rail's capability: sync+<userId>.<sig>@<domain>, where sig is an
// HMAC over the userId keyed on the app's auth secret. Resolution verifies the
// signature instead of trusting the (spoofable) From: header, and needs no DB
// scan. A mangled/forged address fails closed to null.

const SIG_HEX_CHARS = 12

// Domain the Email Worker receives on. Display-only default; the Worker's
// routing rule is the real source of truth.
export function syncEmailDomain(): string {
  return process.env.HOP_BALANCE_SYNC_DOMAIN?.trim() || 'hop.flights'
}

function signSyncUserId(userId: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`hop-balance-sync:${userId}`)
    .digest('hex')
    .slice(0, SIG_HEX_CHARS)
}

// The signed-in user's personal forwarding address, or null when no auth
// secret is available (fail closed — never mint an unverifiable address).
export function makeSyncAddress(userId: string, secret: string | null): string | null {
  if (!secret || !userId) return null
  return `sync+${userId}.${signSyncUserId(userId, secret)}@${syncEmailDomain()}`
}

// Resolve a To: address back to a userId — HMAC must verify. Case-sensitive on
// the userId by design: a mail hop that case-mangles the local part breaks the
// signature and the mail is dropped, never mis-attributed.
export function resolveSyncAddress(to: string, secret: string | null): string | null {
  if (!secret || typeof to !== 'string') return null
  const m = to.trim().match(/<([^>]+)>/)
  const addr = (m ? m[1] : to).trim()
  const at = addr.indexOf('@')
  if (at <= 0) return null
  const local = addr.slice(0, at)
  if (!local.startsWith('sync+')) return null
  const payload = local.slice('sync+'.length)
  const dot = payload.lastIndexOf('.')
  if (dot <= 0) return null
  const userId = payload.slice(0, dot)
  const sig = payload.slice(dot + 1)
  if (sig.length !== SIG_HEX_CHARS) return null
  const expected = Buffer.from(signSyncUserId(userId, secret))
  const provided = Buffer.from(sig)
  if (provided.length !== expected.length) return null
  return timingSafeEqual(provided, expected) ? userId : null
}
