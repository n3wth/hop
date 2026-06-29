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

// Mirrors the gateway model selection in app/api/concierge/route.ts.
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

// Extract + parse a JSON object from raw model text (defensive: strips fences,
// slices to the outermost braces). Returns {} on any failure.
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

// Call the Vercel AI Gateway (OpenAI-compatible). Returns validated prefs or
// null when no key / the call fails. NEVER throws.
async function callGateway(text: string): Promise<TravelPrefs | null> {
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
        max_tokens: 256,
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
    // CLAMP: only known fields, validated to enum/type, survive.
    return validatePrefs(parseJson(content))
  } catch {
    return null
  }
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
  const ai = await callGateway(input)
  if (!ai) return fallback

  // Merge: AI fills gaps the regex missed; regex overrides on conflict.
  return validatePrefs({ ...ai, ...fallback })
}
