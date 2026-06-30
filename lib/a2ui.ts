// AGENT-TO-UI (a2ui) — the typed, CLOSED-union spec that lets the concierge emit
// STRUCTURED, ON-BRAND UI instead of plain prose. The model picks a block TYPE
// and fills its STRUCTURED FIELDS; the CLIENT owns rendering
// (components/concierge/A2UIBlock.tsx) — the model never emits HTML, classes, or
// colors, so every block is guaranteed on-brand and safe.
//
// SAFETY MODEL (defense in depth):
//   1. CLOSED union — `type` must be one of the known kinds. Unknown → DROPPED.
//   2. PER-BLOCK validation — every field is type-checked, trimmed, clamped, and
//      length-capped by validateBlock. A malformed field drops just that field
//      (or the block), never crashes the parser or the page.
//   3. ECONOMICS ARE NOT MODEL-AUTHORED — miles/CPP/affordability/verdict on the
//      verdict_card and compare blocks are RE-DERIVED server-side from the engine
//      (price_trip) keyed by IATA code; the model's numbers (if any) are ignored.
//      reconcileEconomics() does this overwrite. So a block can never show a
//      figure the model invented.
//   4. parseA2UI() never throws — garbage in → [] out.
//
// PERSONALIZATION lives in the PROMPT (which blocks to emit) + reconcile (whose
// points): same question → different blocks per the user's profile + balances
// (compare when torn between two; "fits your N days" when vacation_days known;
// cabin surfaced when they fly business; connect_gmail when no history). See
// a2uiGuidance() for the rules handed to the model, and personalizeBlocks() for
// the server-side trims that enforce them regardless of what the model emits.

import {
  priceTrip,
  type PriceTripBalance,
  type PriceTripResult,
} from '@/lib/concierge-tools'
import type { TravelProfile } from '@/lib/travel-profile-model'
import { runCounterfactual, type Mutation } from '@/lib/counterfactual'
import { validateMutation } from '@/lib/counterfactual-parser'
import type { Balance } from '@/lib/types'

// --- Field caps (mirror travel-profile-model's defensive posture) -------------

const MAX_STR = 160 // headline/body/label/reason text
const MAX_SHORT = 48 // codes, city names, short labels
const MAX_CHIPS = 6
const MAX_TIMING_WEEKS = 8
const MAX_BLOCKS = 8

// --- The closed union of block kinds ------------------------------------------

// EXHAUSTIVE list of legal block types. Anything not in here is dropped. Keep in
// sync with the BlockSpec union + validateBlock switch + A2UIBlock.tsx renderer.
export const A2UI_BLOCK_TYPES = [
  'verdict_card',
  'compare',
  'timing',
  'weather',
  'web_note',
  'prompt_chips',
  'profile_confirm',
  'connect_gmail',
  'counterfactual',
] as const
export type A2UIBlockType = (typeof A2UI_BLOCK_TYPES)[number]

// Economics facts re-derived from the engine and stamped onto a block by
// reconcileEconomics. The model never authors these — they're computed.
export interface A2UIEconomics {
  code: string
  city: string
  country: string
  milesNeeded: number
  cashUsd: number
  cpp: number | undefined
  bestProgram: string
  youHave: number | undefined
  affordable: boolean | undefined
  verdict: 'points' | 'cash' | 'save'
}

// verdict_card — THE one-glance call for a single destination. The model picks
// the city (by IATA code) and writes a human `reason`; hop fills `econ` from the
// engine. Optional `fitsDays`/`cabin` are personalization annotations the model
// may add when it knows the user's profile.
export interface VerdictCardBlock {
  type: 'verdict_card'
  code: string
  reason: string
  // Personalization: set when vacation_days is known and the trip "fits".
  fitsDays?: number
  // Personalization: surfaced when the user flies a premium cabin.
  cabin?: string
  // Stamped server-side from price_trip. Never trust a model-supplied value.
  econ?: A2UIEconomics
}

// compare — two destinations side-by-side vs. the user's points. Emitted when
// the traveler is TORN between options. Each side carries its own engine econ.
export interface CompareBlock {
  type: 'compare'
  left: { code: string; reason: string; econ?: A2UIEconomics }
  right: { code: string; reason: string; econ?: A2UIEconomics }
  // Optional one-line nudge ("Lisbon wins on points; Tokyo on vibe").
  takeaway?: string
}

// timing — cheapest-week strip. A small ordered set of week labels with a
// relative cost cue. The model authors labels + a coarse 'low'|'mid'|'high'
// level; it does NOT author dollar figures (those would be invented).
export interface TimingWeek {
  label: string // e.g. "Mar 3" or "week of Mar 3"
  level: 'low' | 'mid' | 'high'
}
export interface TimingBlock {
  type: 'timing'
  place: string
  weeks: TimingWeek[]
  note?: string
}

// weather — a trend chip sourced from get_weather. The model passes through the
// summary fields the tool returned (it doesn't invent climate numbers).
export interface WeatherBlock {
  type: 'weather'
  place: string
  month: string
  highC?: number
  lowC?: number
  summary: string // the tool's `note`
}

// web_note — a cited piece of live context (from web_search). MUST carry a
// source so it reads as sourced, not asserted.
export interface WebNoteBlock {
  type: 'web_note'
  text: string
  source: string // domain or short citation, e.g. "timeout.com"
  url?: string
}

// prompt_chips — suggested follow-up taps. Client renders them as tappable
// chips that seed the next ask.
export interface PromptChipsBlock {
  type: 'prompt_chips'
  chips: string[]
}

// profile_confirm — "I'll remember that" affirmation after save_profile_fact.
// Echoes the durable fact back so the user can see what hop learned.
export interface ProfileConfirmBlock {
  type: 'profile_confirm'
  fact: string // human phrasing, e.g. "You travel as a family"
}

// connect_gmail — the travel-history seam. Emitted when hop would personalize
// better with past-trip data and none is connected. Pure CTA, no model data.
export interface ConnectGmailBlock {
  type: 'connect_gmail'
  reason?: string // why it would help, e.g. "to learn which airlines you fly"
}

// counterfactual — COUNTERFACTUAL YOU inline. The model authors only the MUTATION
// INTENT (op + program names + amount) — the SAME structured shape parseMutation
// produces — and hop runs its deterministic engine (runCounterfactual) against the
// user's real balances to fill `result`. The model NEVER authors the unlock/dollar
// numbers; reconcileEconomics stamps them, mirroring verdict_card's guarantee.
export interface CounterfactualMutationSpec {
  op: 'add' | 'set' | 'swap'
  program?: string // for add/set
  amount?: number // for add/set
  from?: string // for swap
  to?: string // for swap
}
// Engine-derived summary stamped server-side. Never model-authored.
export interface A2UICounterfactual {
  label: string // normalized mutation label, e.g. "+50,000 Chase Ultimate Rewards"
  unlockedCount: number
  dollarValue: number
  unlocked: Array<{ code: string; city: string; countryCode: string; cpp: number | undefined }>
}
export interface CounterfactualBlock {
  type: 'counterfactual'
  mutation: CounterfactualMutationSpec
  // Stamped server-side from runCounterfactual. Never trust a model-supplied value.
  result?: A2UICounterfactual
}

export type A2UIBlock =
  | VerdictCardBlock
  | CompareBlock
  | TimingBlock
  | WeatherBlock
  | WebNoteBlock
  | PromptChipsBlock
  | ProfileConfirmBlock
  | ConnectGmailBlock
  | CounterfactualBlock

// --- Small total helpers (never throw) ----------------------------------------

function str(raw: unknown, cap = MAX_STR): string | undefined {
  if (typeof raw !== 'string') return undefined
  const s = raw.trim().slice(0, cap)
  return s || undefined
}

function num(raw: unknown): number | undefined {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined
}

function strList(raw: unknown, maxItems: number, cap = MAX_STR): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const v of raw) {
    const s = str(v, cap)
    if (s) out.push(s)
    if (out.length >= maxItems) break
  }
  return out
}

function isType(raw: unknown): raw is A2UIBlockType {
  return typeof raw === 'string' && (A2UI_BLOCK_TYPES as readonly string[]).includes(raw)
}

// --- Per-block validation (CLOSED union → unknown dropped) ---------------------

// Validate ONE arbitrary value into a clean A2UIBlock, or null if it isn't a
// usable block of a known type. Pure + total. Strips unknown fields, clamps
// lengths, and requires the minimum fields each block needs to render. Note:
// econ is INTENTIONALLY ignored here — it's stamped later by reconcileEconomics
// so the model can never seed it.
export function validateBlock(raw: unknown): A2UIBlock | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!isType(r.type)) return null

  switch (r.type) {
    case 'verdict_card': {
      const code = str(r.code, MAX_SHORT)
      const reason = str(r.reason)
      if (!code || !reason) return null
      const block: VerdictCardBlock = { type: 'verdict_card', code: code.toUpperCase(), reason }
      const fitsDays = num(r.fitsDays)
      if (fitsDays !== undefined) block.fitsDays = Math.max(0, Math.trunc(fitsDays))
      const cabin = str(r.cabin, MAX_SHORT)
      if (cabin) block.cabin = cabin
      return block
    }

    case 'compare': {
      const side = (v: unknown): { code: string; reason: string } | null => {
        if (!v || typeof v !== 'object') return null
        const o = v as Record<string, unknown>
        const code = str(o.code, MAX_SHORT)
        const reason = str(o.reason)
        if (!code || !reason) return null
        return { code: code.toUpperCase(), reason }
      }
      const left = side(r.left)
      const right = side(r.right)
      if (!left || !right) return null
      const block: CompareBlock = { type: 'compare', left, right }
      const takeaway = str(r.takeaway)
      if (takeaway) block.takeaway = takeaway
      return block
    }

    case 'timing': {
      const place = str(r.place, MAX_SHORT)
      if (!place) return null
      const rawWeeks = Array.isArray(r.weeks) ? r.weeks : []
      const weeks: TimingWeek[] = []
      for (const w of rawWeeks) {
        if (!w || typeof w !== 'object') continue
        const o = w as Record<string, unknown>
        const label = str(o.label, MAX_SHORT)
        const level = o.level
        if (!label) continue
        if (level !== 'low' && level !== 'mid' && level !== 'high') continue
        weeks.push({ label, level })
        if (weeks.length >= MAX_TIMING_WEEKS) break
      }
      if (!weeks.length) return null
      const block: TimingBlock = { type: 'timing', place, weeks }
      const note = str(r.note)
      if (note) block.note = note
      return block
    }

    case 'weather': {
      const place = str(r.place, MAX_SHORT)
      const month = str(r.month, MAX_SHORT)
      const summary = str(r.summary)
      if (!place || !month || !summary) return null
      const block: WeatherBlock = { type: 'weather', place, month, summary }
      const highC = num(r.highC)
      const lowC = num(r.lowC)
      if (highC !== undefined) block.highC = highC
      if (lowC !== undefined) block.lowC = lowC
      return block
    }

    case 'web_note': {
      const text = str(r.text)
      const source = str(r.source, MAX_SHORT)
      if (!text || !source) return null
      const block: WebNoteBlock = { type: 'web_note', text, source }
      const url = str(r.url, MAX_STR)
      // Only accept http(s) URLs — never javascript:/data: etc.
      if (url && /^https?:\/\//i.test(url)) block.url = url
      return block
    }

    case 'prompt_chips': {
      const chips = strList(r.chips, MAX_CHIPS, MAX_SHORT)
      if (!chips.length) return null
      return { type: 'prompt_chips', chips }
    }

    case 'profile_confirm': {
      const fact = str(r.fact)
      if (!fact) return null
      return { type: 'profile_confirm', fact }
    }

    case 'connect_gmail': {
      const block: ConnectGmailBlock = { type: 'connect_gmail' }
      const reason = str(r.reason)
      if (reason) block.reason = reason
      return block
    }

    case 'counterfactual': {
      // Accept ONLY a mutation that survives the same clamp the parser uses, then
      // re-shape it back into the block's spec form. result is left undefined here
      // — it's stamped by reconcileEconomics from the engine.
      const m = r.mutation
      if (!m || typeof m !== 'object') return null
      const valid = validateMutation(m)
      if (!valid) return null
      const spec: CounterfactualMutationSpec =
        valid.op === 'swap'
          ? { op: 'swap', from: valid.from, to: valid.to }
          : { op: valid.op, program: valid.program, amount: valid.amount }
      return { type: 'counterfactual', mutation: spec }
    }

    default:
      // Exhaustiveness guard — a new type in the union without a case here is a
      // compile error. At runtime an unknown type was already dropped by isType.
      return null
  }
}

// --- Top-level parse ----------------------------------------------------------

// Parse an arbitrary value (typically the model's JSON `blocks` array, or the
// whole object) into a clean, capped list of valid blocks. Accepts either an
// array of blocks or an object with a `blocks` array. UNKNOWN block types and
// malformed blocks are silently DROPPED — never throws, never partial-crashes.
export function parseA2UI(raw: unknown): A2UIBlock[] {
  let arr: unknown[]
  if (Array.isArray(raw)) {
    arr = raw
  } else if (raw && typeof raw === 'object' && Array.isArray((raw as { blocks?: unknown }).blocks)) {
    arr = (raw as { blocks: unknown[] }).blocks
  } else {
    return []
  }
  const valid: A2UIBlock[] = []
  for (const item of arr) {
    const block = validateBlock(item)
    if (block) valid.push(block)
  }
  if (valid.length <= MAX_BLOCKS) return valid
  // Over the cap: keep the first MAX_BLOCKS, but ALWAYS preserve a prompt_chips
  // block. It's emitted LAST (per the guidance), so a naive head-slice would drop
  // the very block that drives the follow-up dock — the bug behind "chips don't
  // render" on answers with many cards. Swap it into the kept set if it was cut.
  const kept = valid.slice(0, MAX_BLOCKS)
  if (!kept.some((b) => b.type === 'prompt_chips')) {
    const chips = valid.find((b) => b.type === 'prompt_chips')
    if (chips) kept[kept.length - 1] = chips
  }
  return kept
}

// Index of the close that balances the bracket opened at `start`, or -1. Respects
// string literals + escapes so a brace inside a JSON string never miscounts.
function balancedEnd(s: string, start: number): number {
  const open = s[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

// Every top-level balanced {..}/[..] region in `s` that parses as JSON. A region
// that balances but FAILS to parse (e.g. an itinerary's "{arrival}") is stepped
// over, so the real spec further along is still found. Pure + total.
function scanJsonValues(s: string): unknown[] {
  const out: unknown[] = []
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === '{' || ch === '[') {
      const end = balancedEnd(s, i)
      if (end !== -1) {
        try {
          out.push(JSON.parse(s.slice(i, end + 1)))
        } catch {
          // balanced but not valid JSON — skip past it and keep scanning.
        }
        i = end + 1
        continue
      }
    }
    i++
  }
  return out
}

// Does a parsed value look like the a2ui envelope — an object with a `blocks`
// array, or a bare array of blocks? Used to pick the RIGHT JSON when prose
// contains other braces.
function isA2UIEnvelope(v: unknown): boolean {
  if (Array.isArray(v)) return true
  return !!v && typeof v === 'object' && Array.isArray((v as { blocks?: unknown }).blocks)
}

// Extract the a2ui spec JSON embedded in model text. ROBUST to stray braces in
// prose: it scans every fenced ```json block AND the raw text for balanced JSON,
// then returns the a2ui-shaped value NEAREST THE END (the spec is emitted last),
// preferring fenced matches. The old extractor grabbed the FIRST brace and gave
// up if it didn't parse — so a single "{" in an itinerary lost the whole spec
// (cards AND follow-up chips). Falls back to the first balanced JSON only when
// nothing a2ui-shaped is found. Pure + total — garbage in → null out.
export function extractA2UIJson(text: string): unknown {
  if (typeof text !== 'string') return null
  const fenced: unknown[] = []
  const fence = /```(?:json)?\s*([\s\S]*?)```/gi
  for (let m = fence.exec(text); m; m = fence.exec(text)) {
    for (const v of scanJsonValues(m[1])) fenced.push(v)
  }
  // Whole text with fence markers stripped (fence bodies stay inline) as fallback.
  const raw = scanJsonValues(text.replace(/```(?:json)?/gi, ''))

  const lastEnvelope = (arr: unknown[]): unknown => {
    for (let i = arr.length - 1; i >= 0; i--) if (isA2UIEnvelope(arr[i])) return arr[i]
    return undefined
  }
  const env = lastEnvelope(fenced)
  if (env !== undefined) return env
  const envRaw = lastEnvelope(raw)
  if (envRaw !== undefined) return envRaw
  // Nothing a2ui-shaped — preserve legacy behavior (first balanced JSON anywhere);
  // parseA2UI validates/drops it as needed.
  return fenced[0] ?? raw[0] ?? null
}

// --- Economics reconciliation (engine is the source of truth) -----------------

// Build an A2UIEconomics from the engine's price_trip result. Internal.
function econFromPriceTrip(res: PriceTripResult): A2UIEconomics {
  return {
    code: res.code,
    city: res.city,
    country: res.country,
    milesNeeded: res.milesNeeded,
    cashUsd: res.cashUsd,
    cpp: res.cpp,
    bestProgram: res.bestProgram,
    youHave: res.youHave,
    affordable: res.affordable,
    verdict: res.verdict,
  }
}

// Stamp engine-computed economics onto every block that references a destination
// (verdict_card, compare). Runs hop's DETERMINISTIC engine keyed by IATA code +
// the user's real balances. Any econ the model may have supplied is OVERWRITTEN
// — so the displayed miles/CPP/affordability/verdict ALWAYS come from the engine,
// never the model. A block whose code isn't in the dataset has its econ left
// undefined (the renderer degrades to reason-only). Pure: returns new blocks.
export function reconcileEconomics(
  blocks: A2UIBlock[],
  balances: PriceTripBalance[] = [],
): A2UIBlock[] {
  const price = (code: string): A2UIEconomics | undefined => {
    const res = priceTrip(code, balances)
    return 'error' in res ? undefined : econFromPriceTrip(res)
  }

  // Counterfactual runs the SAME engine (runCounterfactual) over the user's real
  // balances. Map PriceTripBalance -> Balance so transfers.ts can canonicalize.
  const asBalances: Balance[] = balances
    .filter((b) => b && typeof b.program === 'string' && Number.isFinite(b.balance))
    .map((b) => ({ program: b.program, code: '', balance: b.balance }))
  const counterfactual = (spec: CounterfactualBlock['mutation']): A2UICounterfactual | undefined => {
    const mutation: Mutation | null =
      spec.op === 'swap'
        ? spec.from && spec.to
          ? { op: 'swap', from: spec.from, to: spec.to }
          : null
        : spec.program != null && spec.amount != null
          ? { op: spec.op, program: spec.program, amount: spec.amount }
          : null
    if (!mutation) return undefined
    const res = runCounterfactual(asBalances, mutation)
    return {
      label: res.mutation.label,
      unlockedCount: res.unlockedCount,
      dollarValue: res.dollarValue,
      unlocked: res.unlocked
        .slice(0, 6)
        .map((d) => ({ code: d.code, city: d.city, countryCode: d.countryCode, cpp: d.cpp })),
    }
  }

  return blocks.map((b) => {
    if (b.type === 'verdict_card') {
      return { ...b, econ: price(b.code) }
    }
    if (b.type === 'compare') {
      return {
        ...b,
        left: { ...b.left, econ: price(b.left.code) },
        right: { ...b.right, econ: price(b.right.code) },
      }
    }
    if (b.type === 'counterfactual') {
      return { ...b, result: counterfactual(b.mutation) }
    }
    return b
  })
}

// --- Personalization ----------------------------------------------------------

// PROMPT-SIDE rule text handed to the model: WHICH blocks to emit for THIS user.
// This is what makes the same question render differently per traveler. The
// model still only chooses block TYPE + fields; personalizeBlocks() enforces the
// outcome server-side regardless.
export function a2uiGuidance(
  profile: TravelProfile | undefined,
  hasHistory: boolean,
  hasBalances = false,
): string {
  const lines: string[] = ([
    'GENERATIVE UI (a2ui): alongside your prose, you MAY emit a typed UI spec so hop renders branded, tailored cards instead of plain text.',
    'Emit it as a fenced ```json block containing {"blocks": [ ... ]} as the LAST thing in your reply. Use ONLY these block types and fields:',
    '- verdict_card { type, code (IATA), reason } — the one-glance call for ONE destination. Do NOT put miles/cpp/affordability in it; hop fills those from the engine.',
    '- compare { type, left:{code,reason}, right:{code,reason}, takeaway? } — when the traveler is TORN between two destinations, show them side-by-side.',
    // The cards and the prose must agree — a reader should never see a place
    // named in words with no matching card, or a card for a place never mentioned.
    'AGREEMENT: emit exactly one verdict_card (or compare side) for each destination you NAME in your prose, and name in your prose every destination you emit a card for. The set of places in your words and the set in your cards must match.',
    hasBalances
      ? null
      : 'OWNERSHIP: this visitor has NO connected balances. In card `reason` text frame value neutrally (what the route is worth, points vs cash) — never write "your points" or "you have"; hop renders these as a value demonstration, not owned balances.',
    '- timing { type, place, weeks:[{label, level:"low"|"mid"|"high"}], note? } — a cheapest-week strip. Use coarse levels, never invent dollar amounts.',
    '- weather { type, place, month, highC?, lowC?, summary } — pass through what get_weather returned; do not invent climate numbers.',
    '- web_note { type, text, source, url? } — a cited live fact from web_search. ALWAYS include the source.',
    '- prompt_chips { type, chips:[string] } — ALWAYS end your reply with this block: 3-4 SHORT (≤24 chars) follow-up taps that advance THIS specific conversation. Make them concrete next steps tied to what was just discussed — e.g. after a Tokyo verdict: "Build a 5-day plan", "Cheaper in May?", "Add Kyoto", "Compare with Seoul". Never generic ("Tell me more"), never the same chips every turn.',
    '- profile_confirm { type, fact } — after save_profile_fact, echo the durable fact you remembered.',
    '- connect_gmail { type, reason? } — invite the user to connect Gmail so hop can learn from past trips.',
    '- counterfactual { type, mutation:{op:"add"|"set"|"swap", program?, amount?, from?, to?} } — when the user asks "what if I had a different points portfolio?". Author ONLY the mutation intent (use program brand names as the user said them); hop runs its engine to fill what unlocks and the dollar value. Use "add" for more of a program, "set" for an exact target, "swap" for holding one program instead of another (from/to).',
    'PROACTIVE COUNTERFACTUAL: when price_trip shows affordable===false for a destination the traveler is clearly drawn to, do not just say "save toward it" — emit a counterfactual block with op:"add" proposing the SMALLEST realistic top-up of a transferable program the traveler ALREADY holds that would cross the line (hop computes what else that unlocks and the dollar value). When TWO destinations are both a stretch and both in play, prefer a compare block instead.',
    'Rules: pick the block TYPE that fits; never emit HTML, styles, or block types not listed. Cards (verdict_card/compare/timing/weather) are OPTIONAL — omit them when prose or an itinerary reads better — but ALWAYS include a prompt_chips block at the end. Never author counterfactual unlock counts or dollar values — hop computes them.',
  ] as (string | null)[]).filter((l): l is string => l != null)

  // Personalization nudges — tuned to THIS user's profile + history.
  const pers: string[] = []
  if (profile?.vacationDays !== undefined) {
    pers.push(
      `This traveler has ${profile.vacationDays} vacation days/year — when a trip fits, set verdict_card.fitsDays so hop can show "fits your ${profile.vacationDays} days".`,
    )
  }
  if (profile?.cabin && (profile.cabin === 'business' || profile.cabin === 'first')) {
    pers.push(
      `This traveler flies ${profile.cabin} — set verdict_card.cabin to "${profile.cabin}" so hop surfaces the cabin in the card.`,
    )
  }
  if (!hasHistory) {
    pers.push(
      'No travel history is connected — when past-trip data would sharpen your answer, emit a connect_gmail block (at most once).',
    )
  }
  if (pers.length) {
    pers.unshift('Personalize for THIS traveler:')
    return [...lines, '', ...pers].join('\n')
  }
  return lines.join('\n')
}

// SERVER-SIDE enforcement of personalization, applied AFTER validation +
// reconcile, so the rendered blocks are tailored regardless of what the model
// emitted. Same question → different blocks per profile/history:
//   • drops verdict_card.fitsDays/cabin annotations the model can't justify
//     (no vacation_days known → no "fits N days"; non-premium cabin → no cabin),
//   • drops connect_gmail when history IS connected (nothing to invite),
//   • keeps everything else. Pure: returns new blocks, never mutates inputs.
export function personalizeBlocks(
  blocks: A2UIBlock[],
  profile: TravelProfile | undefined,
  hasHistory: boolean,
): A2UIBlock[] {
  const out: A2UIBlock[] = []
  for (const b of blocks) {
    if (b.type === 'connect_gmail') {
      // Nothing to invite if history is already connected.
      if (hasHistory) continue
      out.push(b)
      continue
    }
    if (b.type === 'verdict_card') {
      const next: VerdictCardBlock = { ...b }
      // Only keep "fits your N days" when we actually know the user's days AND
      // the annotation is consistent with it.
      if (profile?.vacationDays === undefined) {
        delete next.fitsDays
      } else if (next.fitsDays !== undefined) {
        // Re-stamp from the known profile so a model can't claim a wrong number.
        next.fitsDays = profile.vacationDays
      }
      // Only surface a cabin when the user flies premium.
      const flysPremium = profile?.cabin === 'business' || profile?.cabin === 'first'
      if (!flysPremium) {
        delete next.cabin
      } else if (next.cabin) {
        next.cabin = profile!.cabin!
      }
      out.push(next)
      continue
    }
    out.push(b)
  }
  return out
}
