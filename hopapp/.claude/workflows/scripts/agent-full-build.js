export const meta = {
  name: 'agent-full-build',
  description: 'Personal travel agent: memory+Gmail seam, a2ui, conversation UI, reframe — each phase built then CE-reviewed',
  phases: [
    { title: 'Memory', detail: 'multi-turn thread + personal profile + Gmail->history seam (placeholder)' },
    { title: 'A2UI', detail: 'typed generative-UI spec + branded renderer, personalized by profile+points' },
    { title: 'Guide', detail: 'conversational travel-agent UI on the agentic core' },
    { title: 'Reframe', detail: 'value prop -> personal travel agent (verdict as proof)' },
    { title: 'Review', detail: 'CE adversarial + design + security review, then fixes' },
  ],
}

const REPO = '/Users/n3wth/code/hop/hopapp'
const RULES = `PROJECT RULES (non-negotiable): Next.js 16 — READ node_modules/next/dist/docs/01-app/ before route/page/server-action/streaming code; heed AGENTS.md. No emojis. Flat design (no shadows/gradients-as-decoration/glows/translucency for UI; hover=color only, no vertical movement; ALL motion reduced-motion-safe). Brand tokens only (var(--color-brand), brand-deep, brand-light, bg, paper, surface, sunk, border, hair, text/text2/text3; font-display Bricolage, body General Sans). 2-space, single quotes, no semicolons. Read before edit. Never throw to the page. Per-user data keyed by Auth0 session.user.sub via utils/supabase/admin.ts (service-role). Keep all vitest tests green; npx tsc --noEmit (0) + npx vitest run after changes. Dev :3003. Gateway model = anthropic/claude-sonnet-4-6 (paid, tool-calling verified).`
const THESIS = `hop is becoming a PERSONAL TRAVEL AGENT. The deterministic engine computes ALL points economics (miles/CPP/affordability) — the LLM never invents numbers. STAGE 1 ALREADY SHIPPED an agentic streaming + tool-using concierge core (AI SDK streamText; tools: web_search, get_weather, price_trip[=hop engine]). THIS build adds: memory (multi-turn + personal profile + Gmail->travel-history seam), a2ui (agent emits typed UI spec -> branded generative components, personalized per user), the conversational guide UI, and the value-prop reframe. Build on Stage 1; do not redo it.`

// ── MEMORY ──
phase('Memory')
const memory = await agent(
  `${RULES}\n${THESIS}\n\nTASK: Add MEMORY to the concierge in ${REPO}.
1. Multi-turn: ConciergeRequest carries messages: Array<{role,content}> threaded into the Stage-1 streamText call (agent answers in context). Keep single-question back-compat.
2. Persist conversation: table hop_conversations { id uuid pk, user_id text, messages jsonb, updated_at }. lib/conversations.ts (get/save, service-role, by Auth0 sub, never throws). Signed-in remembered across visits; signed-out session-only.
3. Personal PROFILE: travel_profile jsonb on hop_user_prefs — vacation_days, travel_party, cabin pref, dietary/accessibility, loved/avoided destinations. Agent READS it (into prompt) + UPDATES via a save_profile_fact tool (validate/clamp; user can view/edit/clear).
4. Gmail -> travel-history SEAM (PLACEHOLDER): lib/travel-history.ts getTravelHistory(userId) returning a typed STUB (past trips + derived patterns: usualMonths, favoriteRegions, typicalCabin, tripsPerYear) — NO real Gmail call yet; clear TODO (real source: Gmail MCP / AwardWallet email-parsing). Agent reads it into the prompt; a "Connect Gmail (coming soon)" affordance.
Do NOT run DDL — report exact SQL (CREATE hop_conversations + ALTER hop_user_prefs ADD travel_profile + RLS/policies). Add tests. Report contract, SQL, profile shape, Gmail seam.`,
  { label: 'memory:thread-profile-gmail', phase: 'Memory', effort: 'high',
    schema: { type: 'object', additionalProperties: false, required: ['files','sql','profileShape','gmailSeam','tscClean'], properties: {
      files: { type: 'array', items: { type: 'string' } }, sql: { type: 'string' }, profileShape: { type: 'string' }, gmailSeam: { type: 'string' }, tscClean: { type: 'boolean' } } } },
)

// ── A2UI ──
phase('A2UI')
const a2ui = await agent(
  `${RULES}\n${THESIS}\n\nTASK: Build AGENT-TO-UI (generative UI) in ${REPO} — what makes Ask feel TAILORED. The agent emits a typed, CLOSED-union UI spec (lib/a2ui.ts): verdict_card, compare (two destinations side-by-side vs your points), timing (cheapest-week strip), weather (trend chip from get_weather), web_note (cited live context), prompt_chips, profile_confirm, connect_gmail. The model picks block TYPE + structured fields; the CLIENT owns rendering (components/concierge/A2UIBlock.tsx) — never arbitrary model HTML, always on-brand. Economics numbers come from the engine/price_trip, not the model. Personalization: same question -> different blocks per user's profile+points (compare when torn; "fits your N days" when vacation_days known; cabin surfaced if they fly business). Validate spec (unknown block -> dropped, never crash). Tests for validation. Report block union, safety model, personalization.`,
  { label: 'a2ui:generative-ui', phase: 'A2UI', effort: 'high',
    schema: { type: 'object', additionalProperties: false, required: ['files','blockTypes','safety','personalization','tscClean'], properties: {
      files: { type: 'array', items: { type: 'string' } }, blockTypes: { type: 'array', items: { type: 'string' } }, safety: { type: 'string' }, personalization: { type: 'string' }, tscClean: { type: 'boolean' } } } },
)

// ── GUIDE UI ──
phase('Guide')
const guide = await agent(
  `${RULES}\n${THESIS}\n\nTASK: Rebuild components/Concierge.tsx (+ app/ask/page.tsx) into the PERSONAL TRAVEL AGENT conversation in ${REPO}, on the Stage-1 agentic core + this build's memory + a2ui.\n\nUSE THE VERCEL AI TOOLKIT — do NOT hand-roll chat UI. Specifically:\n- Install + use AI ELEMENTS (npx ai-elements@latest, or the @ai-sdk components) — the official Vercel chat building blocks (Conversation, Message, Response, PromptInput, Tool, Suggestion). This is what the Vercel AI chatbot / Morphic examples the user shared are built on. Use the AI SDK useChat() hook for the streaming multi-turn thread (it handles message history, streaming, tool-call parts) against the Stage-1 streaming endpoint.\n- Render the assistant's text with STREAMDOWN (already installed) for proper streaming markdown (bold, lists, dividers) — NOT raw text. (The current UI just got a Streamdown patch; the rebuilt one should use it throughout via AI Elements' Response component which wraps Streamdown.)\n- Restyle the AI Elements components to hop's house style (flat, brand tokens, no emoji, reduced-motion-safe) — adopt their structure + behavior, theme the look.\n\nLike texting a brilliant agent who knows you and the world — not a search box. Requirements: streaming thread (typing replies rendered as markdown; a2ui blocks render inside turns via A2UIBlock alongside the markdown); tool transparency as delight using AI Elements' Tool component ("Searching the web…", "Checking June weather…", "Pricing with your points…" -> resolves, with web citations); deliberation (user steers: "not sure between the first two", "warmer", "what about business?", "is July bad?"); AI Elements Suggestion chips + free composer (PromptInput, composer primary); gets-to-know-you (uses profile + travel-history; user-controllable "what hop remembers"); warm guided opening (greeting + starters + mood gallery; signed-in loads remembered thread + "start over"). Immersive, flat, brand tokens, no emoji, reduced-motion-safe, premium (Anthropic/Lululemon restraint). Persist thread per exchange (signed-in). Report which AI Elements components you used, turn-by-turn experience, files, tsc/tests. Use a git worktree (isolation).`,
  { label: 'guide:agent-ui', phase: 'Guide', effort: 'high', isolation: 'worktree',
    schema: { type: 'object', additionalProperties: false, required: ['files','experience','tscClean','testsPass'], properties: {
      files: { type: 'array', items: { type: 'string' } }, experience: { type: 'string' }, tscClean: { type: 'boolean' }, testsPass: { type: 'boolean' } } } },
)

// ── REFRAME (cheaper model — it's copy, not architecture) ──
phase('Reframe')
const reframe = await agent(
  `${RULES}\n${THESIS}\n\nTASK: Reframe hop's VALUE PROP around "your personal travel agent" in ${REPO}, keeping the points-vs-cash VERDICT as the proof beneath. LEAD with the agent (it knows your points, knows you, watches the world, helps you decide + book); verdict is the credibility. Update the signed-OUT marketing home (app/page.tsx hero h1 + subcopy + the section that sells it), TopNav/meta where relevant, and lib/seo.ts (DEFAULT_TITLE/description/TAGLINE + OG copy). Voice: confident, warm, terse, NO slop, NO emoji, no overclaiming (only promise what's live: conversation, knows-your-points, web/weather context, remembers you). Do NOT restructure layout — copy + framing only. Keep tsc green. Report the new hero/title/tagline + every copy location changed.`,
  { label: 'reframe:value-prop', phase: 'Reframe', effort: 'medium', model: 'haiku',
    schema: { type: 'object', additionalProperties: false, required: ['files','newHero','newTitle','newTagline','tscClean'], properties: {
      files: { type: 'array', items: { type: 'string' } }, newHero: { type: 'string' }, newTitle: { type: 'string' }, newTagline: { type: 'string' }, tscClean: { type: 'boolean' } } } },
)

// ── REVIEW: compound-engineering specialists, in parallel, then synthesize fixes ──
phase('Review')
const reviews = await parallel([
  () => agent(
    `Adversarially review the personal-travel-agent changes just made in ${REPO} (concierge route + tools, lib/conversations.ts, lib/a2ui.ts, components/concierge/*, Concierge.tsx, prefs travel_profile, lib/travel-history.ts). Construct failure scenarios: prompt-injection via web_search/email content reaching the model; the model fabricating points numbers (must come from engine/price_trip only); a2ui rendering unsafe/unvalidated blocks; tool errors crashing the stream; multi-turn context leaking another user's data; conversation/profile writes not scoped to the Auth0 sub. Report concrete, file:line-cited risks ranked by severity, each with a fix.`,
    { label: 'review:adversarial', phase: 'Review', effort: 'high', agentType: 'compound-engineering:ce-adversarial-reviewer',
      schema: { type: 'object', additionalProperties: false, required: ['findings'], properties: { findings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['severity','issue','file','fix'], properties: { severity: { type: 'string', enum: ['critical','high','medium','low'] }, issue: { type: 'string' }, file: { type: 'string' }, fix: { type: 'string' } } } } } } },
  ),
  () => agent(
    `Security review of the agent changes in ${REPO}: tool-use (web_search, get_weather, price_trip, save_profile_fact), conversation/profile persistence (Supabase service-role keyed by Auth0 sub), the streaming endpoint, and the a2ui render path. Focus on: per-user data isolation, injection through tool/web/email content, secrets exposure, unvalidated model output reaching the DB or DOM, auth gaps on the conversation/profile server actions. file:line-cited findings + fixes, ranked.`,
    { label: 'review:security', phase: 'Review', effort: 'high', agentType: 'compound-engineering:ce-security-reviewer',
      schema: { type: 'object', additionalProperties: false, required: ['findings'], properties: { findings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['severity','issue','file','fix'], properties: { severity: { type: 'string', enum: ['critical','high','medium','low'] }, issue: { type: 'string' }, file: { type: 'string' }, fix: { type: 'string' } } } } } } },
  ),
  () => agent(
    `Design-quality review of the new Ask conversation + a2ui in ${REPO} (Concierge.tsx, A2UIBlock.tsx, app/ask/page.tsx) against the house style (flat, brand tokens, no emoji, reduced-motion-safe, premium Anthropic/Lululemon restraint). Look at it on :3003 (Chrome headless screenshots at 1440x900 + 390x844). Judge: does the conversation feel premium + tailored or improvised? typographic rhythm, spacing, the streaming/tool-status moments, card consistency, empty/opening state. file-cited issues + fixes, ranked by impact.`,
    { label: 'review:design', phase: 'Review', effort: 'high', agentType: 'compound-engineering:ce-design-implementation-reviewer',
      schema: { type: 'object', additionalProperties: false, required: ['findings'], properties: { findings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['severity','issue','file','fix'], properties: { severity: { type: 'string', enum: ['critical','high','medium','low'] }, issue: { type: 'string' }, file: { type: 'string' }, fix: { type: 'string' } } } } } } },
  ),
])

// Fix the confirmed critical/high findings.
const allFindings = reviews.filter(Boolean).flatMap((r) => r.findings || [])
  .filter((f) => f.severity === 'critical' || f.severity === 'high')
const fix = await agent(
  `In ${REPO}, apply fixes for these CRITICAL/HIGH review findings on the personal-travel-agent work:\n${JSON.stringify(allFindings, null, 2)}\n\nFix each (smallest correct change), honoring the project rules. Do NOT regress features. After fixing: npx tsc --noEmit (0), npx vitest run (all green), npm run build (passes). Report what you fixed + the final tsc/test/build results + any finding you deliberately deferred (with reason).`,
  { label: 'review:apply-fixes', phase: 'Review', effort: 'high',
    schema: { type: 'object', additionalProperties: false, required: ['fixed','deferred','tscResult','vitestResult','buildResult'], properties: {
      fixed: { type: 'array', items: { type: 'string' } }, deferred: { type: 'array', items: { type: 'string' } }, tscResult: { type: 'string' }, vitestResult: { type: 'string' }, buildResult: { type: 'string' } } } },
)

return { memory, a2ui, guide, reframe, reviewFindings: allFindings, fix }
