export const meta = {
  name: 'magical-ask-prefs',
  description: 'Make Ask feel magical (streaming generative UI) + one AI natural-language preference layer applied site-wide',
  phases: [
    { title: 'Foundation', detail: 'AI preference primitive: parse NL -> constraints, persist, engine ranking' },
    { title: 'Magic', detail: 'streaming concierge + generative reveal experience' },
    { title: 'Weave', detail: 'apply prefs across search/deals; narrate the why' },
    { title: 'Verify', detail: 'tsc + tests + build + visual' },
  ],
}

const REPO = '/Users/n3wth/code/hop/hopapp'
const RULES = `PROJECT RULES (non-negotiable): Next.js 16 — READ node_modules/next/dist/docs/01-app/ before any route/page/server-action code; heed AGENTS.md. No emojis. Flat design (no shadows/gradients-as-decoration/glows/translucency for UI; hover=color only, no vertical movement; ALL motion reduced-motion-safe via prefers-reduced-motion). Brand tokens only (var(--color-brand), brand-deep, brand-light, bg, paper, surface, sunk, border, text/text2/text3; font-display Bricolage, body General Sans). 2-space, single quotes, no semicolons. Read before edit. Never throw to the page. Per-user data keyed by Auth0 session.user.sub via utils/supabase/admin.ts. Keep all vitest tests green; run npx tsc --noEmit (0) + npx vitest run after changes. Dev server on :3003.`
const THESIS = `hop's differentiation thesis: the LLM NEVER originates economics/decisions — it TRANSLATES natural language into engine inputs and NARRATES the engine's deterministic output. assembleSearch(params, balances) is the pure verdict engine. Magic = the AI as a living input+narrator surface over that engine, not a chatbot.`

// ── FOUNDATION: the preference primitive ──
phase('Foundation')
const prefPrimitive = await agent(
  `${RULES}\n${THESIS}\n\nTASK: Build the AI NATURAL-LANGUAGE PREFERENCE LAYER in ${REPO}. Users express travel prefs in plain language ("nonstop only", "business class to Tokyo", "I won't connect", "cheapest possible") and hop applies them to the verdict — NO new filter UI. Pieces:
1. lib/prefs-model.ts: a TravelPrefs type { maxStops?: number, minCabin?: 'economy'|'premium'|'business'|'first', preferNonstop?: boolean, ... keep MINIMAL — only what clearly matters} + a pure applyPrefs(options, prefs) that RE-RANKS/filters FlightOption[] by prefs (e.g. preferNonstop -> nonstop first; minCabin -> filter/deprioritize below it) layered ON TOP of the existing cpp ranking in lib/cpp.ts (don't replace cpp ranking; prefs are a tiebreaker/filter). FlightOption already has cabin/stops/direct (lib/types.ts).
2. A parser: parseTravelPrefs(text) that uses the AI (reuse the AI Gateway pattern in app/api/concierge/route.ts — callConcierge/AI_GATEWAY_API_KEY, structured JSON output) to translate freeform text -> TravelPrefs, with a deterministic regex fallback for common cases (nonstop, business, first) so it works even when AI is down. CLAMP/validate AI output to the enum (never let it invent fields).
3. Persist per-user: extend lib/prefs.ts (getPrefs/setPrefs) + the hop_user_prefs Supabase table to store a travel_prefs jsonb column (the table exists; add the column via a note to the orchestrator — DO NOT run DDL yourself, report the exact ALTER TABLE needed). Remembered like home airport.
4. Wire applyPrefs into lib/search.ts assembleSearch so the verdict ranking respects stored prefs (pass prefs through; default = today's behavior when no prefs).
Add vitest tests for applyPrefs + parseTravelPrefs fallback. Report: the TravelPrefs shape, the exact ALTER TABLE SQL the orchestrator must run, and how applyPrefs composes with cpp ranking.`,
  { label: 'foundation:pref-layer', phase: 'Foundation', effort: 'high',
    schema: { type: 'object', additionalProperties: false, required: ['files','prefsShape','alterTableSql','rankingComposition','tscClean'], properties: {
      files: { type: 'array', items: { type: 'string' } },
      prefsShape: { type: 'string' },
      alterTableSql: { type: 'string' },
      rankingComposition: { type: 'string' },
      tscClean: { type: 'boolean' },
    } } },
)

// ── MAGIC: streaming generative-UI concierge ──
phase('Magic')
const magic = await agent(
  `${RULES}\n${THESIS}\n\nTASK: Make /ask feel MAGICAL — "like no travel site ever." Today the concierge is ONE-SHOT (components/Concierge.tsx does await res.json(), shows a dead spinner, then a static card). Transform it into a STREAMING GENERATIVE experience:
1. Stream the response: convert app/api/concierge/route.ts to STREAM (Server-Sent Events or a ReadableStream) — the AI Gateway supports stream:true on /v1/chat/completions. The answer text TYPES OUT live as it generates; the verdict cards MATERIALIZE one-by-one as they're parsed from the stream (not all-at-once after a wait). Keep the existing non-streaming contract working as a fallback (and keep enrichSuggestions server-side verdict facts — those are computed, not streamed).
2. The reveal choreography (components/Concierge.tsx): answer streams in like a thoughtful reply being written; each verdict card animates in on a gentle stagger as it arrives (reuse hop-rise / add a tasteful card-reveal keyframe in globals.css, reduced-motion-safe); the verdict numbers COUNT UP (reuse components/CountUp.tsx). It should feel like hop is THINKING and composing an answer for you, live.
3. Moments of delight (Anthropic-UX-engineer taste — subtle, purposeful, never gratuitous): a living placeholder that cycles evocative prompts; the bunny reacting subtly when an answer lands; a "thinking" state that feels alive not a generic spinner; micro-interactions on the cards. ALL reduced-motion-safe and flat (no gratuitous bounce).
4. Keep it app-like/immersive (the page already aims for no-scroll/immersive). Make landing on /ask feel inspiring and alive, not dull.
Be tasteful and restrained — magical, not noisy. Report exactly what you changed and what a user now SEES/FEELS that they didn't before. Verify tsc + the streaming path works against the live gateway on :3003.`,
  { label: 'magic:streaming-ask', phase: 'Magic', effort: 'high', isolation: 'worktree',
    schema: { type: 'object', additionalProperties: false, required: ['files','whatChanged','feelsDifferent','tscClean','testsPass'], properties: {
      files: { type: 'array', items: { type: 'string' } },
      whatChanged: { type: 'string' },
      feelsDifferent: { type: 'string' },
      tscClean: { type: 'boolean' },
      testsPass: { type: 'boolean' },
    } } },
)

// ── WEAVE: prefs + AI narration across the site ──
phase('Weave')
const weave = await agent(
  `${RULES}\n${THESIS}\n\nTASK: WEAVE the AI preference layer + narration across the site in ${REPO}, using lib/prefs-model.ts (just built — applyPrefs/parseTravelPrefs/TravelPrefs) and the persisted travel_prefs. Goals:
1. The verdict (lib/search.ts / components/VerdictRail.tsx) should NARRATE when prefs shaped it: e.g. "Nonstop ANA business — ranked first because you prefer nonstop." Add a short, honest pref-aware line to the verdict when prefs are active (engine decides, narration explains).
2. Let users SET prefs in natural language from the search/ask surfaces without new filter chips: e.g. the concierge can parse "nonstop business to Tokyo" into BOTH a route AND prefs (persist the prefs). If there's a search-related natural-language entry point, wire parseTravelPrefs there. Keep UI minimal — prefer an unobtrusive "remembered: nonstop, business · change" chip over a filter panel.
3. Apply prefs to /deals and the signed-in home destination ranking too where it makes sense (so the whole site reflects what the user cares about).
Keep everything minimal and on-thesis (AI translates/narrates; engine ranks). Don't add heavy UI. Report what you wove where, and the exact user-visible narration examples.`,
  { label: 'weave:prefs-site', phase: 'Weave', effort: 'high', isolation: 'worktree',
    schema: { type: 'object', additionalProperties: false, required: ['files','wovenWhere','narrationExamples','tscClean'], properties: {
      files: { type: 'array', items: { type: 'string' } },
      wovenWhere: { type: 'array', items: { type: 'string' } },
      narrationExamples: { type: 'array', items: { type: 'string' } },
      tscClean: { type: 'boolean' },
    } } },
)

phase('Verify')
const verify = await agent(
  `In ${REPO}: agents built an AI preference layer (lib/prefs-model.ts, search ranking), a streaming/generative magical /ask (concierge route + Concierge.tsx, may be in a worktree), and site-wide pref weaving (may be in a worktree). (1) Report the MAIN working tree git status. (2) Run npx tsc --noEmit and npx vitest run; report exact results. (3) Note any worktree branches to merge + conflicts. (4) Confirm the streaming /ask actually works against the live gateway on :3003 (curl the streaming endpoint or load the page) — describe what you observe. (5) Give the orchestrator a precise integration punch-list (branches to merge, the ALTER TABLE to run for travel_prefs, conflicts, follow-ups). Diagnose, don't sweep.`,
  { label: 'verify:integration', phase: 'Verify', effort: 'high',
    schema: { type: 'object', additionalProperties: false, required: ['mainTreeState','tscResult','vitestResult','streamingWorks','conflicts','punchList'], properties: {
      mainTreeState: { type: 'string' },
      tscResult: { type: 'string' },
      vitestResult: { type: 'string' },
      streamingWorks: { type: 'string' },
      conflicts: { type: 'array', items: { type: 'string' } },
      punchList: { type: 'array', items: { type: 'string' } },
    } } },
)

return { prefPrimitive, magic, weave, verify }
