export const meta = {
  name: 'agent-home-finish',
  description: 'Finish the AI-first build: conversational guide on AI Elements, agent AS the home, reframe, CE review',
  phases: [
    { title: 'Guide', detail: 'rebuild Ask as a conversation on Vercel AI Elements + Streamdown + a2ui' },
    { title: 'HomeAgent', detail: 'make the agent the front door (home leads with the conversation)' },
    { title: 'Reframe', detail: 'value prop -> personal travel agent' },
    { title: 'Review', detail: 'CE adversarial + security + design, then fixes' },
  ],
}

const REPO = '/Users/n3wth/code/hop/hopapp'
const RULES = `PROJECT RULES (non-negotiable): Next.js 16 — READ node_modules/next/dist/docs/01-app/ before route/page/server-action/streaming code; heed AGENTS.md. No emojis. Flat design (no shadows/gradients-as-decoration/glows/translucency for UI; hover=color only, no vertical movement; ALL motion reduced-motion-safe). Brand tokens only (var(--color-brand), brand-deep, brand-light, bg, paper, surface, sunk, border, hair, text/text2/text3; font-display Bricolage, body General Sans). 2-space, single quotes, no semicolons. Read before edit. Never throw to the page. Per-user data keyed by Auth0 session.user.sub via utils/supabase/admin.ts. Keep all vitest tests green; npx tsc --noEmit (0) + npx vitest run + npm run build after changes. Dev :3003. Chrome headless at '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'.`
const STATE = `ALREADY BUILT + on main: an agentic streaming concierge (app/api/concierge/route.ts — AI SDK streamText, tools web_search/get_weather/price_trip, multi-turn messages[] contract, model anthropic/claude-sonnet-4-6); memory (lib/conversations.ts persisted thread, lib/travel-profile* personal profile + save_profile_fact tool + /api/profile, lib/travel-history.ts Gmail seam stub); a2ui (lib/a2ui.ts closed-union UI spec + components/concierge/A2UIBlock.tsx renderer, economics re-derived server-side). Streamdown is installed and already renders the answer markdown. DB tables hop_conversations + travel_profile column EXIST. The current components/Concierge.tsx is still the OLD one-shot-ish UI — THIS build replaces it with a real conversation. Build ON all of the above; do not rebuild the backend.`

phase('Guide')
const guide = await agent(
  `${RULES}\n${STATE}\n\nTASK: Rebuild components/Concierge.tsx (+ app/ask/page.tsx wiring) into a real CONVERSATIONAL TRAVEL AGENT using the VERCEL AI TOOLKIT.\n1. Install + use AI ELEMENTS (npx ai-elements@latest — the official Vercel chat components: Conversation, Message, Response, PromptInput, Tool, Suggestion, Loader). Use the AI SDK useChat() hook (from 'ai/react' or '@ai-sdk/react') for the streaming multi-turn thread against /api/concierge (which already streams + takes messages[]). The Response component renders assistant markdown via Streamdown.\n2. Render a real conversation: stacked turns; assistant replies stream in as markdown; tool activity shown via AI Elements' Tool component ("Searching the web…", "Checking weather…", "Pricing with your points…"); a2ui blocks (parsed from the stream's A2UI sentinel via lib/a2ui parseA2UI) render INSIDE the assistant turn through components/concierge/A2UIBlock; a persistent PromptInput composer; auto-scroll; Suggestion chips for follow-ups (Compare these · Cheaper · Best weather · When's cheapest) that send a message — composer primary.\n3. Deliberation works: user can reply "not sure between the first two", "warmer", "what about business?", "is July bad?" and the thread continues in context (useChat sends the full messages[]).\n4. Signed-in loads the remembered thread (GET the persisted conversation) with a quiet "start over"; persist after each exchange. Signed-out = session-only. Gets-to-know-you: the "Connect Gmail (soon)" affordance + a subtle "what hop remembers" entry to /api/profile.\n5. RESTYLE AI Elements to hop's house style (flat, brand tokens, no emoji, reduced-motion-safe, premium Anthropic/Lululemon restraint) — adopt structure+behavior, theme the look. Warm guided opening (greeting + starters + existing mood gallery) before the first message.\nVerify on :3003 with a real multi-turn + tool exchange. Report which AI Elements components you used, the turn-by-turn experience, files, tsc/vitest/build. Use a git worktree.`,
  { label: 'guide:ai-elements', phase: 'Guide', effort: 'high', isolation: 'worktree',
    schema: { type: 'object', additionalProperties: false, required: ['files','components','experience','tscClean','testsPass'], properties: {
      files: { type: 'array', items: { type: 'string' } }, components: { type: 'array', items: { type: 'string' } }, experience: { type: 'string' }, tscClean: { type: 'boolean' }, testsPass: { type: 'boolean' } } } },
)

phase('HomeAgent')
const home = await agent(
  `${RULES}\n${STATE}\nThe conversational Concierge was just rebuilt on AI Elements (previous phase).\n\nTASK: Make the AGENT THE FRONT DOOR. Today app/page.tsx leads with a search box ("One search. The smarter way to book") — a tool framing. Reframe the HOME so a visitor lands in / talks to their travel agent.\n- Signed-IN home (components/landing/SignedInHome.tsx + app/page.tsx signed-in branch): lead with the CONVERSATION — a prominent "talk to hop" agent surface at the top (an inviting greeting + composer that starts a conversation, opening into /ask or an embedded thread), BEFORE the destinations grid / search card. The agent is the primary action; search + destinations become secondary fast-paths below.\n- Signed-OUT home (app/page.tsx marketing branch): lead the hero with the agent promise (a conversational entry — an inviting prompt/composer that, on submit, takes them into the agent / sign-in), with the points-vs-cash VERDICT kept just below as the proof. Keep the destination reel + sample verdict as supporting sections.\n- Keep search reachable (nav + a secondary entry) — don't delete it, demote it.\n- Do NOT break auth, the existing sections, or the verdict engine. Flat, brand tokens, no emoji, reduced-motion-safe, premium. Mobile + wide-short must hold.\nVerify on :3003 (signed-out at least). Report what the home now leads with, signed-in vs signed-out, files, tsc/build. Use a git worktree.`,
  { label: 'home:agent-front-door', phase: 'HomeAgent', effort: 'high', isolation: 'worktree',
    schema: { type: 'object', additionalProperties: false, required: ['files','signedOut','signedIn','tscClean'], properties: {
      files: { type: 'array', items: { type: 'string' } }, signedOut: { type: 'string' }, signedIn: { type: 'string' }, tscClean: { type: 'boolean' } } } },
)

phase('Reframe')
const reframe = await agent(
  `${RULES}\n${STATE}\n\nTASK: Reframe hop's VALUE PROP + copy around "your personal travel agent" (verdict as the proof beneath). Update: app/page.tsx hero copy (now that the home leads with the agent), lib/seo.ts (DEFAULT_TITLE/description/TAGLINE + OG copy), TopNav/meta where relevant, any marketing-section subcopy that still says "calculator/one search". Voice: confident, warm, terse, NO slop, NO emoji, NO overclaiming — only promise what's LIVE (a travel agent that knows your points, talks with you, uses web + weather context, remembers you, and proves the math). Copy/framing only, no layout restructure (the HomeAgent phase owns layout). Keep tsc green. Report the new title/tagline/hero + every copy location changed.`,
  { label: 'reframe:value-prop', phase: 'Reframe', effort: 'medium', model: 'haiku',
    schema: { type: 'object', additionalProperties: false, required: ['files','newTitle','newTagline','newHero','tscClean'], properties: {
      files: { type: 'array', items: { type: 'string' } }, newTitle: { type: 'string' }, newTagline: { type: 'string' }, newHero: { type: 'string' }, tscClean: { type: 'boolean' } } } },
)

phase('Review')
const reviews = await parallel([
  () => agent(
    `Adversarially review the new conversational agent + home-agent + a2ui work in ${REPO} (components/Concierge.tsx, components/concierge/*, app/page.tsx, SignedInHome, app/api/concierge/route.ts, lib/conversations.ts, lib/a2ui.ts, lib/travel-profile*). Construct failure scenarios: prompt-injection via web/tool/email content; model fabricating points numbers (must come from engine); a2ui rendering unvalidated blocks; useChat message history leaking another user's thread; conversation/profile writes not scoped to Auth0 sub; the home composer breaking auth or SSR. file:line-cited, severity-ranked, each with a fix.`,
    { label: 'review:adversarial', phase: 'Review', effort: 'high', agentType: 'compound-engineering:ce-adversarial-reviewer',
      schema: { type: 'object', additionalProperties: false, required: ['findings'], properties: { findings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['severity','issue','file','fix'], properties: { severity: { type: 'string', enum: ['critical','high','medium','low'] }, issue: { type: 'string' }, file: { type: 'string' }, fix: { type: 'string' } } } } } } },
  ),
  () => agent(
    `Security review of the agent + memory + home changes in ${REPO}: per-user isolation of hop_conversations + travel_profile (service-role keyed by Auth0 sub), the /api/profile + /api/concierge endpoints (auth gates), tool-use injection, unvalidated model output reaching DB or DOM (a2ui), secrets exposure. file:line-cited findings + fixes, ranked.`,
    { label: 'review:security', phase: 'Review', effort: 'high', agentType: 'compound-engineering:ce-security-reviewer',
      schema: { type: 'object', additionalProperties: false, required: ['findings'], properties: { findings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['severity','issue','file','fix'], properties: { severity: { type: 'string', enum: ['critical','high','medium','low'] }, issue: { type: 'string' }, file: { type: 'string' }, fix: { type: 'string' } } } } } } },
  ),
  () => agent(
    `Design-quality review of the new conversational Ask + agent-led home in ${REPO} on :3003 (Chrome headless 1440x900 + 390x844). Judge: does the conversation feel premium + tailored (AI Elements themed to house style), the streaming/tool moments, the agent-as-home composition, typographic rhythm, empty/opening state, mobile. Against the house taste rules. file-cited, impact-ranked, each with a fix.`,
    { label: 'review:design', phase: 'Review', effort: 'high', agentType: 'compound-engineering:ce-design-implementation-reviewer',
      schema: { type: 'object', additionalProperties: false, required: ['findings'], properties: { findings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['severity','issue','file','fix'], properties: { severity: { type: 'string', enum: ['critical','high','medium','low'] }, issue: { type: 'string' }, file: { type: 'string' }, fix: { type: 'string' } } } } } } },
  ),
])
const high = reviews.filter(Boolean).flatMap((r) => r.findings || []).filter((f) => f.severity === 'critical' || f.severity === 'high')
const fix = high.length === 0 ? { fixed: [], note: 'none' } : await agent(
  `${RULES}\n\nApply fixes for these CRITICAL/HIGH findings on the agent/home work in ${REPO}:\n${JSON.stringify(high, null, 2)}\nSmallest correct change each; no feature regressions. Then npx tsc --noEmit (0) + npx vitest run (green) + npm run build (passes). Report fixed + deferred + results.`,
  { label: 'review:apply-fixes', phase: 'Review', effort: 'high',
    schema: { type: 'object', additionalProperties: false, required: ['fixed','deferred','tscResult','vitestResult','buildResult'], properties: {
      fixed: { type: 'array', items: { type: 'string' } }, deferred: { type: 'array', items: { type: 'string' } }, tscResult: { type: 'string' }, vitestResult: { type: 'string' }, buildResult: { type: 'string' } } } },
)

return { guide, home, reframe, highFindings: high.length, fix }
