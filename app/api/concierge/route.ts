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
import { valuationsByName, walletValue } from '@/lib/valuations'
import { liveValuationsByName } from '@/lib/valuations-live'
import { effectiveBalanceFor } from '@/lib/transfers'
import { POINTS_THRESHOLD_CPP } from '@/lib/search'
import { buildConciergeTools } from '@/lib/concierge-tools'
import { GATEWAY_MODEL } from '@/lib/ai-gateway'
import type { Balance } from '@/lib/types'
import { checkBotId } from 'botid/server'
import { auth0 } from '@/lib/auth0'
import {
  getConversation,
  saveConversation,
  sanitizeMessages,
  type ConversationMessage,
} from '@/lib/conversations'
import { getConversationMemory, updateConversationMemory } from '@/lib/conversation-memory'
import { proposeInferredFacts } from '@/lib/inferred-facts'
import { getObservedContext } from '@/lib/memory-outcomes'
import { isObservedOutcomesEnabled } from '@/lib/env'
import { getProfile } from '@/lib/travel-profile'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { profileSummary, type TravelProfile } from '@/lib/travel-profile-model'
import { getTravelHistory, travelHistorySummary, type TravelHistory } from '@/lib/travel-history'
import {
  a2uiGuidance,
  extractA2UIJson,
  parseA2UI,
  reconcileEconomics,
  personalizeBlocks,
  type A2UIBlock,
} from '@/lib/a2ui'

// Sentinel that separates the streamed PROSE from the trailing a2ui ENVELOPE.
// The client splits on this: text before it types out live; the JSON after it is
// the validated, engine-reconciled block spec. Chosen to never collide with
// model prose. Exported so the client + tests share one constant. NOTE: the two
// framing chars are NUL (char 0), not spaces — they can never appear in model
// prose, so splitting on the sentinel never corrupts the visible answer.
export const TOOL_FRAME_SEP = String.fromCharCode(30)

// One tool-activity event surfaced to the client. `state` mirrors the AI SDK
// tool lifecycle that AI Elements' <Tool> understands. `id` ties a start to its
// completion so the client flips one card from running to done.
export interface ToolActivityFrame {
  id: string
  tool: string
  state: 'input-available' | 'output-available' | 'output-error'
  detail?: string
}

// Encode a tool-activity frame as an RS-delimited control frame.
export function encodeToolFrame(frame: ToolActivityFrame): string {
  return TOOL_FRAME_SEP + JSON.stringify(frame) + TOOL_FRAME_SEP
}

// A short, human-friendly detail line per tool call, derived from its input.
// Pure + total -- never throws on odd input shapes. `hasBalances` neutralizes the
// "your points" phrasing for visitors with nothing connected — the agent is
// demonstrating route value, not pricing points anyone owns.
function toolDetail(toolName: string, input: unknown, hasBalances: boolean): string | undefined {
  const o = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : undefined)
  switch (toolName) {
    case 'price_trip': {
      const code = s(o.code)
      if (!code) return undefined
      const suffix = hasBalances ? 'against your points' : 'against cash'
      return `Pricing ${String(code).toUpperCase()} ${suffix}`
    }
    case 'search_flights': {
      const from = s(o.from)
      const to = s(o.to)
      if (!from || !to) return undefined
      return `Searching ${String(from).toUpperCase()} → ${String(to).toUpperCase()}`
    }
    case 'get_weather': {
      const place = s(o.place)
      const month = s(o.month)
      return place ? `${place}${month ? ` in ${month}` : ''}` : undefined
    }
    case 'web_search':
      return s(o.objective) ?? s(o.query)
    case 'save_profile_fact':
      return s(o.fact) ?? 'Noting a detail about you'
    default:
      return undefined
  }
}

export const A2UI_SENTINEL ='\u0000A2UI\u0000'

// Build the validated, engine-reconciled, personalized a2ui blocks from the
// model's final text. Pure orchestration of lib/a2ui (each step never throws):
//   extract embedded JSON → validate (closed union) → stamp engine economics →
//   enforce personalization. Returns [] when the model emitted no usable spec.
export function blocksFromText(
  text: string,
  balances: ConciergeProgram[],
  profile: TravelProfile | undefined,
  hasHistory: boolean,
  canDismiss = false,
): A2UIBlock[] {
  const raw = extractA2UIJson(text ?? '')
  if (!raw) return []
  const validated = parseA2UI(raw)
  if (!validated.length) return []
  const withEcon = reconcileEconomics(validated, balances)
  return personalizeBlocks(withEcon, profile, hasHistory, canDismiss)
}

// Strip the fenced a2ui spec from the model's prose so the user reads clean text
// (the blocks render it instead). Removes the LAST ```...``` fence ANYWHERE in
// the text whose body parses as an a2ui object — NOT only one at end-of-string,
// because the server appends the sentinel + envelope after it. If a fence was
// OPENED but never closed (mid-stream, or the model trailed off), everything from
// that opener on is dropped too, so a half-streamed fence never reaches the user.
// Otherwise the text is returned unchanged.
export function stripA2UIFence(text: string): string {
  if (typeof text !== 'string') return ''
  // Walk every ```...``` fence; keep the index of the LAST one that's a2ui.
  const fence = /```(?:json)?\s*([\s\S]*?)```/gi
  let cut = -1
  for (let m = fence.exec(text); m; m = fence.exec(text)) {
    if (extractA2UIJson(m[1])) cut = m.index
  }
  if (cut !== -1) return text.slice(0, cut).trimEnd()
  // No closed a2ui fence. If a fence was OPENED but never closed (mid-stream, or
  // the model trailed off emitting its spec), suppress from the opener onward so a
  // partial spec is never shown as a raw code dump. A COMPLETE non-a2ui fence
  // (e.g. a real code block) is left intact — it has a matching closer.
  const open = text.indexOf('```')
  if (open !== -1 && text.indexOf('```', open + 3) === -1) {
    return text.slice(0, open).trimEnd()
  }
  return text
}

// Neutralize a leading tilde before a number/$ ("~$420", "~40k") in streamed
// prose. Streamdown renders via remark-gfm, which pairs tildes into STRIKETHROUGH
// — so two "~"-prefixed figures in one block (e.g. "~22,500 miles ... ~17,500
// miles") get visually crossed out, reading as "no longer valid". The load-
// bearing facts of a points concierge must never look struck. We rewrite the
// approximation marker to the on-brand word "about " instead. Pure + total.
// Applied incrementally to streamed prose, so it must be idempotent and safe on
// partial chunks: it only touches "~" immediately followed by a digit or "$".
export function sanitizeProse(text: string): string {
  if (typeof text !== 'string') return ''
  return text.replace(/~(?=[\d$])/g, 'about ')
}

// Per-identity / per-IP rate limit for the agentic endpoint. Each request can fan
// out to several LLM steps + provider web_search + outbound weather fetches, so
// unthrottled repetition (a script, or auto-firing chips in a loop) drives
// unbounded gateway/open-meteo cost. Allow a small burst, then a steady trickle.
const CONCIERGE_RATE = { capacity: 8, refillPerSec: 0.2 } // 8 burst, ~12/min sustained

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
  // Single-question form (Stage 1) — still fully supported for back-compat.
  question: string
  context?: ConciergeContext
  // MULTI-TURN form (memory). Prior turns of THIS conversation, threaded into
  // the streamText call so the agent answers in context. Optional: when omitted
  // the handler treats it as a one-shot question. For signed-in users the
  // server also loads any PERSISTED thread and merges it; signed-out users only
  // get what the client sends (session-only memory).
  messages?: ConversationMessage[]
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

// Pulls per-program valuations (canonical program names -> cpp) — the static
// lib/valuations.ts baseline by default, or the live-synced overrides from
// lib/valuations-live.ts#liveValuationsByName() when the caller has resolved
// them. Either way, this is a per-PROGRAM typical value, not a per-trip figure
// — it never originates a number itself, but it's a DIFFERENT scope than
// price_trip/search_flights' per-destination cpp, so the prompt must warn the
// model not to blend the two (see the "REFERENCE-ONLY" hard rule above).
function valuationsSummary(overrides?: Record<string, number>): string {
  const table = overrides ?? valuationsByName()
  return Object.entries(table)
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
  // Engine-computed wallet dollar total (lib/valuations#walletValue) — the ONLY
  // dollar figure for "the whole wallet" the model may ever state. Injected here
  // so the model restates this number instead of summing balances x cpp itself,
  // which could drift from the engine's rounding/coverage (see P2 review finding).
  if (programs.length) {
    const dollars = walletValue(
      programs.map((p) => ({ program: p.program, code: p.program, balance: p.balance })),
    )
    lines.push(
      `- Engine-computed wallet dollar value (typical baseline, ALL programs combined): ~$${dollars.toLocaleString('en-US')}`,
    )
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
    '- NEVER sum or multiply balances against the cpp table yourself to state a total wallet dollar value. If asked what the whole wallet is worth, restate ONLY the "Engine-computed wallet dollar value" figure below — never compute your own.',
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
// buildPrompt, but tuned for prose streaming + tool use instead of JSON. Now
// MEMORY-AWARE: the user's durable profile + (stub) travel history are read in
// so the agent personalizes, and it's told it can SAVE new facts via the tool.
function buildAgenticSystem(
  context?: ConciergeContext,
  profile?: TravelProfile,
  history?: TravelHistory,
  liveValuations?: Record<string, number>,
  memory?: string,
  observed?: string,
): string {
  const profileBlock = profileSummary(profile)
  const historyBlock = travelHistorySummary(history)
  const memoryBlock = (memory ?? '').trim()
  const observedBlock = (observed ?? '').trim()
  // True only when the visitor has real balances in play — gates the ownership
  // voice (no "your points" for a signed-out / no-balance visitor).
  const hasBalances = (context?.programs?.length ?? 0) > 0
  return [
    "You are hop's AI travel concierge. hop helps people turn loyalty points into great trips.",
    'You plan ENTIRE trips, not just pick destinations. You can:',
    '  • Recommend WHERE to go and whether to use POINTS or CASH (priced by the engine).',
    '  • Build day-by-day ITINERARIES and trip plans (as clean markdown — headings, day sections, bullet lists).',
    '  • Advise on anything travel: best time to go, neighborhoods to stay in, getting around, visas, packing, dining, what to see, multi-city routing, kids/accessibility, etc.',
    'Be warm, concrete, and practical — full of wanderlust but grounded. No emoji spam, no hype.',
    'This is an ongoing conversation: use the prior messages for context, and do not re-ask things the user already told you.',
    '',
    'You have tools. USE THEM:',
    '- price_trip(code): hop\'s DETERMINISTIC engine over the curated destinations dataset below. Fast, no live lookup — good for "where should I go" ideation. Pass the IATA code of a hop destination.',
    '- search_flights(from, to, depart, return?, adults?): hop\'s REAL, LIVE points-vs-cash verdict for a specific route + date — the SAME engine /search uses (live cash fares + award space). Works for ANY airport, not just the curated destinations below. ALWAYS call this — never price_trip — when the user gives a specific date, or asks about a place outside the destinations dataset.',
    '- ALWAYS call price_trip or search_flights before stating ANY miles, cents-per-point, or affordability number. NEVER invent those numbers — read them from whichever tool actually applies.',
    '- get_weather(place, month): typical/seasonal weather. Use when climate or timing matters.',
    '- web_search(objective): live world-context — events, seasonality, why fares move at a given time. Use sparingly for things the dataset can\'t tell you.',
    '- save_profile_fact(...): REMEMBER a durable personal fact the user states (vacation days, who they travel with, preferred cabin, dietary/accessibility needs, loved/avoided places). Call it whenever the user reveals one. Do not use it for one-off search constraints, and never guess — only record what they actually said.',
    '',
    'Hard rules:',
    '- For open-ended INSPIRATION ("where should I go", "somewhere warm") without a specific date, RECOMMEND from the curated destinations dataset below (match by IATA code) via price_trip. For a SPECIFIC route + date — or any airport not in the dataset — call search_flights instead; it prices any real airport live, so you are not limited to the dataset there. You may freely build itineraries, plans, and give travel advice for ANY place the user names.',
    '- NEVER invent flight prices, fares, miles, CPP, or award availability. Numbers come from price_trip or search_flights; live facts come from web_search/get_weather. Every points/miles/cash/CPP figure in your PROSE must match what the tool actually returned for that exact destination/route — never round it into a different number or imply affordability the engine did not. If a tool reports a degraded section (cash or awards unavailable), say so plainly rather than filling the gap. Never invent visa rules, prices, or hard facts — if unsure, say so or web_search.',
    '- The "Points valuations" table below is a REFERENCE-ONLY typical value per program — never multiply it by a balance yourself to state a dollar figure (e.g. do not say "your 50,000 points are worth $1,200" by doing that math). A specific trip\'s real dollar value, miles needed, or affordability ALWAYS comes from price_trip or search_flights for that exact destination/route, never from this table.',
    '- NEVER sum or multiply the balances and cpp table below yourself to state a total wallet dollar value. If asked what the whole wallet/all points combined are worth, restate ONLY the "Engine-computed wallet dollar value" figure below — never compute your own from the per-program numbers.',
    "- Prefer destinations the user can actually afford with the points they hold.",
    '- Honor the profile: respect dietary/accessibility/cabin needs and NEVER suggest a destination the user listed as avoided.',
    '- After tool calls, weave the real figures into a flowing 1-4 sentence answer. Mention how many points a trip needs and which program books it.',
    '- Write approximations in words ("about 40k", "around $420") — do NOT use a leading "~" before numbers.',
    // PROSE/UI AGREEMENT — the rendered cards and the words must name the SAME
    // places, so a reader never sees "4 great cities" with only 2 cards.
    '- AGREEMENT: every destination you NAME as a recommendation in your prose MUST also be emitted as a verdict_card (or a compare side) in the a2ui spec, and do NOT emit a card for a place you did not mention. If you want to name several places, emit a card for each; if you only want a couple of cards, only name those couple in your prose. Keep the count consistent.',
    hasBalances
      ? "- The user is signed in with real balances, so you MAY speak of \"your points\" and whether they have enough."
      : "- OWNERSHIP: the visitor has NO connected balances, so NEVER say \"your points\", \"you have\", or imply they own any miles. Frame value neutrally — what the route is worth (e.g. \"these miles are worth about 3.1¢ here\", \"points beat cash by about $X on this route\") — and you may invite them to sign in to check their own balances.",
    '',
    'Points valuations (cents per point — typical reference value per program, NOT this-trip-specific; never multiply by a balance):',
    valuationsSummary(liveValuations),
    '',
    "The user's points balances:",
    balancesSummary(context),
    '',
    profileBlock
      ? `What you remember about this traveler (their saved profile):\n${profileBlock}`
      : "You don't have a saved profile for this traveler yet. As they reveal durable facts, save them with save_profile_fact.",
    '',
    historyBlock
      ? `This traveler's past-trip patterns (from their connected travel history):\n${historyBlock}`
      : "No travel history is connected yet (Gmail import is coming soon), so reason only from what they tell you.",
    '',
    // Durable memory of earlier turns that have scrolled off the live thread.
    // CONTEXT ONLY — never authoritative for numbers; always re-check live
    // figures with the tools. Empty string when the memory seam is off/absent.
    memoryBlock
      ? `What you remember from earlier in your history with this traveler (older turns that scrolled off — use it for continuity, but it is NOT a source of prices/miles/CPP; always re-check live figures with your tools):\n${memoryBlock}`
      : '',
    '',
    // Observed behavior: destinations this traveler has repeatedly dismissed.
    // SOFT context only — don't lead with these unless they ask; never treat it
    // as an avoided-destination rule (that's a stated fact) or a source of numbers.
    observedBlock
      ? `Destinations this traveler has repeatedly set aside (dismissed more than once): ${observedBlock}. Don't lead with these unless they bring them up — but if they ask, help fully.`
      : '',
    '',
    context?.homeAirport
      ? `The user flies from ${context.homeAirport.toUpperCase()}. Favor trips that make sense from there and mention it naturally.`
      : "The user hasn't set a home airport. Keep suggestions origin-agnostic, or gently suggest they set one.",
    '',
    'Destinations dataset (code · city · region · vibe [tags] · ~award miles one-way · best program · ~value):',
    destinationsSummary(),
    '',
    a2uiGuidance(profile, !!history?.connected, hasBalances),
  ].join('\n')
}

// Test-only export of the (otherwise private) system-prompt builder, so the
// memory-awareness of the prompt can be asserted without hitting the network.
export function buildAgenticSystemForTest(
  context?: ConciergeContext,
  profile?: TravelProfile,
  history?: TravelHistory,
  liveValuations?: Record<string, number>,
  memory?: string,
  observed?: string,
): string {
  return buildAgenticSystem(context, profile, history, liveValuations, memory, observed)
}

// Build the message list threaded into streamText. Merges any SERVER-persisted
// thread (signed-in users) with the client-sent thread, then appends the current
// question as the final user turn (unless it's already the last message). Pure;
// sanitized + capped via sanitizeMessages so the prompt stays bounded.
export function buildMessages(
  question: string,
  clientMessages: ConversationMessage[] | undefined,
  persisted: ConversationMessage[],
): ConversationMessage[] {
  const client = sanitizeMessages(clientMessages)
  // Prefer the client's thread when it's at least as long (it's the live view);
  // otherwise fall back to the persisted thread. This avoids double-counting the
  // same turns while still recovering history after a fresh page load.
  const base = client.length >= persisted.length ? client : persisted
  const q = question.trim()
  const last = base[base.length - 1]
  const merged =
    last && last.role === 'user' && last.content === q
      ? base
      : [...base, { role: 'user' as const, content: q }]
  return sanitizeMessages(merged)
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
    // Same threshold as the real engine (lib/search) so cards never contradict
    // the MCP verdict()/assembleSearch call for the same destination.
    const verdict: ConciergeSuggestion['verdict'] =
      affordable === false ? 'save' : cpp != null && cpp >= POINTS_THRESHOLD_CPP ? 'points' : 'cash'
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

// Deterministic (no LLM call — this runs when the model is UNREACHABLE) scan
// for a destination the question actually names, by city or IATA code as a
// whole word. The generic fallback previously ignored the question entirely,
// which every persona who hit it during the 2026-07-02 value-prop audit
// flagged as the fallback's biggest gap. Returns [] when nothing matches —
// callers keep their existing generic behavior in that case.
function destinationsMentionedIn(question: string): Destination[] {
  const q = question.toLowerCase()
  return destinations.filter((d) => {
    const cityHit = q.includes(d.city.toLowerCase())
    const codeHit = new RegExp(`\\b${d.code.toLowerCase()}\\b`).test(q)
    return cityHit || codeHit
  })
}

// A graceful, on-brand fallback when we can't reach the model at all.
export function fallbackAnswer(question: string, context?: ConciergeContext): ConciergeResponse {
  const total = context?.totalPoints
  const named = destinationsMentionedIn(question)

  let picks: Destination[]
  let answer: string
  if (named.length > 0) {
    // The user named a real place — lead with THAT instead of generic
    // inspiration, even though the model can't reason about it right now.
    picks = named.slice(0, 3)
    const first = named[0]
    answer =
      total !== undefined && total > 0
        ? `I can't reach my travel brain right now, but here's what I know about ${first.city} — with ~${total.toLocaleString('en-US')} points, check whether it clears the miles below.`
        : `I can't reach my travel brain right now, but here's what I know about ${first.city}.`
  } else if (total !== undefined && total > 0) {
    picks = affordableWith(total).slice(0, 3)
    answer = `I can't reach my travel brain right now, but with ~${total.toLocaleString('en-US')} points a few standout trips come to mind — here are some great-value ideas to get you dreaming.`
  } else {
    picks = [...destinations]
      .sort((a, b) => (computeCpp(b) ?? 0) - (computeCpp(a) ?? 0))
      .slice(0, 3)
    answer = `I can't reach my travel brain right now, but here are a few of the best points-value trips on hop to get you started.`
  }

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
  const verification = await checkBotId()
  if (verification.isBot) {
    return new Response('Access denied', { status: 403 })
  }

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

  // Identity (Auth0). Signed-in → memory persists across visits; signed-out →
  // session-only (we still thread client-sent messages, but persist nothing).
  // getSession never throws here; guard anyway so /ask never 500s.
  let userId: string | undefined
  try {
    const session = await auth0.getSession()
    userId = session?.user?.sub
  } catch {
    userId = undefined
  }

  // RATE LIMIT before any model/tool/DB work. Key on the Auth0 sub when signed in
  // (so a user can't bypass by rotating IPs) AND always on IP (so anonymous abuse
  // is capped). Either bucket being empty limits the request. A limited caller
  // gets a friendly text-stream "slow down" — never a 429 that breaks /ask.
  const ip = clientIp(request)
  const limitKeys = userId ? [`sub:${userId}`, `ip:${ip}`] : [`ip:${ip}`]
  let limited = false
  for (const k of limitKeys) {
    if (!(await checkRateLimit(k, CONCIERGE_RATE)).ok) {
      limited = true
      break
    }
  }
  if (limited) {
    return new Response(
      "You're moving fast — give hop a few seconds to catch its breath, then ask again.",
      { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    )
  }

  // No gateway key → no agentic streaming. Degrade to the curated fallback,
  // served as a text stream so /ask keeps working.
  if (!process.env.AI_GATEWAY_API_KEY) {
    return textStreamFromAnswer(fallbackAnswer(question, context))
  }

  try {
    // Load MEMORY for signed-in users (all helpers degrade to empty, never
    // throw). Anonymous users get empty profile/history + client-only thread.
    const [persisted, profile, history, memory, observed] = userId
      ? await Promise.all([
          getConversation(userId),
          getProfile(userId),
          getTravelHistory(userId),
          getConversationMemory(userId),
          getObservedContext(userId),
        ])
      : [[] as ConversationMessage[], {} as TravelProfile, undefined, '', '']

    const messages = buildMessages(question, body?.messages, persisted)
    const liveValuations = await liveValuationsByName()

    const tools = buildConciergeTools(context?.programs ?? [], userId)
    const result = streamText({
      model: gateway(GATEWAY_MODEL),
      // PostHog LLM analytics → $ai_generation (see instrumentation.ts).
      experimental_telemetry: { isEnabled: true, functionId: 'concierge' },
      system: buildAgenticSystem(context, profile, history, liveValuations, memory, observed),
      // MULTI-TURN: thread the conversation (prior turns + this question) so the
      // agent answers in context. Single-question back-compat is preserved —
      // buildMessages yields a one-element [user] array when there's no history.
      messages,
      tools,
      // Agentic loop: let the model call tools, then continue with the results.
      stopWhen: stepCountIs(5),
      // Never throw to the page — on a streaming error, surface a friendly line.
      onError({ error }) {
        console.error('[concierge] stream error', error)
      },
      // Persist the thread AFTER the answer finishes (signed-in only). Append the
      // assistant's final text to the threaded messages and upsert. Best-effort:
      // saveConversation never throws.
      onFinish({ text }) {
        if (!userId) return
        // Persist the CLEAN prose (without the trailing a2ui fence) so reloaded
        // threads read naturally and don't re-feed the spec back into context.
        const answer = stripA2UIFence(text ?? '').trim()
        const next = answer
          ? [...messages, { role: 'assistant' as const, content: answer }]
          : messages
        void saveConversation(userId, next)
        // Fold older turns into durable memory (gated, fire-and-forget). Uses the
        // FULL prior thread the client resends — not the 40-capped `messages` — so
        // turns past the live window aren't lost. No-ops entirely when disabled.
        const fullPrior = Array.isArray(body?.messages)
          ? (body.messages as ConversationMessage[])
          : []
        const fullThread: ConversationMessage[] = [
          ...fullPrior,
          { role: 'user', content: question },
          ...(answer ? [{ role: 'assistant' as const, content: answer }] : []),
        ]
        void updateConversationMemory(userId, fullThread)
        // Infer durable preferences from the conversation (gated, fire-and-forget).
        // Lands as PENDING "hop noticed" suggestions the user confirms/dismisses in
        // the /account glass box — nothing is ever auto-applied.
        void proposeInferredFacts(userId, fullThread)
      },
    })

    // Stream the answer as live text, but with THREE responsibilities:
    //   1. SURFACE TOOL ACTIVITY: pump the FULL stream so tool-call/result/error
    //      parts become RS-framed control frames the client renders via <Tool>.
    //      RS (char 30) can never appear in prose, so frames never corrupt it.
    //   2. WITHHOLD the trailing ```json a2ui fence from the prose the user sees
    //      (the blocks render it instead). We hold back a small tail so a fence
    //      that's mid-stream is never partially shown.
    //   3. After the prose, append A2UI_SENTINEL + the VALIDATED, engine-
    //      reconciled, personalized block JSON. The client splits on the sentinel.
    // The economics in those blocks come from the engine (reconcileEconomics),
    // never the model — same guarantee as price_trip. Prose is also run through
    // sanitizeProse so load-bearing "~"-figures are never struck out by remark-gfm.
    const balances = context?.programs ?? []
    // True only when the visitor has real balances in play — gates the ownership
    // voice in tool labels + a2ui card framing ("your points" vs "this route").
    const hasBalances = balances.length > 0
    const hasHistory = !!history?.connected
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let full = '' // all model prose (text-delta) accumulated so far
        let emitted = 0 // chars of prose already flushed to the client
        // Once the model starts a fenced block (```), everything from that index
        // on is the a2ui spec (or a partial fence). We must NOT flush from there:
        // buffer it and let stripA2UIFence remove it at the end. -1 = no fence yet.
        let fenceAt = -1
        // Map AI SDK tool-call ids -> our stable frame id + its detail line, so a
        // 'tool-call' (running) and its later 'tool-result'/'tool-error' (done)
        // update the SAME card on the client AND the done frame keeps the specific
        // detail (e.g. "· TYO") instead of collapsing to the generic title.
        // Best-effort; tool framing never blocks prose.
        const toolFrameIds = new Map<string, { id: string; detail?: string }>()
        let toolSeq = 0
        const emitFrame = (frame: ToolActivityFrame) => {
          try {
            controller.enqueue(encoder.encode(encodeToolFrame(frame)))
          } catch (err) {
            console.error('[concierge] tool frame emit error', err)
          }
        }
        // Flush newly-arrived prose up to the fence opener. Mid-stream we hold a
        // 2-char tail so a "```" fence opener split across deltas is never
        // half-flushed. At a tool boundary we pass holdTail=false to flush
        // EVERYTHING first: a fence never precedes the tools, and otherwise the
        // held tail would be emitted AFTER the tool frames — splitting a word
        // (e.g. "right no" … tools … "w!").
        const flushProse = (holdTail = true) => {
          const limit =
            fenceAt === -1 ? (holdTail ? Math.max(0, full.length - 2) : full.length) : fenceAt
          if (limit > emitted) {
            controller.enqueue(encoder.encode(sanitizeProse(full.slice(emitted, limit))))
            emitted = limit
          }
        }
        try {
          // Only 'text-delta' parts feed `full` (the prose + trailing a2ui spec);
          // tool parts become RS-framed control frames the client renders via <Tool>.
          for await (const part of result.fullStream) {
            if (part.type === 'text-delta') {
              full += part.text
              if (fenceAt === -1) {
                const i = full.indexOf('```')
                if (i !== -1) fenceAt = i
              }
              flushProse()
            } else if (part.type === 'tool-call') {
              flushProse(false) // emit ALL prose-so-far before the frame — no mid-word split
              const id = `t${toolSeq++}`
              const detail = toolDetail(part.toolName, part.input, hasBalances)
              toolFrameIds.set(part.toolCallId, { id, detail })
              emitFrame({ id, tool: part.toolName, state: 'input-available', detail })
            } else if (part.type === 'tool-result') {
              flushProse(false)
              const f = toolFrameIds.get(part.toolCallId)
              // Re-send the detail so the done card stays specific ("Priced this
              // route · TYO"), not the bare generic title.
              if (f) emitFrame({ id: f.id, tool: part.toolName, state: 'output-available', detail: f.detail })
            } else if (part.type === 'tool-error') {
              flushProse(false)
              const f = toolFrameIds.get(part.toolCallId)
              if (f) emitFrame({ id: f.id, tool: part.toolName, state: 'output-error', detail: f.detail })
            }
          }
        } catch (err) {
          console.error('[concierge] stream pump error', err)
        }
        // Flush any remaining prose with the a2ui fence stripped off.
        const clean = stripA2UIFence(full)
        if (clean.length > emitted) {
          controller.enqueue(encoder.encode(sanitizeProse(clean.slice(emitted))))
        }
        // Build + append the validated block envelope (best-effort; never throws).
        // canDismiss stamps the "Not for me" affordance only for a signed-in user
        // with the observed-outcomes seam on — dark by default.
        try {
          const canDismiss = !!userId && isObservedOutcomesEnabled()
          const blocks = blocksFromText(full, balances, profile, hasHistory, canDismiss)
          if (blocks.length) {
            controller.enqueue(encoder.encode(A2UI_SENTINEL + JSON.stringify({ blocks })))
          }
        } catch (err) {
          console.error('[concierge] a2ui envelope error', err)
        }
        controller.close()
      },
    })

    return new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    console.error('[concierge] setup failed, serving fallback', err)
    return textStreamFromAnswer(fallbackAnswer(question, context))
  }
}
