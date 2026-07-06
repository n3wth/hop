// Verdict receipts — the engine-side seam for /v/[id] share pages (R1.5,
// docs/plans/2026-07-02-viral-differentiation.md, N-309).
//
// A receipt is a PROJECTION of a fresh, balance-free, prefs-free
// assembleSearch() run — never a re-derivation of its economics, and never
// anything a client can forge: validateShareParams strict-rejects malformed
// input (never default-fills, unlike app/search/page.tsx#parseParams), and
// buildVerdictSnapshot only mints from a clean, non-degraded result. The
// VerdictSnapshot type below structurally cannot carry balances, identity, or
// a bookable action — it copies named fields only, never spreads a
// FlightOption (which is where youHave/action/bookingUrl live).
//
// NO LLM anywhere in this seam: every number here is copied, not generated.

import { createHash, randomBytes } from 'node:crypto'
import type { CppTier, FlightOption, SearchParams, SearchResult } from '@/lib/types'
import { airportByCode } from '@/lib/airports'
import { isValidISO, todayISO } from '@/lib/travel-dates'
import { assembleSearch } from '@/lib/search'
import { checkRateLimit } from '@/lib/rate-limit'
import { isShareReceiptsEnabled } from '@/lib/env'
import { withDb } from '@/lib/supabase-helpers'

const TABLE = 'hop_shared_verdicts'
const CABINS = ['economy', 'premium', 'business', 'first'] as const
const TIERS = ['green', 'amber', 'muted'] as const
const KINDS = ['cash', 'award', 'transfer'] as const

// ── The public artifact's shape — structurally balance-/action-free ────────

// A display-only projection of one FlightOption. Deliberately NOT a subtype
// of FlightOption and NEVER built via `{...option}`: the omitted keys
// (youHave, action, bookingUrl, id, note, transferFrom, …) are the whole
// privacy boundary. Adding a field here requires a conscious choice.
export interface VerdictSnapshotOption {
  kind: FlightOption['kind']
  airline: string
  program?: string
  cabin?: string
  miles?: number
  taxes?: number
  cashPrice?: number
  cpp?: number
  tier: CppTier
}

export interface VerdictSnapshot {
  route: string // "SFO → NRT"
  from: string
  to: string
  depart: string
  return?: string
  adults: number
  cabin?: SearchParams['cabin']
  verdict: 'use-points' | 'pay-cash' // 'none' is filtered out by the mint gate
  summary: SearchResult['summary']
  pick: VerdictSnapshotOption
  cashOption?: VerdictSnapshotOption
  asOf: string // ISO timestamp — "Priced <date>" on the card
}

function projectOption(o: FlightOption): VerdictSnapshotOption {
  return {
    kind: o.kind,
    airline: o.airline,
    program: o.program,
    cabin: o.cabin,
    miles: o.miles,
    taxes: o.taxes,
    cashPrice: o.cashPrice,
    cpp: o.cpp,
    tier: o.tier,
  }
}

// Pure projection off a fresh SearchResult — computes nothing. Returns null
// when the result isn't receipt-grade: this is the STRICT degraded gate (no
// pay-cash-while-awards-dark carve-out — a public artifact must never risk
// publishing a wrong verdict).
export function buildVerdictSnapshot(result: SearchResult): VerdictSnapshot | null {
  if (result.degraded.length > 0) return null
  if (result.verdict === 'none') return null
  if (!result.pick) return null
  if (result.summary.cheapestCash == null) return null

  return {
    route: `${result.params.from} → ${result.params.to}`,
    from: result.params.from,
    to: result.params.to,
    depart: result.params.depart,
    return: result.params.return,
    adults: result.params.adults,
    cabin: result.params.cabin,
    verdict: result.verdict,
    summary: result.summary,
    pick: projectOption(result.pick),
    cashOption: result.cashOption ? projectOption(result.cashOption) : undefined,
    asOf: new Date().toISOString(),
  }
}

// ── Strict param validation — rejects, never default-fills ─────────────────

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

// The share action's ENTIRE client-facing input surface. Unlike
// app/search/page.tsx#parseParams (which defaults a bad query to SFO→LAX so a
// page always renders), this REJECTS anything malformed — a receipt must
// either be for the exact trip requested, or not exist. A hostile/garbage
// payload returns null, never a plausible-looking substitute.
export function validateShareParams(
  raw: Record<string, string | string[] | undefined>,
): SearchParams | null {
  const from = str(raw.from)?.toUpperCase()
  const to = str(raw.to)?.toUpperCase()
  if (!from || !to) return null
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) return null
  if (!airportByCode(from) || !airportByCode(to)) return null
  if (to === from) return null

  const departRaw = str(raw.depart)
  if (!isValidISO(departRaw) || departRaw < todayISO()) return null

  let ret: string | undefined
  const returnRaw = str(raw.return)
  if (returnRaw !== undefined && returnRaw !== '') {
    if (!isValidISO(returnRaw) || returnRaw < departRaw) return null
    ret = returnRaw
  }

  let cabin: SearchParams['cabin']
  const cabinRaw = str(raw.cabin)
  if (cabinRaw !== undefined && cabinRaw !== '') {
    if (!(CABINS as readonly string[]).includes(cabinRaw)) return null
    cabin = cabinRaw as SearchParams['cabin']
  }

  let adults = 1
  const adultsRaw = str(raw.adults)
  if (adultsRaw !== undefined && adultsRaw !== '') {
    const n = Number(adultsRaw)
    if (!Number.isInteger(n) || n < 1 || n > 9) return null
    adults = n
  }

  let children: number | undefined
  const childrenRaw = str(raw.children)
  if (childrenRaw !== undefined && childrenRaw !== '') {
    const n = Number(childrenRaw)
    if (!Number.isInteger(n) || n < 0 || n > 8) return null
    if (n > 0) children = n
  }

  let infants: number | undefined
  const infantsRaw = str(raw.infants)
  if (infantsRaw !== undefined && infantsRaw !== '') {
    const n = Number(infantsRaw)
    if (!Number.isInteger(n) || n < 0 || n > 8) return null
    if (n > 0) infants = n
  }

  return {
    from,
    to,
    depart: departRaw,
    ...(ret ? { return: ret } : {}),
    adults,
    ...(children ? { children } : {}),
    ...(infants ? { infants } : {}),
    ...(cabin ? { cabin } : {}),
  }
}

// ── Ids + idempotency ────────────────────────────────────────────────────

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567' // 32 symbols; 256 % 32 === 0 (unbiased)

// 12-char base32 slug (~60 bits) from crypto.randomBytes. Unguessable — the
// payload is also harmless if enumerated (F2/F7 in the plan's failure catalog).
export function newReceiptId(): string {
  const bytes = randomBytes(12)
  let id = ''
  for (let i = 0; i < 12; i++) id += BASE32[bytes[i] % 32]
  return id
}

// Idempotency key: canonical trip params + the UTC calendar day. Fixed key
// order (never the input object's own order) so it's insertion-order
// independent; same trip on the same UTC day always hashes identically.
export function verdictContentHash(params: SearchParams, dayISO: string): string {
  const canonical = JSON.stringify({
    from: params.from,
    to: params.to,
    depart: params.depart,
    return: params.return ?? null,
    adults: params.adults,
    children: params.children ?? 0,
    infants: params.infants ?? 0,
    cabin: params.cabin ?? null,
    day: dayISO,
  })
  return createHash('sha256').update(canonical).digest('hex')
}

// ── Read-side validation — a bad row can never render NaN¢/pt ──────────────

function validateOption(raw: unknown): VerdictSnapshotOption | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!(KINDS as readonly string[]).includes(o.kind as string)) return null
  if (typeof o.airline !== 'string' || o.airline === '') return null
  if (!(TIERS as readonly string[]).includes(o.tier as string)) return null
  const num = (v: unknown): number | undefined => {
    if (v === undefined) return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  for (const key of ['miles', 'taxes', 'cashPrice', 'cpp']) {
    if (o[key] !== undefined && num(o[key]) === undefined) return null
  }
  return {
    kind: o.kind as FlightOption['kind'],
    airline: o.airline,
    program: typeof o.program === 'string' ? o.program : undefined,
    cabin: typeof o.cabin === 'string' ? o.cabin : undefined,
    miles: num(o.miles),
    taxes: num(o.taxes),
    cashPrice: num(o.cashPrice),
    cpp: num(o.cpp),
    tier: o.tier as CppTier,
  }
}

// Validates a stored snapshot JSON blob before it can render — every required
// field type-checked, numbers Number.isFinite-checked (the
// lib/valuation-overrides.ts#rowToOverride pattern). Invalid → null → the
// caller 404s rather than ever rendering a malformed card.
export function validateSnapshot(raw: unknown): VerdictSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  if (typeof s.route !== 'string' || typeof s.from !== 'string' || typeof s.to !== 'string')
    return null
  if (typeof s.depart !== 'string') return null
  if (s.return !== undefined && typeof s.return !== 'string') return null
  if (typeof s.adults !== 'number' || !Number.isFinite(s.adults)) return null
  if (s.cabin !== undefined && !(CABINS as readonly string[]).includes(s.cabin as string))
    return null
  if (s.verdict !== 'use-points' && s.verdict !== 'pay-cash') return null
  if (typeof s.asOf !== 'string') return null
  if (!s.summary || typeof s.summary !== 'object') return null
  const summaryRaw = s.summary as Record<string, unknown>
  const summary: SearchResult['summary'] = {}
  for (const key of ['cheapestCash', 'bestMiles', 'bestCpp', 'saveVsCash'] as const) {
    const v = summaryRaw[key]
    if (v === undefined) continue
    const n = Number(v)
    if (!Number.isFinite(n)) return null
    summary[key] = n
  }
  const pick = validateOption(s.pick)
  if (!pick) return null
  const cashOption = s.cashOption !== undefined ? validateOption(s.cashOption) : undefined
  if (s.cashOption !== undefined && !cashOption) return null

  return {
    route: s.route,
    from: s.from,
    to: s.to,
    depart: s.depart,
    return: s.return as string | undefined,
    adults: s.adults,
    cabin: s.cabin as SearchParams['cabin'] | undefined,
    verdict: s.verdict,
    summary,
    pick,
    cashOption: cashOption ?? undefined,
    asOf: s.asOf,
  }
}

// ── Persistence — withDb-wrapped, never throws ──────────────────────────────

interface SharedVerdictRow {
  id: string
  snapshot: unknown
  revoked: boolean
}

// Read-side validation entry point: a stored row → VerdictSnapshot, or null
// for anything malformed/legacy (never NaN on the rendered card).
export function rowToSnapshot(row: Pick<SharedVerdictRow, 'snapshot'>): VerdictSnapshot | null {
  return validateSnapshot(row.snapshot)
}

export type CreateSharedVerdictReason = 'unavailable'

// Insert (or, on the same-trip-same-day idempotency key, re-select) a shared
// verdict row. NEVER throws — a missing/unconfigured table degrades to
// {ok:false,'unavailable'}.
export async function createSharedVerdict(input: {
  params: SearchParams
  snapshot: VerdictSnapshot
  createdBy: string | null
}): Promise<{ ok: true; id: string } | { ok: false; reason: CreateSharedVerdictReason }> {
  const day = new Date().toISOString().slice(0, 10)
  const contentHash = verdictContentHash(input.params, day)
  return withDb<{ ok: true; id: string } | { ok: false; reason: CreateSharedVerdictReason }>(
    { ok: false, reason: 'unavailable' },
    async (db) => {
      const id = newReceiptId()
      const { data, error } = await db
        .from(TABLE)
        .upsert(
          {
            id,
            content_hash: contentHash,
            created_by: input.createdBy,
            params: input.params,
            snapshot: input.snapshot,
          },
          { onConflict: 'content_hash', ignoreDuplicates: true },
        )
        .select('id')
        .maybeSingle()
      if (error) return { ok: false, reason: 'unavailable' }
      if (data && typeof data.id === 'string') return { ok: true, id: data.id }

      // Conflict: a row for this exact trip + UTC day already exists — reuse
      // it (the reason repeat shares/double-clicks never re-bill upstream).
      const existing = await db.from(TABLE).select('id').eq('content_hash', contentHash).maybeSingle()
      if (existing.error || !existing.data || typeof existing.data.id !== 'string') {
        return { ok: false, reason: 'unavailable' }
      }
      return { ok: true, id: existing.data.id as string }
    },
  )
}

// Fetch a receipt for /v/[id] + its OG image. Revoked or missing rows read as
// null (treated as missing everywhere) — the caller 404s. Never throws.
export async function getSharedVerdict(id: string): Promise<VerdictSnapshot | null> {
  return withDb<VerdictSnapshot | null>(null, async (db) => {
    const { data, error } = await db.from(TABLE).select('snapshot, revoked').eq('id', id).maybeSingle()
    if (error || !data || data.revoked) return null
    return rowToSnapshot({ snapshot: data.snapshot })
  })
}

// ── Orchestration — gate → rate-limit → validate → mint. Node-testable: the
// caller resolves the rate-limit key and the signed-in user id (both need
// next/headers, unavailable outside a request) and passes them in as plain
// values, so this whole flow can be exercised without a request context. ────

export type ShareVerdictReason = 'disabled' | 'invalid' | 'rate-limited' | 'degraded' | 'unavailable'

const SHARE_RATE_LIMIT = { capacity: 5, refillPerSec: 0.05 }

export async function shareVerdict(input: {
  raw: Record<string, string | string[] | undefined>
  rateLimitKey: string
  createdBy: string | null
}): Promise<{ ok: true; id: string } | { ok: false; reason: ShareVerdictReason }> {
  if (!isShareReceiptsEnabled()) return { ok: false, reason: 'disabled' }

  const rl = await checkRateLimit(input.rateLimitKey, SHARE_RATE_LIMIT)
  if (!rl.ok) return { ok: false, reason: 'rate-limited' }

  const params = validateShareParams(input.raw)
  if (!params) return { ok: false, reason: 'invalid' }

  // Balance-free, prefs-free — the receipt is the market math, timestamped,
  // never a personalized view (see docs/plans/2026-07-02-viral-
  // differentiation.md §8 for why this is a deliberate, non-obvious choice).
  // `[]` (not undefined): assembleSearch treats undefined as "no balances
  // supplied" and falls back to a LIVE getBalances() call against the
  // operator's own AwardWallet link (lib/search.ts's wantBalances check) —
  // an anonymous share action must never depend on or trigger that.
  const result = await assembleSearch(params, [], undefined)
  const snapshot = buildVerdictSnapshot(result)
  if (!snapshot) return { ok: false, reason: 'degraded' }

  const created = await createSharedVerdict({ params, snapshot, createdBy: input.createdBy })
  if (!created.ok) return { ok: false, reason: 'unavailable' }
  return { ok: true, id: created.id }
}
