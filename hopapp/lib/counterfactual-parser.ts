// parseMutation(text): translate freeform "what if…" language into a validated
// counterfactual Mutation. The AI is a TRANSLATOR ONLY — it maps natural language
// onto the engine's structured inputs (op + canonical program ids + amount); it
// never decides economics. The engine (lib/counterfactual.runCounterfactual) owns
// every number.
//
// Strategy mirrors lib/prefs-parser: a deterministic REGEX fallback runs first
// (cheap, offline, the floor we trust) and handles the common cases
// ("what if I had 50k more Chase UR", "what if I held Alaska instead of Delta").
// When the AI Gateway is configured it may WIDEN coverage for phrasings the regex
// missed — but the result is always re-clamped to a known program via
// validateMutation, so the model can never invent a currency or an op. NEVER throws.

import { canonicalizeProgram } from '@/lib/programs'
import type { Mutation } from '@/lib/counterfactual'

// Mirrors the gateway model selection in app/api/concierge + lib/prefs-parser.
const GATEWAY_MODEL = process.env.AI_GATEWAY_MODEL || 'anthropic/claude-sonnet-4-6'

const SYSTEM = [
  'You translate a traveler\'s "what if I had a different points portfolio?" question into a strict JSON mutation.',
  'You do NOT reason about value, trips, or economics — only extract the change to the portfolio.',
  '',
  'Return ONLY this JSON object, no prose, no markdown fences. One of:',
  '{"op":"add","program":string,"amount":number}    // add points to a program',
  '{"op":"set","program":string,"amount":number}    // set a program to an exact amount',
  '{"op":"swap","from":string,"to":string}          // hold one program instead of another',
  '',
  'Rules:',
  '- op "add": the user gains MORE of a program ("if I had 50k more Chase UR", "another 30,000 Amex").',
  '- op "set": the user states an exact target balance ("if I had 100k Amex").',
  '- op "swap": the user trades one program for another ("if I held Alaska instead of Delta").',
  '- program/from/to: use the brand name as the user said it (e.g. "Chase Ultimate Rewards", "Alaska", "Delta"). Do not invent programs.',
  '- amount: an integer number of points. Expand "k"/"thousand" (50k -> 50000). Omit for swap.',
  '- If the request does not fit any op, return {}.',
].join('\n')

// --- Validation (clamp to a known program; never trust the raw model/regex) ---

// Coerce an arbitrary value into a validated Mutation, or null. Every program
// string is run through canonicalizeProgram so an unknown currency is REJECTED
// (returns null) rather than reaching the engine. Amounts are clamped to a sane,
// positive, integer range. Pure + total.
export function validateMutation(raw: unknown): Mutation | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const op = r.op

  const prog = (v: unknown): string | undefined => {
    if (typeof v !== 'string') return undefined
    return canonicalizeProgram(v)?.id
  }
  const amt = (v: unknown): number | undefined => {
    const n = typeof v === 'string' ? Number(v.replace(/[, ]/g, '')) : v
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return undefined
    // Clamp to a believable ceiling so a stray "1e9" can't blow up the diff.
    return Math.min(10_000_000, Math.round(n))
  }

  if (op === 'add' || op === 'set') {
    const program = prog(r.program)
    const amount = amt(r.amount)
    if (!program || amount === undefined) return null
    return { op, program, amount }
  }
  if (op === 'swap') {
    const from = prog(r.from)
    const to = prog(r.to)
    if (!from || !to || from === to) return null
    return { op: 'swap', from, to }
  }
  return null
}

// --- Deterministic regex fallback (offline floor) -----------------------------

// Parse "50k", "50,000", "50 thousand" -> 50000. Returns undefined when no
// number is present.
function parseAmount(text: string): number | undefined {
  // "50k" / "50 k" / "50K"
  const k = text.match(/(\d[\d,.]*)\s*k\b/i)
  if (k) {
    const n = Number(k[1].replace(/,/g, ''))
    if (Number.isFinite(n)) return Math.round(n * 1000)
  }
  // "50 thousand"
  const th = text.match(/(\d[\d,.]*)\s*thousand\b/i)
  if (th) {
    const n = Number(th[1].replace(/,/g, ''))
    if (Number.isFinite(n)) return Math.round(n * 1000)
  }
  // bare "50000" / "50,000"
  const bare = text.match(/(\d[\d,]{2,})/)
  if (bare) {
    const n = Number(bare[1].replace(/,/g, ''))
    if (Number.isFinite(n)) return Math.round(n)
  }
  return undefined
}

// Find the canonical program id mentioned in a fragment, if any.
function findProgram(fragment: string): string | undefined {
  return canonicalizeProgram(fragment)?.id
}

// Deterministic, offline parse of the common "what if" phrasings. Returns a
// validated Mutation or null.
export function parseMutationFallback(text: string): Mutation | null {
  const input = (text || '').trim()
  if (!input) return null

  // SWAP: "X instead of Y", "swap Y for X", "trade Y for X", "if I held X not Y".
  const insteadOf = input.match(/(.+?)\s+instead of\s+(.+)/i)
  if (insteadOf) {
    const to = findProgram(insteadOf[1])
    const from = findProgram(insteadOf[2])
    if (to && from && to !== from) return { op: 'swap', from, to }
  }
  const swapFor = input.match(/(?:swap|trade|switch|move)\s+(.+?)\s+(?:for|to|into)\s+(.+)/i)
  if (swapFor) {
    const from = findProgram(swapFor[1])
    const to = findProgram(swapFor[2])
    if (from && to && from !== to) return { op: 'swap', from, to }
  }

  const amount = parseAmount(input)

  // ADD: "more", "another", "extra", "+", "added" — a gain on top of current.
  const isAdd = /\b(more|another|extra|added|additional|plus|on top)\b|\+/i.test(input)
  // SET: "had exactly", "if I had N <program>" with no "more" reads as a target.
  if (amount !== undefined) {
    // The program is whatever canonical program the whole string mentions.
    const program = findProgram(input)
    if (program) {
      return { op: isAdd ? 'add' : 'set', program, amount }
    }
  }

  return null
}

// --- JSON extraction (defensive) ---------------------------------------------

function parseJson(raw: string): unknown {
  const unfenced = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return {}
  try {
    return JSON.parse(unfenced.slice(start, end + 1))
  } catch {
    return {}
  }
}

// --- Gateway call (OpenAI-compatible, via the AI Gateway) ---------------------

// Ask the gateway to translate the text into a mutation. Returns a VALIDATED
// Mutation or null when there's no key / the call fails / it doesn't validate.
// NEVER throws.
async function callGateway(text: string): Promise<Mutation | null> {
  const key = process.env.AI_GATEWAY_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: GATEWAY_MODEL,
        max_tokens: 200,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: text },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = json.choices?.[0]?.message?.content
    if (!content) return null
    return validateMutation(parseJson(content))
  } catch {
    return null
  }
}

// Translate freeform "what if" text into a validated Mutation, or null when the
// request can't be understood. The regex fallback runs first as a trusted floor;
// the gateway only fills in when the regex couldn't place a mutation, so the
// offline path is never overridden by a model guess. NEVER throws.
export async function parseMutation(text: string): Promise<Mutation | null> {
  const input = (text || '').trim()
  if (!input) return null

  const fallback = parseMutationFallback(input)
  if (fallback) return fallback

  return callGateway(input)
}
