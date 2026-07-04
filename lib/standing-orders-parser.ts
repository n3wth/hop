// parseStandingOrder(text): translate a plain-English watch into a validated
// StandingOrderDraft. The AI is a TRANSLATOR ONLY — it maps natural language to
// the engine's SearchParams + thresholds; it never decides economics (the cron
// runs the UNCHANGED assembleSearch and reads hop's own verdict). Output is
// CLAMPED through validateDraft (floors cpp at hop's 2.5 threshold, bounds seats,
// rejects unusable routes), and a deterministic regex fallback handles the
// common case so this works even when the AI Gateway is down. NEVER throws.

import {
  validateDraft,
  parseStandingOrderFallback,
  type StandingOrderDraft,
} from '@/lib/standing-orders-model'
import { callGateway } from '@/lib/ai-gateway'

// Parsers use a cheaper translator than the streaming concierge; override with
// AI_GATEWAY_MODEL (shared default lives in lib/ai-gateway).
const GATEWAY_MODEL = process.env.AI_GATEWAY_MODEL || 'deepseek/deepseek-v3'

// `today` is injected so the model resolves relative dates ("late March") to a
// concrete ISO day in the FUTURE relative to now (the cron is deterministic; the
// translation is the only place dates get resolved).
function systemPrompt(today: string, homeAirport?: string): string {
  return [
    'You translate a traveler\'s plain-English flight WATCH into a strict JSON object.',
    'A watch re-runs a flight search on a schedule and alerts only when an award redemption clears a value bar.',
    'You do NOT reason about price/points/value — only extract the search and the thresholds.',
    '',
    `Today is ${today}. Resolve all relative dates ("late March", "next month", "spring") to concrete future ISO dates (YYYY-MM-DD) AFTER today.`,
    homeAirport
      ? `The traveler's home airport is ${homeAirport}. Use it as the origin when they only name a destination.`
      : 'If no origin is given and you cannot infer one, omit the route and return {}.',
    '',
    'Return ONLY this JSON object, no prose, no markdown fences:',
    '{"params":{"from":"IATA","to":"IATA","depart":"YYYY-MM-DD","return"?:"YYYY-MM-DD","adults":number},"minCpp"?:number,"seats"?:number,"minCabin"?:"economy"|"premium"|"business"|"first","eligiblePrograms"?:string[]}',
    '',
    'Rules:',
    '- from/to: 3-letter IATA airport codes. Map city names to their primary airport (Tokyo→NRT, London→LHR, New York→JFK, San Francisco→SFO, Los Angeles→LAX, Paris→CDG).',
    '- depart: required. If only a month/season is given, pick a representative day in that window (e.g. "late March" → the 25th).',
    '- return: include only for a clearly round-trip request.',
    '- adults/seats: integer 1-9. Default 1. "ping me above 2.5 cpp" with no count → 1.',
    '- minCpp: the cents-per-point bar to alert above. "above 2.5 CPP" → 2.5. Omit if not stated.',
    '- minCabin: lowest acceptable cabin. Only set when a cabin is named.',
    '- eligiblePrograms: loyalty programs the user named. "using points I hold" or "points I have" → leave EMPTY (any held program qualifies). Only list programs explicitly named (e.g. "Alaska", "Aeroplan").',
    '- Omit any field not clearly expressed. Never invent a route. If no usable route, return {}.',
  ].join('\n')
}

// Call the Vercel AI Gateway to translate the text into a draft. Returns a
// validated draft or null when no key / the call fails / the result has no usable
// route. CLAMP: validateDraft keeps only known fields, floors cpp to 2.5, and
// validates the route. NEVER throws.
function aiDraft(
  text: string,
  today: string,
  homeAirport?: string,
): Promise<StandingOrderDraft | null> {
  return callGateway({
    system: systemPrompt(today, homeAirport),
    user: text,
    model: GATEWAY_MODEL,
    maxTokens: 512,
    validate: validateDraft,
  })
}

// Translate a plain-English watch into a StandingOrderDraft.
//
// Strategy (shared with lib/counterfactual-parser): the deterministic fallback runs first (a
// floor we trust, offline). When the AI Gateway is configured it widens — it can
// resolve "late March" and city names the regex can't — and on conflict the
// regex result wins for the unambiguous fields it covers (route, explicit cpp).
// Returns null when neither path produces a usable, route-bearing draft.
export async function parseStandingOrder(
  text: string,
  opts?: { today?: string; homeAirport?: string },
): Promise<StandingOrderDraft | null> {
  const input = (text || '').trim()
  if (!input) return null

  const today = opts?.today ?? new Date().toISOString().slice(0, 10)
  const home = opts?.homeAirport

  const fallback = parseStandingOrderFallback(input, home)
  const ai = await aiDraft(input, today, home)

  if (!ai && !fallback) return null
  if (!ai) return fallback
  if (!fallback) return ai

  // Merge: AI fills gaps (esp. resolved dates/city codes); regex overrides on
  // the unambiguous fields it positively matched. Re-clamp the merged result.
  const merged = {
    ...ai,
    ...fallback,
    // params: prefer the AI's resolved params, but let the regex override the
    // route when it positively matched IATA codes (the AI shouldn't relocate a
    // route the user spelled out). cpp: regex wins when it found an explicit cpp.
    params: { ...ai.params, ...fallback.params },
  }
  return validateDraft(merged)
}
