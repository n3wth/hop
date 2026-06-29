export const meta = {
  name: 'conversational-concierge',
  description: 'Turn Ask into a personal travel agent: multi-turn, remembers you, web search + weather, deliberates and decides',
  phases: [
    { title: 'AgentCore', detail: 'AI SDK + tool-use foundation (web search, weather), streaming' },
    { title: 'Memory', detail: 'multi-turn thread + personal profile (vacation days, life facts) persisted' },
    { title: 'A2UI', detail: 'agent emits typed UI-spec -> branded generative components, personalized by profile+points' },
    { title: 'Guide', detail: 'conversational travel-agent UI: thread, deliberation, generative cards + tool results inline' },
    { title: 'Verify', detail: 'tsc + tests + build + live multi-turn + tool-call + a2ui render check' },
  ],
}

const REPO = '/Users/n3wth/code/hop/hopapp'
const RULES = `PROJECT RULES (non-negotiable): Next.js 16 — READ node_modules/next/dist/docs/01-app/ before any route/page/server-action/streaming code; heed AGENTS.md. No emojis. Flat design (no shadows/gradients-as-decoration/glows/translucency for UI; hover=color only, no vertical movement; ALL motion reduced-motion-safe). Brand tokens only (var(--color-brand), brand-deep, brand-light, bg, paper, surface, sunk, border, hair, text/text2/text3; font-display Bricolage, body General Sans). 2-space, single quotes, no semicolons. Read before edit. Never throw to the page. Per-user data keyed by Auth0 session.user.sub via utils/supabase/admin.ts (service-role). Keep all vitest tests green; run npx tsc --noEmit (0) + npx vitest run after changes. Dev :3003.`
const THESIS = `hop's thesis stays intact: the deterministic engine (assembleSearch/enrichSuggestions/effectiveBalanceFor) computes all POINTS economics — miles, CPP, affordability — and the LLM never invents those numbers. NEW: the LLM is now a PERSONAL TRAVEL AGENT that (a) holds a real multi-turn conversation and helps you DECIDE ("hmm not sure between Tokyo and Lisbon" -> it weighs both against your points), (b) uses TOOLS for live world-context it can't know — web search (events, why fares spike at a given time, seasonality) + weather trends, (c) GETS TO KNOW YOU over time (vacation days, who you travel with, preferences) and uses it. Tool/web results are clearly attributed; points math still comes only from the engine. The streaming generative Ask (typing answer, materializing verdict cards) was built just before — BUILD ON IT.`

phase('AgentCore')
const core = await agent(
  `${RULES}\n${THESIS}\n\nTASK: Upgrade the concierge to an AGENTIC, TOOL-USING core in ${REPO}. Today app/api/concierge/route.ts calls the gateway via raw fetch, single-shot. Move it to the Vercel AI SDK (the `ai` package — install it; it's the supported path for tools+streaming through the AI Gateway with model strings like 'anthropic/claude-sonnet-4-6' or the configured AI_GATEWAY_MODEL). Implement streamText with TOOLS:
1. WEB SEARCH: gateway.tools.parallelSearch() (or perplexitySearch) — the model calls it for live context: current events at a destination, WHY fares are higher/lower at a given time, seasonality, festivals, travel advisories. (Docs: https://vercel.com/docs/ai-gateway/models-and-providers/web-search)
2. WEATHER: a custom tool get_weather/get_weather_trends (free API e.g. open-meteo, no key — fetch server-side) returning typical/forecast conditions for a destination+month so the agent can speak to weather trends.
3. hop's OWN engine as tools the model can call (this keeps economics deterministic): e.g. a 'price_trip' / 'value_for_user' tool that runs the real CPP/affordability logic (computeCpp, effectiveBalanceFor, destinations data) for a destination + the user's balances, so when the agent quotes points/CPP/"you can afford it", the NUMBERS come from the engine via the tool, not the model. Wire these as AI SDK tools with zod/JSON schemas.
4. Keep streaming (typing answer; tool-call + tool-result events surfaced so the UI can show "searching the web…"/"checking weather…"). Preserve graceful fallback when the gateway/tools are down (never 500; degrade to the curated answer). Keep AI_GATEWAY_MODEL override; tool-use may need a stronger model than DeepSeek — make the model configurable and note if Claude is recommended for reliable tool-calling.
Report: the tools you wired (with their schemas), how the engine-as-tool keeps economics deterministic, and tsc results. Add unit tests for the tool implementations (weather fetch parse, price_trip via engine).`,
  { label: 'core:agentic-tools', phase: 'AgentCore', effort: 'high',
    schema: { type: 'object', additionalProperties: false, required: ['files','tools','economicsDeterministic','modelNote','tscClean'], properties: {
      files: { type: 'array', items: { type: 'string' } },
      tools: { type: 'array', items: { type: 'string' }, description: 'tool name + purpose' },
      economicsDeterministic: { type: 'string' },
      modelNote: { type: 'string' },
      tscClean: { type: 'boolean' },
    } } },
)

phase('Memory')
const memory = await agent(
  `${RULES}\n${THESIS}\n\nTASK: Give the concierge MEMORY in ${REPO} — both the conversation thread AND a growing personal profile, on top of the agentic core just built.
1. Multi-turn contract: ConciergeRequest carries messages: Array<{role:'user'|'assistant', content}> (the thread), threaded into the streamText call so the agent answers in context ("between those two…"). Keep a back-compat single-question path.
2. Conversation persistence: Supabase table hop_conversations { id uuid pk, user_id text, messages jsonb, updated_at }. Add lib/conversations.ts (getConversation/saveConversation, service-role, scoped by Auth0 sub, never throws). Signed-in = remembered across visits; signed-out = session-only.
3. PERSONAL PROFILE (the "gets to know you" part): a structured, growing profile — vacation_days (per year / remaining), travel_party (solo, partner, kids), cabin/seat preferences, dietary or accessibility notes, loved/avoided destinations, home airport (already exists in prefs). Store as travel_profile jsonb on hop_user_prefs (extend lib/prefs.ts + the existing prefs model). The AGENT can READ this profile (fed into the system prompt) AND UPDATE it via a tool save_profile_fact({field, value}) when the user reveals something ("I only get 10 days off", "I always fly with my partner") — clamp/validate fields, never store free-form junk. The user stays in control: surface what's remembered and let them edit/clear it.
4. CONNECT GMAIL -> TRAVEL HISTORY (PLACEHOLDER for now, but build the seam properly): a "Connect Gmail" capability so the agent can learn the user's REAL travel history from past booking/confirmation emails — where they go, when they travel, favored airlines/hotels, trip cadence/patterns. For NOW: (a) build the UI affordance (a "Connect Gmail" card on /account or in the agent that explains: hop reads past trip confirmations to learn your travel patterns; clearly states it's coming soon / not yet live), (b) define a clean interface lib/travel-history.ts: getTravelHistory(userId): Promise<TravelHistory> where TravelHistory is a typed shape (past trips: {destination, dates, airline?, cabin?}, derived patterns: {usualMonths, favoriteRegions, typicalCabin, tripsPerYear}) — return an EMPTY/STUB result for now (no real Gmail call), with a clear TODO + a note that the real source will be Gmail OAuth (there's a Gmail MCP in the stack) and/or AwardWallet's email-parsing API (we have a key). (c) Wire the agent to READ travel-history (fed into the prompt alongside the profile) and a 'connect_gmail' a2ui block / prompt that invites connecting — so the moment the real ingestion lands, the agent already uses it. DO NOT implement real Gmail OAuth/parsing now — just the seam + placeholder + UI. Report exactly what's stubbed and what wiring the real version needs.
I (orchestrator) will CREATE the tables/columns — do NOT run DDL; report the exact SQL (CREATE TABLE hop_conversations + ALTER TABLE hop_user_prefs ADD travel_profile + any travel_history table you want when it goes real + RLS/policies). Add tests for getConversation/saveConversation + profile validation + travel-history stub shape. Report the contract, the SQL, how profile + history + travel-history feed the prompt, and the Gmail placeholder seam.`,
  { label: 'memory:thread-profile', phase: 'Memory', effort: 'high',
    schema: { type: 'object', additionalProperties: false, required: ['files','sql','profileShape','tscClean'], properties: {
      files: { type: 'array', items: { type: 'string' } },
      sql: { type: 'string', description: 'all CREATE TABLE / ALTER TABLE + RLS the orchestrator must run' },
      profileShape: { type: 'string' },
      tscClean: { type: 'boolean' },
    } } },
)

phase('Guide')
phase('A2UI')
const a2ui = await agent(
  `${RULES}\n${THESIS}\n\nTASK: Build the AGENT-TO-UI (a2ui / generative UI) layer in ${REPO} — this is what makes the experience feel TAILORED TO YOU. Instead of the agent only replying in prose, it emits a typed UI SPEC and the client renders branded hop components from it, so the interface itself is composed per-user, per-moment. Build:
1. A typed UI-spec contract (lib/a2ui.ts): a small, CLOSED set of block types the agent may emit in its structured output, e.g.:
   - 'verdict_card' { destinationCode, ... } -> renders the points-vs-cash verdict (numbers from the engine/enrichSuggestions, NOT the model)
   - 'compare' { options: [destA, destB] } -> side-by-side comparison (your points for each, CPP, weather, the call) — for "not sure between these two"
   - 'timing' { destinationCode, months[] } -> a cheapest-week / price-over-time strip (seasonality)
   - 'weather' { destinationCode, month } -> weather-trend chip (from the weather tool)
   - 'web_note' { claim, sources[] } -> a cited live-context note (from web search)
   - 'prompt_chips' { chips[] } -> suggested follow-ups
   - 'profile_confirm' { field, value } -> "want me to remember you get 10 days off?" inline confirm
   Keep it a CLOSED union (validate/clamp on the client — never render arbitrary model HTML; the model picks block TYPE + structured fields, the client owns the rendering = safe + on-brand).
2. The agent's structured output (from the concierge route) returns answer text PLUS an ordered list of these blocks; the model CHOOSES which blocks fit the moment + the user's profile (e.g. surface cabin when it knows you fly business; render 'compare' when you're torn; render trips as "fits your 10 days" when vacation_days is known).
3. A renderer (components/concierge/A2UIBlock.tsx) mapping each block type -> a flat, on-brand hop component, personalized by the user's profile + points. Reuse existing verdict-card visuals. Reduced-motion-safe, no emoji.
Personalization is the POINT: two users asking the same thing should get DIFFERENT UI based on what hop knows about them. Add tests for the spec validation (unknown block type -> dropped, never crashes). Report the block union, how the model is constrained to emit only valid blocks, and how profile drives which blocks appear.`,
  { label: 'a2ui:generative-ui', phase: 'A2UI', effort: 'high',
    schema: { type: 'object', additionalProperties: false, required: ['files','blockTypes','safety','personalization','tscClean'], properties: {
      files: { type: 'array', items: { type: 'string' } },
      blockTypes: { type: 'array', items: { type: 'string' } },
      safety: { type: 'string', description: 'how arbitrary/unsafe model UI is prevented (closed union, client-owned render)' },
      personalization: { type: 'string', description: 'how profile+points drive which blocks render' },
      tscClean: { type: 'boolean' },
    } } },
)

phase('Guide')
const guide = await agent(
  `${RULES}\n${THESIS}\n\nTASK: Rebuild components/Concierge.tsx (+ app/ask/page.tsx) into a PERSONAL TRAVEL AGENT conversation in ${REPO}, on the agentic + memory + A2UI foundation just built (render agent turns via the A2UIBlock renderer + lib/a2ui spec, not just prose). It should feel like texting a brilliant travel agent who knows you and the world — NOT a search box. Requirements:
1. Conversation thread: stacked turns; the agent's replies stream in (typing); verdict cards materialize inside the agent's turns; a persistent composer to keep talking; auto-scroll to latest.
2. Tool transparency as delight: when the agent uses a tool, show a tasteful inline status — "Searching the web…", "Checking June weather in Tokyo…", "Pricing this with your points…" — that resolves into the answer (with a small web-source citation when web search was used). Makes the intelligence visible, never a black box. Flat, subtle, reduced-motion-safe.
3. Deliberation + decision: user can say "not sure between the first two", "somewhere warmer", "what about business?", "is July a bad time to go?" and the thread continues in context. Suggested follow-up chips after answers (Compare these · Cheaper · Best weather · When's cheapest) but the free composer is primary.
4. Gets-to-know-you: the agent naturally asks/uses profile facts ("you mentioned only 10 days off — here's a trip that fits"). A subtle, user-controllable "what hop remembers about you" surface (view/edit/clear the profile).
5. Opening: landing on /ask is a warm greeting from the guide (not an empty box) + evocative starters + the existing mood gallery; signed-in loads the remembered thread with a "start over" option.
Keep it immersive/app-like, flat, brand tokens, no emoji, reduced-motion-safe, premium (Anthropic/Lululemon restraint — warm, calm, decisive). Report turn-by-turn what the user experiences, files changed, tsc/test results.`,
  { label: 'guide:agent-ui', phase: 'Guide', effort: 'high', isolation: 'worktree',
    schema: { type: 'object', additionalProperties: false, required: ['files','experience','tscClean','testsPass'], properties: {
      files: { type: 'array', items: { type: 'string' } },
      experience: { type: 'string' },
      tscClean: { type: 'boolean' },
      testsPass: { type: 'boolean' },
    } } },
)

phase('Verify')
const verify = await agent(
  `In ${REPO}: agents built an agentic tool-using concierge (AI SDK + web search + weather + engine-as-tools), conversation + profile memory (lib/conversations.ts, prefs travel_profile), and a personal-travel-agent UI (components/Concierge.tsx, likely a worktree). (1) MAIN tree git status. (2) npx tsc --noEmit + npx vitest run — exact results. (3) Worktree branches + conflicts. (4) Against the live gateway on :3003: confirm (a) a MULTI-TURN exchange threads context (follow-up references the first answer), and (b) a TOOL actually fires — ask something that needs the web or weather ("is July a bad time for Tokyo? why are flights pricey then?") and confirm a tool-call happens and the answer reflects live info. Describe what you observe. NOTE tool-calling may require setting AI_GATEWAY_MODEL to a Claude model (paid credits) — flag if DeepSeek free tier can't tool-call. (5) Precise punch-list: branches to merge, ALL SQL to run (hop_conversations + travel_profile column), any model/env change needed, conflicts, follow-ups. Diagnose, don't sweep.`,
  { label: 'verify:integration', phase: 'Verify', effort: 'high',
    schema: { type: 'object', additionalProperties: false, required: ['mainTreeState','tscResult','vitestResult','multiTurnWorks','toolUseWorks','sqlToRun','conflicts','punchList'], properties: {
      mainTreeState: { type: 'string' },
      tscResult: { type: 'string' },
      vitestResult: { type: 'string' },
      multiTurnWorks: { type: 'string' },
      toolUseWorks: { type: 'string' },
      sqlToRun: { type: 'string' },
      conflicts: { type: 'array', items: { type: 'string' } },
      punchList: { type: 'array', items: { type: 'string' } },
    } } },
)

return { core, memory, guide, verify }
