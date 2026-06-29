// Dynamic point valuations — the deterministic backbone hop reasons with when it
// decides "points or cash", how much a balance is really worth, and whether a
// trip is a good redemption. Pure (no JSX, no top-level I/O) so the baseline
// table + clamping are fully unit-testable; the OPTIONAL ai-refresh path is the
// only async, network-touching function and it NEVER throws.
//
// THESIS ALIGNMENT (non-negotiable): the LLM never ORIGINATES economics. The
// baseline table below is the source of truth — published community valuations,
// hand-curated. valueOfPoints() and programValue() are pure arithmetic over it.
// refreshValuationsViaAI() lets the model SUGGEST fresher baselines, but every
// number it returns is clamped to a sane range (0.5–5.0 cpp) and any program it
// can't price falls back to the hardcoded baseline. A wrong number is fatal to
// the moat, so AI augments — it never replaces — the deterministic table.
//
// Keyed by lib/programs.ts canonical ids (the program-registry agent's slugs).

import { PROGRAMS, programById, type ProgramDef } from '@/lib/programs'

// --- Baseline table ---------------------------------------------------------
// Cents per point/mile. Grounded in published 2025–2026 community valuations
// (primarily The Points Guy's June 2026 monthly valuations, cross-checked with
// NerdWallet and Upgraded Points). These are TYPICAL achievable values via a
// good transfer/redemption — not floor (cash-out) nor ceiling (outsized) values.
// Sources are reported alongside this module; refresh quarterly.
//
// Every canonical program id in lib/programs.ts MUST have an entry here — the
// test suite asserts full coverage so a new program can never be silently
// unpriced (which would make valueOfPoints() fall back to GENERIC_BASELINE).
const BASELINE_CPP: Record<string, number> = {
  // Transferable bank currencies — assume transfer to a strong airline/hotel partner.
  'amex-mr': 2.0,
  'chase-ur': 2.05,
  'citi-typ': 1.9,
  'capital-one': 1.85,
  bilt: 2.2,

  // Airlines
  united: 1.35,
  delta: 1.2,
  american: 1.6,
  alaska: 1.4,
  southwest: 1.25,
  jetblue: 1.35,
  aeroplan: 1.4,
  'avios-ba': 1.4,
  'virgin-atlantic': 1.3,
  'flying-blue': 1.3,
  ana: 1.4,
  krisflyer: 1.3,
  emirates: 1.2,
  lifemiles: 1.4,
  qatar: 1.4,
  etihad: 1.2,
  qantas: 1.3,
  cathay: 1.3,
  turkish: 1.1,

  // Hotels
  hyatt: 1.55,
  marriott: 0.8,
  hilton: 0.35,
  ihg: 0.55,
}

// Fallback for a program id we don't recognize at all. A deliberately
// conservative ~1 cpp (a typical bank-points cash-out floor) so an unknown
// currency never overstates a balance's worth.
export const GENERIC_BASELINE = 1.0

// Sane clamp for ANY dynamically-sourced value (the AI refresh path). No real
// loyalty currency sits outside this band; clamping makes a hallucinated 50cpp
// or a 0cpp impossible to leak into the engine.
export const MIN_CPP = 0.5
export const MAX_CPP = 5.0

// Source attribution for the baseline table (reported, surfaced in UI if needed).
export const VALUATION_SOURCES = [
  'The Points Guy — Monthly points & miles valuations (June 2026)',
  'NerdWallet — How Much Are Travel Points and Miles Worth (2026)',
  'Upgraded Points — Travel Points and Miles Valuations (June 2026)',
] as const

// The live table. Starts as the hardcoded baseline; refreshValuationsViaAI() may
// overwrite individual entries in-process (clamped). Never reassigned to a
// non-baseline-backed object, so a missing key always falls through to baseline.
const liveCpp: Record<string, number> = { ...BASELINE_CPP }

// --- Helpers ----------------------------------------------------------------

// Clamp an arbitrary number to the sane cpp band. NaN/Infinity/garbage -> null,
// so callers can fall back to the baseline rather than trust a bad value.
export function clampCpp(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < MIN_CPP) return MIN_CPP
  if (value > MAX_CPP) return MAX_CPP
  // round to 2 decimals — cpp is never meaningfully more precise than 0.01.
  return Math.round(value * 100) / 100
}

// --- Public API -------------------------------------------------------------

// Baseline (or live, if AI-refreshed) cents-per-point for a canonical program id.
// Unknown ids degrade to GENERIC_BASELINE — never undefined, never a throw — so
// the caller always gets a usable number.
export function programValue(programId: string): number {
  return liveCpp[programId] ?? BASELINE_CPP[programId] ?? GENERIC_BASELINE
}

// Dollar value of a points balance: points * cpp / 100. Non-positive or invalid
// point counts return 0. Pure arithmetic over programValue() — the only place
// hop converts "a balance" into "money", and it never invents a rate.
export function valueOfPoints(programId: string, points: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0
  const cpp = programValue(programId)
  return Math.round(points * cpp) / 100
}

// The full baseline table (defensive copy) for menus, seeding, and the concierge
// prompt. Maps canonical id -> baseline cpp.
export function listValuations(): Record<string, number> {
  return { ...liveCpp }
}

// Baseline cpp keyed by canonical PROGRAM NAME (e.g. "Amex Membership Rewards").
// Convenience for the concierge prompt, which reasons in human program names.
export function valuationsByName(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of PROGRAMS) out[p.name] = programValue(p.id)
  return out
}

// --- OPTIONAL AI refresh -----------------------------------------------------
// Asks the configured model (same AI Gateway / key pattern as app/api/concierge)
// to estimate CURRENT baseline cpp for every program, returns structured JSON.
// AUGMENTATION ONLY: each returned value is clamped to [MIN_CPP, MAX_CPP]; any
// program the model omits or prices insanely keeps its hardcoded baseline. When
// AI is unavailable or fails, returns the hardcoded baseline unchanged. NEVER
// throws — a failed refresh is a non-event, the engine keeps its sane numbers.

export interface RefreshResult {
  // The resolved table after merging clamped AI values over the baseline.
  valuations: Record<string, number>
  // 'ai' when at least one value came from the model; 'baseline' otherwise.
  source: 'ai' | 'baseline'
  // ids whose value was updated by the (clamped) AI response.
  updated: string[]
  // human-readable note (e.g. why it fell back) — never an exception.
  note?: string
}

// Build the system+user prompt for the refresh. Pure, so it's unit-testable.
export function buildValuationPrompt(programs: ProgramDef[] = PROGRAMS): {
  system: string
  user: string
} {
  const list = programs.map((p) => `${p.id} — ${p.name} (${p.kind})`).join('\n')
  const system = [
    'You are a loyalty-points valuation analyst. Estimate the CURRENT typical',
    'achievable value, in US cents per point/mile, for each loyalty program below.',
    'Use a realistic good-redemption value (a strong transfer-partner or award',
    `redemption), NOT a cash-out floor and NOT an outsized one-off. Stay within ${MIN_CPP}`,
    `to ${MAX_CPP} cents. Ground every number in well-known published community`,
    'valuations; do not invent figures for programs you do not recognize.',
    '',
    'Programs (id — name (kind)):',
    list,
    '',
    'Respond with ONE JSON object and nothing else, mapping each program id to a',
    'number (cents per point). Example: {"amex-mr": 2.0, "delta": 1.2}.',
    'Omit any program you cannot confidently value. No markdown fences, no prose.',
  ].join('\n')
  const user = 'Return the current cents-per-point valuations as JSON.'
  return { system, user }
}

// Parse the model's JSON map defensively, clamp each value, and keep only ids we
// recognize. Pure — separated from the network call so it's fully testable.
export function parseValuationJson(raw: string): Record<string, number> {
  const out: Record<string, number> = {}
  if (typeof raw !== 'string') return out
  const text = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return out
  let obj: unknown
  try {
    obj = JSON.parse(text.slice(start, end + 1))
  } catch {
    return out
  }
  if (!obj || typeof obj !== 'object') return out
  for (const [id, value] of Object.entries(obj as Record<string, unknown>)) {
    // Only accept ids that are real canonical programs — the model can't add new
    // currencies, only re-price known ones.
    if (!programById(id)) continue
    const clamped = clampCpp(value)
    if (clamped != null) out[id] = clamped
  }
  return out
}

// Call the AI Gateway (or Anthropic) for a raw text completion. Mirrors the
// concierge's callConcierge: gateway key preferred, then Anthropic key/OAuth.
// Returns null on any failure — NEVER throws.
async function callValuationModel(system: string, user: string): Promise<string | null> {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY
  if (gatewayKey) {
    try {
      const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${gatewayKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.AI_GATEWAY_MODEL || 'deepseek/deepseek-v3',
          max_tokens: 1024,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) return null
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      return json.choices?.[0]?.message?.content?.trim() || null
    } catch {
      return null
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  const authToken = process.env.CLAUDE_CODE_OAUTH_TOKEN
  if (!apiKey && !authToken) return null
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = apiKey ? new Anthropic({ apiKey }) : new Anthropic({ authToken })
    const message = await client.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: user }],
      },
      {
        timeout: 20_000,
        ...(authToken ? { headers: { 'anthropic-beta': 'oauth-2025-04-20' } } : {}),
      },
    )
    return message.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim() || null
  } catch {
    return null
  }
}

// Refresh the live valuation table via the model. Merges clamped AI values over
// the hardcoded baseline (so unpriced programs keep their sane defaults) and
// updates the in-process live table. Returns a RefreshResult describing what
// happened. On ANY failure, returns the baseline unchanged with source:'baseline'.
export async function refreshValuationsViaAI(): Promise<RefreshResult> {
  const baseline = { ...BASELINE_CPP }
  const { system, user } = buildValuationPrompt()

  let raw: string | null = null
  try {
    raw = await callValuationModel(system, user)
  } catch {
    raw = null
  }
  if (!raw) {
    return { valuations: baseline, source: 'baseline', updated: [], note: 'AI unavailable; using hardcoded baseline.' }
  }

  const aiValues = parseValuationJson(raw)
  const updated = Object.keys(aiValues)
  if (!updated.length) {
    return { valuations: baseline, source: 'baseline', updated: [], note: 'No usable AI values; using hardcoded baseline.' }
  }

  const merged = { ...baseline, ...aiValues }
  // Commit to the in-process live table so subsequent programValue() calls reflect it.
  for (const [id, cpp] of Object.entries(merged)) liveCpp[id] = cpp

  return { valuations: merged, source: 'ai', updated }
}

// Reset the live table back to the hardcoded baseline (test hygiene / manual revert).
export function resetValuations(): void {
  for (const id of Object.keys(liveCpp)) delete liveCpp[id]
  Object.assign(liveCpp, BASELINE_CPP)
}
