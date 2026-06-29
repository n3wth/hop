// Narration helpers for THE LEDGER DREAM — pure, no I/O, fully unit-testable.
// The ENGINE (lib/ledger-dream) picks the trip and every number; these functions
// only build the PROMPT the model narrates with, and a deterministic TEMPLATED
// blurb used as the graceful fallback (no gateway / stream error). Neither
// invents economics: the template only restates engine facts, and the prompt
// forbids the model from changing any figure.

import type { LedgerDream } from '@/lib/ledger-dream'

function compactMiles(n: number): string {
  const k = n / 1000
  return `${Number.isInteger(k) ? k : k.toFixed(1)}k`
}
function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

// The exact facts the narrator is allowed to use — all from the engine. The model
// gets these and ONLY these; it may not introduce new numbers.
export function dreamFacts(dream: LedgerDream): string {
  const d = dream.destination
  const lines = [
    `City: ${d.city}, ${d.country}`,
    `Vibe: ${d.vibe}`,
    `Award needed: ${compactMiles(dream.milesNeeded)} miles, one way`,
    `Books in: ${dream.proof.program}`,
    `Cash this replaces: about ${money(dream.cashValue)}`,
  ]
  if (dream.cpp !== undefined) lines.push(`Value: ${dream.cpp.toFixed(1)} cents per point`)
  if (dream.proof.transferFrom) {
    lines.push(
      `How they afford it: transfer ${dream.proof.transferFrom.source} → ${dream.proof.program} (${dream.proof.transferFrom.ratio})`,
    )
  } else if (dream.via?.kind === 'direct') {
    lines.push(`How they afford it: held directly in ${dream.proof.program}`)
  } else {
    lines.push(`How they afford it: a dream to save toward — they can't book it yet`)
  }
  return lines.join('\n')
}

// Deterministic templated blurb — the graceful fallback when AI is unavailable.
// Second-person, evocative-but-honest, and grounded in the engine's facts.
export function templatedBlurb(dream: LedgerDream): string {
  const d = dream.destination
  const miles = compactMiles(dream.milesNeeded)
  if (dream.saveToward) {
    return `${d.city} is waiting — ${d.vibe}. About ${miles} miles in ${dream.proof.program} books it one way, roughly ${money(dream.cashValue)} of flying for points you're closer to than you think. Keep stacking, and this becomes real.`
  }
  if (dream.proof.transferFrom) {
    return `You land in ${d.city} — ${d.vibe} — for about ${miles} miles, ${money(dream.cashValue)} of airfare you simply don't pay. Move ${dream.proof.transferFrom.source} to ${dream.proof.program} at ${dream.proof.transferFrom.ratio} and it's yours. The points are already in your pocket.`
  }
  return `You wake up in ${d.city} — ${d.vibe} — for about ${miles} miles you already hold in ${dream.proof.program}. That's ${money(dream.cashValue)} of flying, paid in points. No catch, no saving for it. Just go.`
}

// Build the narration prompt. Pure + testable. The model NARRATES the pick — it is
// forbidden from changing any number or inventing new ones.
export function buildDreamPrompt(dream: LedgerDream): { system: string; user: string } {
  const system = [
    "You are hop's voice writing a single 'Dream of the Week' — one short, cinematic, second-person blurb about ONE specific trip the reader can take with their points.",
    '',
    "The trip and EVERY number have already been chosen by hop's engine. Your ONLY job is to make this specific trip feel vivid and within reach.",
    '',
    'Hard rules:',
    '- Write in SECOND PERSON ("You step off the plane in...").',
    '- 2-3 sentences. Evocative but never purple or sloppy — earn every word. No emoji. No exclamation pile-ups.',
    '- Ground it in the engine facts below. You may mention the miles, the cash it replaces, and the transfer/path, but you MUST use the exact figures given — do not round them into different numbers or invent any new ones (no made-up flight names, prices, dates, or cabins not listed).',
    '- The feeling: inspiration generated from their wealth, not filtered by it. Make the affordability the quiet flex, not a sales pitch.',
    '- Output ONLY the blurb prose. No headings, no quotes around it, no markdown.',
  ].join('\n')

  const user = [
    'Write the Dream of the Week blurb for this exact trip. Use only these facts:',
    '',
    dreamFacts(dream),
  ].join('\n')

  return { system, user }
}
