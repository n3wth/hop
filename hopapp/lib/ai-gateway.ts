// Shared client for the NL TRANSLATOR parsers (prefs, standing orders,
// counterfactual mutations). Each of those takes freeform user text, asks the
// Vercel AI Gateway (OpenAI-compatible /v1/chat/completions) to translate it into
// strict JSON, then CLAMPS the result through its own validator before it can
// reach the engine. They all share the same shape — no key → null, fetch with a
// bearer + timeout, defensively extract a JSON object from the reply, validate —
// so that shape lives here once. The model never originates economics; it only
// fills structured fields the validator already constrains.
//
// NOTE: this is the RAW-fetch path used by the offline-first parsers. The
// STREAMING concierge/dream routes use the AI SDK's streamText/gateway instead
// (live token streaming + tool calls), a deliberately different mechanism.

// The gateway model parsers default to. Callers pass their own (the parsers use a
// cheaper model than the streaming concierge), but this is the shared fallback so
// the env override name lives in one place.
export const GATEWAY_MODEL = process.env.AI_GATEWAY_MODEL || 'anthropic/claude-sonnet-4-6'

// Extract + parse a JSON object from raw model text. Defensive: strips markdown
// fences, then slices to the OUTERMOST braces so leading/trailing prose can't
// break the parse. Returns {} on any failure (never throws), so a validator
// always receives an object to clamp.
export function extractJson(raw: string): unknown {
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

export interface GatewayCall<T> {
  // System + user prompt for the single-shot translation.
  system: string
  user: string
  // Model id (the parsers pick their own; defaults to GATEWAY_MODEL).
  model?: string
  // Output token ceiling (each parser sizes this to its JSON shape).
  maxTokens: number
  // Map the extracted JSON onto the caller's validated type, or null when it
  // doesn't clamp to anything usable. This is the CLAMP — the model's raw output
  // never escapes without passing through it.
  validate: (parsed: unknown) => T | null
}

// Call the Vercel AI Gateway (OpenAI-compatible) and return the VALIDATED result,
// or null when there's no key / the call fails / the reply doesn't validate.
// NEVER throws — the parsers fall back to their deterministic regex path on null.
export async function callGateway<T>({
  system,
  user,
  model = GATEWAY_MODEL,
  maxTokens,
  validate,
}: GatewayCall<T>): Promise<T | null> {
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
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
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
    return validate(extractJson(content))
  } catch {
    return null
  }
}
