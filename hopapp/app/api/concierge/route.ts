// POST /api/concierge — Claude-powered travel concierge grounded in the user's
// points balances and hop's destinations dataset. Answers "where should I go"
// and "points or cash" questions, warmly and concretely, with NO hallucinated
// flight prices — every suggestion is framed from lib/destinations.ts.
//
// Always responds 200. Auth, parse, and API failures all degrade to a friendly
// fallback answer; this handler never throws or 500s.

import Anthropic from '@anthropic-ai/sdk'
import {
  destinations,
  affordableWith,
  computeCpp,
  destinationByCode,
  type Destination,
} from '@/lib/destinations'

export const runtime = 'nodejs'

// --- Request / response contract -------------------------------------------

export interface ConciergeProgram {
  program: string
  balance: number
}

export interface ConciergeContext {
  programs?: ConciergeProgram[]
  totalPoints?: number
  /** The user's home airport (IATA) — where realistic trips depart from. */
  homeAirport?: string
}

export interface ConciergeRequest {
  question: string
  context?: ConciergeContext
}

export interface ConciergeSuggestion {
  code: string
  city: string
  reason: string
  // ── Verdict facts (computed SERVER-SIDE from the destinations dataset + the
  // user's real balances — never written by the model, so they never lie). The
  // AI picks the destination + writes `reason`; hop fills in the hard numbers
  // that turn a suggestion into a bookable decision.
  milesNeeded?: number // typical one-way award miles
  cashUsd?: number // typical one-way cash
  cpp?: number // cents per point at this redemption
  bestProgram?: string // program that books it well
  youHave?: number // user's balance in that program (if known)
  affordable?: boolean // can the user book it with points they hold now?
  verdict?: 'points' | 'cash' | 'save' // the one-glance call
}

export interface ConciergeResponse {
  answer: string
  suggestions?: ConciergeSuggestion[]
}

// Points valuations (cents per point) the concierge reasons with.
const VALUATIONS: Record<string, number> = {
  'Amex MR': 2.0,
  'Chase UR': 2.0,
  Bilt: 2.0,
  Alaska: 1.8,
  BA: 1.5,
  Southwest: 1.5,
}

const MODEL = 'claude-sonnet-4-6'

// --- Prompt assembly (pure, unit-tested in lib/__tests__/concierge.test.ts) -

// Compact, token-efficient summary of the destinations dataset. One line each:
// code · city, country · region · vibe [tags] · ~Nk mi ow · best program · ~cpp.
export function destinationsSummary(items: Destination[] = destinations): string {
  return items
    .map((d) => {
      const miles = `~${Math.round(d.typicalAwardMiles / 1000)}k mi ow`
      const value = computeCpp(d)
      const cppStr = value === undefined ? '' : ` · ~${value}cpp`
      return `${d.code} · ${d.city}, ${d.country} · ${d.region} · ${d.vibe} [${d.tags.join('/')}] · ${miles} · best via ${d.bestProgram}${cppStr}`
    })
    .join('\n')
}

function valuationsSummary(): string {
  return Object.entries(VALUATIONS)
    .map(([prog, cpp]) => `${prog} ${cpp.toFixed(1)}cpp`)
    .join(', ')
}

function balancesSummary(context?: ConciergeContext): string {
  const programs = context?.programs ?? []
  const total = context?.totalPoints
  if (!programs.length && total === undefined) {
    return 'No balances shared. Ask warmly what points they have if it matters, but still give useful ideas.'
  }
  const lines: string[] = []
  if (programs.length) {
    for (const p of programs) {
      lines.push(`- ${p.program}: ${p.balance.toLocaleString('en-US')} pts`)
    }
  }
  if (total !== undefined) {
    lines.push(`- Total usable points: ${total.toLocaleString('en-US')}`)
  }
  return lines.join('\n')
}

// Build the system + user prompt. Pure function so it can be tested without
// touching the network. Returns { system, user }.
export function buildPrompt(
  question: string,
  context?: ConciergeContext,
): { system: string; user: string } {
  const system = [
    "You are hop's AI travel concierge. hop helps people turn loyalty points into great trips.",
    'Your job: recommend WHERE to go and whether to use POINTS or CASH, grounded ONLY in the data below.',
    '',
    'Hard rules:',
    '- NEVER invent specific flight prices, fares, or live award availability. Frame every suggestion from the destinations dataset.',
    '- Match suggestions to the destinations dataset by IATA code. Do not suggest places not in the dataset.',
    "- Respect the user's points balances: prefer destinations they can actually afford with the points they have.",
    '- Be warm, concrete, and concise — a few sentences, full of wanderlust but practical. No emoji spam, no hype.',
    '- When it helps, say roughly how many points a trip needs (from the dataset) and which program books it well.',
    '',
    'Points valuations (cents per point), for points-vs-cash reasoning:',
    valuationsSummary(),
    '',
    "The user's points balances:",
    balancesSummary(context),
    '',
    context?.homeAirport
      ? `The user flies from ${context.homeAirport.toUpperCase()} (their home airport). Favor trips that make sense from there, frame distances/routes from ${context.homeAirport.toUpperCase()}, and mention it naturally (e.g. "from ${context.homeAirport.toUpperCase()}").`
      : "The user hasn't set a home airport. Keep suggestions origin-agnostic, or gently suggest they set one for sharper picks.",
    '',
    'Destinations dataset (code · city · region · vibe [tags] · ~award miles one-way · best program · ~value):',
    destinationsSummary(),
    '',
    'Respond with a single JSON object and nothing else:',
    '{"answer": string, "suggestions": [{"code": string, "city": string, "reason": string}]}',
    '- "answer": your warm, practical reply (1-4 sentences).',
    '- "suggestions": 1-3 destinations from the dataset that fit, each with a one-line reason. Omit or use [] if none fit.',
    'Return ONLY the JSON object — no markdown fences, no prose around it.',
  ].join('\n')

  const user = question?.trim() || 'Where should I go with my points?'

  return { system, user }
}

// --- Anthropic client -------------------------------------------------------

// Gateway model. Override with AI_GATEWAY_MODEL — set to 'anthropic/claude-sonnet-4-6'
// once paid AI Gateway credits are added (Claude is restricted on the free tier).
// Default is a capable model available without paid credits.
const GATEWAY_MODEL = process.env.AI_GATEWAY_MODEL || 'deepseek/deepseek-v3'

// Produce the concierge's raw text answer from whichever provider is configured.
// Returns null when no provider is available or the call fails — the caller then
// serves the graceful fallback. NEVER throws.
async function callConcierge(system: string, user: string): Promise<string | null> {
  // 1) Vercel AI Gateway (preferred in prod) — OpenAI-compatible endpoint, so it
  //    works for any gateway model (DeepSeek on the free tier; Claude with credits).
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
          model: GATEWAY_MODEL,
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

  // 2) Direct Anthropic API key, or 3) Claude Code OAuth token (dev; rate-limited).
  const apiKey = process.env.ANTHROPIC_API_KEY
  const authToken = process.env.CLAUDE_CODE_OAUTH_TOKEN
  if (!apiKey && !authToken) return null
  try {
    const client = apiKey ? new Anthropic({ apiKey }) : new Anthropic({ authToken })
    const message = await client.messages.create(
      { model: MODEL, max_tokens: 1024, system, messages: [{ role: 'user', content: user }] },
      {
        timeout: 20_000,
        ...(authToken ? { headers: { 'anthropic-beta': 'oauth-2025-04-20' } } : {}),
      },
    )
    return extractText(message) || null
  } catch {
    return null
  }
}

// --- Response parsing --------------------------------------------------------

function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
}

// Parse the model's JSON defensively. Falls back to { answer: raw } on failure.
export function parseConciergeJson(raw: string): ConciergeResponse {
  const text = raw.trim()
  // Strip accidental markdown fences.
  const unfenced = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    const slice = unfenced.slice(start, end + 1)
    try {
      const obj = JSON.parse(slice) as Partial<ConciergeResponse>
      if (obj && typeof obj.answer === 'string') {
        const suggestions = Array.isArray(obj.suggestions)
          ? obj.suggestions
              .filter(
                (s): s is ConciergeSuggestion =>
                  !!s &&
                  typeof s.code === 'string' &&
                  typeof s.city === 'string' &&
                  typeof s.reason === 'string',
              )
              .slice(0, 3)
          : undefined
        return suggestions && suggestions.length
          ? { answer: obj.answer, suggestions }
          : { answer: obj.answer }
      }
    } catch {
      // fall through
    }
  }
  // Last resort: hand back whatever text we got so the user sees something.
  return { answer: unfenced || raw }
}

// Enrich the AI's picks with VERDICT FACTS computed server-side from the
// destinations dataset + the user's real balances. The model chose the city and
// wrote the reason; hop fills in the numbers — so a card never shows a figure the
// model invented. Loosely matches the suggestion's bestProgram to a balance the
// user holds (tolerant substring/code match) to decide affordability + verdict.
function enrichSuggestions(
  suggestions: ConciergeSuggestion[],
  context?: ConciergeContext,
): ConciergeSuggestion[] {
  const programs = context?.programs ?? []
  // Tolerant: does the user hold a program that books this destination? Returns
  // the held balance, or undefined if we can't confidently match.
  const heldFor = (bestProgram: string): number | undefined => {
    const target = bestProgram.toLowerCase()
    let best: number | undefined
    for (const p of programs) {
      const name = p.program.toLowerCase()
      // match either direction on a meaningful token (program names vary in form)
      const token = target.split(/[\s/]+/).find((t) => t.length >= 4 && name.includes(t))
      if (token || name.includes(target) || target.includes(name)) {
        best = Math.max(best ?? 0, p.balance)
      }
    }
    return best
  }

  return suggestions.map((s) => {
    const d = destinationByCode(s.code)
    if (!d) return s
    const milesNeeded = d.typicalAwardMiles
    const cashUsd = d.typicalCashUSD
    const cpp = computeCpp(d)
    const youHave = heldFor(d.bestProgram)
    const affordable = youHave != null ? youHave >= milesNeeded : undefined
    // Verdict: strong CPP → points; weak CPP → cash; can't afford yet → save.
    const verdict: ConciergeSuggestion['verdict'] =
      affordable === false ? 'save' : cpp != null && cpp >= 1.5 ? 'points' : 'cash'
    return {
      ...s,
      milesNeeded,
      cashUsd,
      cpp,
      bestProgram: d.bestProgram,
      youHave,
      affordable,
      verdict,
    }
  })
}

// A graceful, on-brand fallback when we can't reach the model at all.
function fallbackAnswer(question: string, context?: ConciergeContext): ConciergeResponse {
  const total = context?.totalPoints
  let picks: Destination[] = []
  if (total !== undefined && total > 0) {
    picks = affordableWith(total).slice(0, 3)
  }
  if (!picks.length) {
    // Best-value handful regardless of balance.
    picks = [...destinations]
      .sort((a, b) => (computeCpp(b) ?? 0) - (computeCpp(a) ?? 0))
      .slice(0, 3)
  }
  const answer = total
    ? `I can't reach my travel brain right now, but with ~${total.toLocaleString('en-US')} points a few standout trips come to mind — here are some great-value ideas to get you dreaming.`
    : `I can't reach my travel brain right now, but here are a few of the best points-value trips on hop to get you started.`
  return {
    answer,
    suggestions: picks.map((d) => ({
      code: d.code,
      city: d.city,
      reason: `${d.vibe} — about ${Math.round(d.typicalAwardMiles / 1000)}k miles one-way via ${d.bestProgram}.`,
    })),
  }
}

// --- Handler ----------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  let body: ConciergeRequest
  try {
    body = (await request.json()) as ConciergeRequest
  } catch {
    return Response.json(
      { answer: 'I didn’t catch that — try asking me where to go with your points.' },
      { status: 200 },
    )
  }

  const question = typeof body?.question === 'string' ? body.question : ''
  const context = body?.context

  if (!question.trim()) {
    return Response.json(
      {
        answer:
          'Ask me anything about where to go with your points — like "somewhere warm for a long weekend" or "is it better to use points or cash to Tokyo?"',
      } satisfies ConciergeResponse,
      { status: 200 },
    )
  }

  const { system, user } = buildPrompt(question, context)

  // Attach server-computed verdict facts to whatever suggestions a response
  // carries, so every card the user sees is grounded in real numbers.
  const withVerdicts = (r: ConciergeResponse): ConciergeResponse =>
    r.suggestions?.length ? { ...r, suggestions: enrichSuggestions(r.suggestions, context) } : r

  try {
    const text = await callConcierge(system, user)
    if (!text) {
      return Response.json(withVerdicts(fallbackAnswer(question, context)), { status: 200 })
    }
    return Response.json(withVerdicts(parseConciergeJson(text)), { status: 200 })
  } catch {
    return Response.json(withVerdicts(fallbackAnswer(question, context)), { status: 200 })
  }
}
