// parseTravelPrefs(text): translate freeform travel language into a validated
// TravelPrefs. The AI is a TRANSLATOR ONLY — it maps natural language to engine
// inputs; it never decides economics. Output is clamped to the enum via
// validatePrefs (never lets the model invent fields), and a deterministic regex
// fallback (parseTravelPrefsFallback) handles the common cases so this works
// even when the AI Gateway is down. NEVER throws.

import {
  validatePrefs,
  parseTravelPrefsFallback,
  type TravelPrefs,
} from '@/lib/prefs-model'
import { callGateway } from '@/lib/ai-gateway'

// Parsers use a cheaper translator than the streaming concierge; override with
// AI_GATEWAY_MODEL (shared default lives in lib/ai-gateway).
const GATEWAY_MODEL = process.env.AI_GATEWAY_MODEL || 'deepseek/deepseek-v3'

const SYSTEM = [
  'You translate a traveler\'s freeform preferences into a strict JSON object of flight-search constraints.',
  'You do NOT make recommendations or reason about price/points — only extract explicit constraints.',
  '',
  'Return ONLY this JSON object, no prose, no markdown fences:',
  '{"maxStops"?: number, "minCabin"?: "economy"|"premium"|"business"|"first", "preferNonstop"?: boolean}',
  '',
  'Rules:',
  '- maxStops: integer 0-3. 0 means nonstop only ("nonstop", "direct", "won\'t connect", "no layovers").',
  '- minCabin: the LOWEST acceptable cabin the user will accept. Only set when they name a cabin.',
  '- preferNonstop: true when they prefer (not strictly require) nonstop. If maxStops is 0, also set true.',
  '- Omit any field the user did not clearly express. Never guess. Never add other fields.',
  '- If nothing is expressed, return {}.',
].join('\n')

// Call the Vercel AI Gateway to translate the text into prefs. Returns validated
// prefs or null when no key / the call fails. CLAMP: validatePrefs keeps only
// known fields, validated to enum/type. NEVER throws.
function aiPrefs(text: string): Promise<TravelPrefs | null> {
  return callGateway({
    system: SYSTEM,
    user: text,
    model: GATEWAY_MODEL,
    maxTokens: 256,
    validate: validatePrefs,
  })
}

// Translate freeform text into TravelPrefs.
//
// Strategy: the deterministic fallback always runs first (cheap, offline, and a
// floor we trust). When the AI Gateway is configured, we let it widen — merging
// any extra fields it found — but the regex result wins on conflict for the
// unambiguous cases it covers, so the AI can never contradict "nonstop only".
export async function parseTravelPrefs(text: string): Promise<TravelPrefs> {
  const input = (text || '').trim()
  if (!input) return {}

  const fallback = parseTravelPrefsFallback(input)
  const ai = await aiPrefs(input)
  if (!ai) return fallback

  // Merge: AI fills gaps the regex missed; regex overrides on conflict.
  return validatePrefs({ ...ai, ...fallback })
}
