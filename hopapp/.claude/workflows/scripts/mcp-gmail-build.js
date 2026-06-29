export const meta = {
  name: 'mcp-gmail-build',
  description: 'Add-to-Claude MCP server (hop engine as tools) + real Gmail->travel-history, each CE-reviewed',
  phases: [
    { title: 'MCP', detail: 'expose hop verdict engine as an MCP server for external LLMs' },
    { title: 'Gmail', detail: 'real Gmail->travel-history (replace the stub) behind consent' },
    { title: 'Review', detail: 'CE adversarial + security, then fixes' },
  ],
}

const REPO = '/Users/n3wth/code/hop/hopapp'
const RULES = `PROJECT RULES (non-negotiable): Next.js 16 — READ node_modules/next/dist/docs/01-app/ before route/page/server-action code; heed AGENTS.md. No emojis. Flat design, brand tokens, 2-space single-quote no-semicolon. Read before edit. Never throw to the page. Per-user data keyed by Auth0 session.user.sub via utils/supabase/admin.ts (service-role). Keep all vitest tests green; npx tsc --noEmit (0) + npx vitest run + npm run build after changes. DO NOT touch components/Concierge.tsx, app/page.tsx, components/landing/SignedInHome.tsx, app/ask/page.tsx (live agent UI) unless strictly necessary. Use git worktrees.`
const STATE = `hop's deterministic engine (lib/search.assembleSearch, lib/destinations.{computeCpp,topValue,affordableWith,destinationByCode}, lib/transfers.effectiveBalanceFor, lib/accounts.getUserBalances, lib/concierge-tools.priceTrip) is the moat. lib/travel-history.ts is a STUB (getTravelHistory returns empty; derivePatterns is pure + ready). The Gmail MCP is available in the stack (mcp__gmail__* / mcp__claude_ai_Gmail__*). AwardWallet email-parsing is also integrated (we hold a key). Gateway model anthropic/claude-sonnet-4-6.`

phase('MCP')
const mcp = await agent(
  `${RULES}\n${STATE}\n\nTASK: Build "ADD TO CLAUDE" — expose hop's verdict engine as an MCP server so external LLMs (Claude, etc.) can call it. This is distribution + proof the engine is the moat.\n- Implement an MCP server. Preferred: a Next.js route handler at app/[transport]/route.ts or app/api/mcp/route.ts using the official MCP TypeScript SDK / @vercel/mcp-adapter (check what's installable; if @vercel/mcp-adapter exists use it, else the @modelcontextprotocol/sdk streamable-http transport in a route handler). Read current docs (the Vercel "MCP server" product) before coding.\n- Tools to expose (thin wrappers over the EXISTING pure engine — no new economics): \n  * price_trip({ destinationCode, balances? }) -> deterministic miles/CPP/affordability/verdict (computeCpp + effectiveBalanceFor + destinationByCode).\n  * verdict({ from, to, depart, return?, adults?, balances? }) -> runs assembleSearch and returns the points-vs-cash verdict + summary.\n  * sweet_spots({ limit? }) -> topValue redemptions with CPP.\n  * transfer_paths({ program }) -> partnersOf / transfersTo.\n- AUTH/LINKING: balances are per-user. Design a clean linking story: support an optional hop API token (a new per-user token the user can mint, stored hashed in a hop_api_tokens table — REPORT the SQL, don't run DDL) that maps to their Auth0 sub so the MCP tools can load THEIR real balances via getUserBalances; without a token, tools work in a stateless mode (caller passes balances or gets generic/no-balance results). Never expose another user's data.\n- A small /account or settings affordance to mint/revoke the token + copy the MCP server URL + "Add to Claude" instructions.\n- Tests for the tool handlers (deterministic engine passthrough) + token hashing/lookup.\nReport: the server URL/transport, the tools + schemas, the auth/linking design + the hop_api_tokens SQL, and tsc/test/build. Use a worktree.`,
  { label: 'mcp:server', phase: 'MCP', effort: 'high', isolation: 'worktree',
    schema: { type: 'object', additionalProperties: false, required: ['files','transport','tools','authDesign','sql','tscClean','testsPass'], properties: {
      files: { type: 'array', items: { type: 'string' } }, transport: { type: 'string' }, tools: { type: 'array', items: { type: 'string' } }, authDesign: { type: 'string' }, sql: { type: 'string' }, tscClean: { type: 'boolean' }, testsPass: { type: 'boolean' } } } },
)

phase('Gmail')
const gmail = await agent(
  `${RULES}\n${STATE}\n\nTASK: Make Gmail->TRAVEL-HISTORY real in ${REPO}, replacing the lib/travel-history.ts stub — BEHIND EXPLICIT USER CONSENT. The agent already reads getTravelHistory(userId) into the prompt + a "Connect Gmail (soon)" affordance exists.\n- Implement real ingestion: an OAuth/consent flow + a parser that reads the user's airline/hotel CONFIRMATION emails and normalizes them into PastTrip[] (destination, dates, airline?, cabin?, bookedWithPoints?), then derivePatterns (already pure) computes usualMonths/favoriteRegions/typicalCabin/tripsPerYear. Two viable sources — pick the most robust given what's actually wired: (a) the Gmail MCP tools available in this stack (search confirmation emails + read), or (b) AwardWallet's email-parsing API (we hold a key). If real Google OAuth needs dashboard config we can't do headlessly, implement the full code path + a clear consent UI and gate it behind an env flag + a "Connect Gmail" button that initiates the flow, leaving a precise TODO for the OAuth client-id/redirect registration. Persist parsed trips per-user (a hop_travel_history table — REPORT SQL, don't run DDL).\n- PRIVACY: explicit consent before any email access; read ONLY travel-confirmation emails (tight query), store only the normalized trip facts (never raw email), user can disconnect + delete. Scope everything to Auth0 sub.\n- Wire getTravelHistory to return real {connected:true, trips, patterns} when connected; agent uses it (already plumbed). Update the /account affordance from "soon" to a real connect/disconnect.\nReport: the source chosen + why, the consent/privacy model, the hop_travel_history SQL, what (if anything) needs dashboard OAuth config to flip live, and tsc/test/build. Use a worktree.`,
  { label: 'gmail:travel-history', phase: 'Gmail', effort: 'high', isolation: 'worktree',
    schema: { type: 'object', additionalProperties: false, required: ['files','source','privacy','sql','needsConfig','tscClean'], properties: {
      files: { type: 'array', items: { type: 'string' } }, source: { type: 'string' }, privacy: { type: 'string' }, sql: { type: 'string' }, needsConfig: { type: 'string' }, tscClean: { type: 'boolean' } } } },
)

phase('Review')
const reviews = await parallel([
  () => agent(
    `Security review of the MCP server + Gmail ingestion in ${REPO}. Focus: the MCP token (hashing, per-user scoping, no cross-user balance leak, revocation), the MCP tools never exposing another user's data or unauthenticated balances; Gmail consent/scope minimization, storing only normalized facts not raw email, disconnect/delete, all scoped to Auth0 sub; secrets handling. file:line-cited, severity-ranked, each with a fix.`,
    { label: 'review:security', phase: 'Review', effort: 'high', agentType: 'compound-engineering:ce-security-reviewer',
      schema: { type: 'object', additionalProperties: false, required: ['findings'], properties: { findings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['severity','issue','file','fix'], properties: { severity: { type: 'string', enum: ['critical','high','medium','low'] }, issue: { type: 'string' }, file: { type: 'string' }, fix: { type: 'string' } } } } } } },
  ),
  () => agent(
    `Adversarially review the MCP + Gmail work in ${REPO}: MCP tools fabricating economics (must passthrough the engine), token forgery/replay, the engine wrappers diverging from the real engine output, Gmail parser mis-parsing/hallucinating trips, derivePatterns edge cases. file:line-cited, severity-ranked, each with a fix.`,
    { label: 'review:adversarial', phase: 'Review', effort: 'high', agentType: 'compound-engineering:ce-adversarial-reviewer',
      schema: { type: 'object', additionalProperties: false, required: ['findings'], properties: { findings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['severity','issue','file','fix'], properties: { severity: { type: 'string', enum: ['critical','high','medium','low'] }, issue: { type: 'string' }, file: { type: 'string' }, fix: { type: 'string' } } } } } } },
  ),
])
const high = reviews.filter(Boolean).flatMap((r) => r.findings || []).filter((f) => f.severity === 'critical' || f.severity === 'high')
const fix = high.length === 0 ? { fixed: [], note: 'none' } : await agent(
  `${RULES}\n\nApply fixes for these CRITICAL/HIGH findings on the MCP + Gmail work in ${REPO}:\n${JSON.stringify(high, null, 2)}\nSmallest correct change each; no regressions. Then npx tsc --noEmit (0) + npx vitest run (green) + npm run build (passes). Report fixed + deferred + results.`,
  { label: 'review:apply-fixes', phase: 'Review', effort: 'high',
    schema: { type: 'object', additionalProperties: false, required: ['fixed','deferred','tscResult','vitestResult','buildResult'], properties: {
      fixed: { type: 'array', items: { type: 'string' } }, deferred: { type: 'array', items: { type: 'string' } }, tscResult: { type: 'string' }, vitestResult: { type: 'string' }, buildResult: { type: 'string' } } } },
)

return { mcp, gmail, highFindings: high.length, fix }
