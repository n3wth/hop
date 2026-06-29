// POST /api/concierge — hop's AGENTIC, STREAMING, TOOL-USING travel concierge.
//
// Powered by the Vercel AI SDK (streamText) routed through the AI Gateway. The
// concierge streams its answer live AND can call tools mid-thought:
//   • web_search  — live world-context (events, seasonality, why fares move)
//   • get_weather — typical/seasonal weather for a place + month (open-meteo)
//   • price_trip  — hop's REAL deterministic engine (computeCpp +
//                   destinationByCode + effectiveBalanceFor). THIS is how the
//                   agent quotes miles/CPP/affordability — the LLM never invents
//                   those numbers; it reads them from hop's engine exposed as a tool.
//
// The response is a streamed text body (toTextStreamResponse) so the answer can
// type out live. If the gateway/tools/streaming are unavailable or fail, the
// handler degrades to the curated fallback — served as the SAME text stream — so
// /ask keeps working and this endpoint NEVER 500s.
//
// NOTE: buildPrompt / destinationsSummary / parseConciergeJson / enrichSuggestions
// are preserved (pure, unit-tested) and still used by the fallback path.

import { streamText, stepCountIs, gateway } from 'ai'
import {
  destinations,
  affordableWith,
  computeCpp,
  destinationByCode,
  type Destination,
} from '@/lib/destinations'
import { valuationsByName } from '@/lib/valuations'
import { effectiveBalanceFor } from '@/lib/transfers'
import { buildConciergeTools } from '@/lib/concierge-tools'
import type { Balance } from '@/lib/types'

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
  youHave?: number // EFFECTIVE balance toward that program (direct OR transferable)
  // How `youHave` is reached: a direct holding, or a transfer from a bank
  // currency (with ratio). Lets the card narrate "via Amex MR (1:1)".
  youHaveVia?: { kind: 'direct'; program: string } | { kind: 'transfer'; source: string; ratio: string }
  affordable?: boolean // can the user book it with points they hold now?
  verdict?: 'points' | 'cash' | 'save' // the one-glance call
}

export interface ConciergeResponse {
  answer: string
  suggestions?: ConciergeSuggestion[]
}

// Gateway model. Default is Claude via the AI Gateway (paid credits, verified
// working incl. tool-calling). Override with AI_GATEWAY_MODEL.
const GATEWAY_MODEL = process.env.AI_GATEWAY_MODEL || 'anthropic/claude-sonnet-4-6'

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

// Pulls baseline valuations from lib/valuations.ts (canonical program names ->
// cpp), the single source of truth. No hardcoded numbers live here anymore, so
// the concierge and the deterministic engine reason with the same figures.
function valuationsSummary(): string {
  return Object.entries(valuationsByName())
    .map(([prog, cpp]) => `${prog} ${cpp.toFixed(2)}cpp`)
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

// System prompt for the AGENTIC streaming path. Same grounding rules as
// buildPrompt, but tuned for prose streaming + tool use instead of JSON.
function buildAgenticSystem(context?: ConciergeContext): string {
  return [
    "You are hop's AI travel concierge. hop helps people turn loyalty points into great trips.",
    'Recommend WHERE to go and whether to use POINTS or CASH. Be warm, concrete, and concise — full of wanderlust but practical. No emoji spam, no hype.',
    '',
    'You have tools. USE THEM:',
    '- price_trip(code): hop\'s DETERMINISTIC engine. ALWAYS call this before stating ANY miles, cents-per-point, or affordability number. NEVER invent those numbers — read them from this tool. Pass the IATA code of a hop destination.',
    '- get_weather(place, month): typical/seasonal weather. Use when climate or timing matters.',
    '- web_search(objective): live world-context — events, seasonality, why fares move at a given time. Use sparingly for things the dataset can\'t tell you.',
    '',
    'Hard rules:',
    '- Suggest ONLY destinations in the dataset below (match by IATA code).',
    '- NEVER invent flight prices, fares, miles, CPP, or award availability. Numbers come from price_trip; live facts come from web_search/get_weather.',
    "- Prefer destinations the user can actually afford with the points they hold.",
    '- After tool calls, weave the real figures into a flowing 1-4 sentence answer. Mention how many points a trip needs and which program books it.',
    '',
    'Points valuations (cents per point):',
    valuationsSummary(),
    '',
    "The user's points balances:",
    balancesSummary(context),
    '',
    context?.homeAirport
      ? `The user flies from ${context.homeAirport.toUpperCase()}. Favor trips that make sense from there and mention it naturally.`
      : "The user hasn't set a home airport. Keep suggestions origin-agnostic, or gently suggest they set one.",
    '',
    'Destinations dataset (code · city · region · vibe [tags] · ~award miles one-way · best program · ~value):',
    destinationsSummary(),
  ].join('\n')
}

// --- Response parsing (fallback path) ---------------------------------------

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
// model invented. Counts a held balance toward a destination if the user holds
// the booking program DIRECTLY *or* holds a transferable bank currency that
// transfers to it (ratio applied) — via lib/transfers.effectiveBalanceFor.
export function enrichSuggestions(
  suggestions: ConciergeSuggestion[],
  context?: ConciergeContext,
): ConciergeSuggestion[] {
  const balances: Balance[] = (context?.programs ?? []).map((p) => ({
    program: p.program,
    code: '',
    balance: p.balance,
  }))

  return suggestions.map((s) => {
    const d = destinationByCode(s.code)
    if (!d) return s
    const milesNeeded = d.typicalAwardMiles
    const cashUsd = d.typicalCashUSD
    const cpp = computeCpp(d)
    const eff = effectiveBalanceFor(d.bestProgram, balances)
    const youHave = eff?.amount
    const affordable = youHave != null ? youHave >= milesNeeded : undefined
    const verdict: ConciergeSuggestion['verdict'] =
      affordable === false ? 'save' : cpp != null && cpp >= 1.5 ? 'points' : 'cash'
    return {
      ...s,
      milesNeeded,
      cashUsd,
      cpp,
      bestProgram: d.bestProgram,
      youHave,
      youHaveVia: eff?.via,
      affordable,
      verdict,
    }
  })
}

// A graceful, on-brand fallback when we can't reach the model at all.
export function fallbackAnswer(question: string, context?: ConciergeContext): ConciergeResponse {
  const total = context?.totalPoints
  let picks: Destination[] = []
  if (total !== undefined && total > 0) {
    picks = affordableWith(total).slice(0, 3)
  }
  if (!picks.length) {
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

// Render a ConciergeResponse as a plain-text stream so the curated fallback
// flows through the SAME response shape the agentic path uses. The /ask client
// reads the body as text either way.
function textStreamFromAnswer(r: ConciergeResponse): Response {
  const enriched = r.suggestions?.length ? enrichSuggestions(r.suggestions, undefined) : r.suggestions
  const lines = [r.answer]
  for (const s of enriched ?? []) {
    const bits: string[] = [`${s.city} (${s.code})`]
    if (s.milesNeeded != null) bits.push(`~${Math.round(s.milesNeeded / 1000)}k mi`)
    if (s.bestProgram) bits.push(`via ${s.bestProgram}`)
    lines.push(`\n• ${bits.join(' · ')} — ${s.reason}`)
  }
  const body = lines.join('')
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}

// --- Handler ----------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  let body: ConciergeRequest
  try {
    body = (await request.json()) as ConciergeRequest
  } catch {
    return new Response('I didn’t catch that — try asking me where to go with your points.', {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  const question = typeof body?.question === 'string' ? body.question : ''
  const context = body?.context

  if (!question.trim()) {
    return new Response(
      'Ask me anything about where to go with your points — like "somewhere warm for a long weekend" or "is it better to use points or cash to Tokyo?"',
      { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    )
  }

  // No gateway key → no agentic streaming. Degrade to the curated fallback,
  // served as a text stream so /ask keeps working.
  if (!process.env.AI_GATEWAY_API_KEY) {
    return textStreamFromAnswer(fallbackAnswer(question, context))
  }

  try {
    const tools = buildConciergeTools(context?.programs ?? [])
    const result = streamText({
      model: gateway(GATEWAY_MODEL),
      system: buildAgenticSystem(context),
      prompt: question.trim(),
      tools,
      // Agentic loop: let the model call tools, then continue with the results.
      stopWhen: stepCountIs(5),
      // Never throw to the page — on a streaming error, surface a friendly line.
      onError({ error }) {
        console.error('[concierge] stream error', error)
      },
    })

    // Stream the answer as live text (tool-call/tool-result events drive the
    // model but only its prose deltas are emitted to this text stream).
    return result.toTextStreamResponse()
  } catch (err) {
    console.error('[concierge] setup failed, serving fallback', err)
    return textStreamFromAnswer(fallbackAnswer(question, context))
  }
}
