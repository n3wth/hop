export const meta = {
  name: 'agent-stage1-core',
  description: 'Stage 1: move concierge to AI SDK streamText + tools (web search, weather, engine-as-tool)',
  phases: [
    { title: 'Core', detail: 'AI SDK streaming + tool-use foundation' },
    { title: 'Verify', detail: 'tsc + tests + live streaming + tool-call check' },
  ],
}

const REPO = '/Users/n3wth/code/hop/hopapp'
const RULES = `PROJECT RULES (non-negotiable): Next.js 16 — READ node_modules/next/dist/docs/01-app/ before any route/page/streaming code; heed AGENTS.md. No emojis. Flat design (no shadows/gradients-as-decoration/glows; reduced-motion-safe). Brand tokens only. 2-space, single quotes, no semicolons. Read before edit. Never throw to the page. Keep all vitest tests green; run npx tsc --noEmit (0) + npx vitest run after changes. Dev :3003. The gateway model is AI_GATEWAY_MODEL=anthropic/claude-sonnet-4-6 (Claude, paid credits — verified working incl. tool-calling).`
const THESIS = `hop's thesis: the deterministic engine (assembleSearch/computeCpp/effectiveBalanceFor/destinations) computes ALL points economics — miles, CPP, affordability — the LLM NEVER invents those numbers. This stage makes the concierge AGENTIC: streaming + tool-use, where live world-context comes from tools and points math comes from hop's own engine exposed AS a tool.`

phase('Core')
const core = await agent(
  `${RULES}\n${THESIS}\n\nTASK: Upgrade app/api/concierge/route.ts to an AGENTIC, STREAMING, TOOL-USING core using the Vercel AI SDK in ${REPO}. Today it calls the gateway via raw fetch, single-shot, returns JSON. Change to:
1. Install the "ai" package (Vercel AI SDK). Use streamText with model from AI_GATEWAY_MODEL (default 'anthropic/claude-sonnet-4-6') routed through the AI Gateway (the SDK reads AI_GATEWAY_API_KEY automatically, or configure the gateway provider). Stream the response (toDataStreamResponse / SSE) so the answer can type out live; surface tool-call + tool-result events.
2. TOOLS (AI SDK tools with zod or JSON schemas):
   a. web_search — gateway.tools.parallelSearch() (or perplexitySearch). For live context: events, why fares move at a given time, seasonality. (Docs: vercel.com/docs/ai-gateway/models-and-providers/web-search)
   b. get_weather — a custom tool hitting open-meteo (no key, fetch server-side) for typical/forecast weather for a destination + month.
   c. price_trip — a custom tool that runs hop's REAL engine (computeCpp + destinationByCode + effectiveBalanceFor over passed-in balances) and returns the deterministic points/CPP/affordability for a destination. THIS is how the agent quotes numbers — from the engine, never invented.
3. Keep a graceful fallback: if streaming/tools/gateway fail, degrade to the existing curated answer path (never 500). Preserve the existing enrichSuggestions verdict facts. Keep the single-question request shape working (multi-turn comes in a later stage) — just make THIS turn agentic + streaming + tool-capable.
4. Keep the existing /ask UI working against the new endpoint (it can consume the stream as text for now; the rich streaming UI is a later stage — just don't break /ask).
Add unit tests for the custom tools (weather parse, price_trip via engine). Report: the tools wired + schemas, how price_trip keeps economics deterministic, how streaming is returned, and tsc/test results. This stage should NOT add multi-turn, profile, a2ui, or conversation UI — ONLY the agentic streaming+tools core.`,
  { label: 'core:ai-sdk-tools', phase: 'Core', effort: 'high',
    schema: { type: 'object', additionalProperties: false, required: ['files','deps','tools','streaming','economicsDeterministic','tscClean','testsPass'], properties: {
      files: { type: 'array', items: { type: 'string' } },
      deps: { type: 'array', items: { type: 'string' } },
      tools: { type: 'array', items: { type: 'string' } },
      streaming: { type: 'string' },
      economicsDeterministic: { type: 'string' },
      tscClean: { type: 'boolean' },
      testsPass: { type: 'boolean' },
    } } },
)

phase('Verify')
const verify = await agent(
  `In ${REPO}, the concierge was just moved to AI SDK streamText + tools (web_search, get_weather, price_trip). (1) git status of the main tree. (2) npx tsc --noEmit + npx vitest run — exact counts. (3) npm run build passes? (4) Against the live gateway on :3003 (model = Claude): POST /api/concierge with a question that should trigger a tool ("is July a bad time for Tokyo and why are flights pricey then?") — confirm the response STREAMS and a tool-call actually fires (web_search or get_weather), and the answer reflects live info. Also confirm a normal "where with 80k Amex points" still returns grounded verdict suggestions (price_trip / enrichSuggestions numbers intact, not hallucinated). Describe exactly what you observe (curl the endpoint; note if it's SSE/stream). (5) Anything broken in /ask? Report a clear pass/fail + any fix needed before the next stage. Diagnose; fix only small breakages, don't expand scope.`,
  { label: 'verify:core', phase: 'Verify', effort: 'low', model: 'haiku',
    schema: { type: 'object', additionalProperties: false, required: ['tscResult','vitestResult','buildResult','streamingObserved','toolCallObserved','groundedStillWorks','askBroken','verdict'], properties: {
      tscResult: { type: 'string' },
      vitestResult: { type: 'string' },
      buildResult: { type: 'string' },
      streamingObserved: { type: 'string' },
      toolCallObserved: { type: 'string' },
      groundedStillWorks: { type: 'string' },
      askBroken: { type: 'string' },
      verdict: { type: 'string', enum: ['pass', 'fail', 'pass-with-fixes'] },
    } } },
)

return { core, verify }
