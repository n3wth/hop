export const meta = {
  name: 'concepts-build',
  description: 'Flagship concepts: Counterfactual You, Ledger Dream, Standing Orders (gated) — each built then CE-reviewed',
  phases: [
    { title: 'Counterfactual', detail: 'what-if-you re-runs the verdict on a perturbed balance clone' },
    { title: 'LedgerDream', detail: 'cinematic AI dream-of-the-week from the user\'s real stack' },
    { title: 'StandingOrders', detail: 'the verdict that watches (cron + push), gated' },
    { title: 'Review', detail: 'CE adversarial + correctness, then fixes' },
  ],
}

const REPO = '/Users/n3wth/code/hop/hopapp'
const RULES = `PROJECT RULES (non-negotiable): Next.js 16 — READ node_modules/next/dist/docs/01-app/ before route/page/server-action/cron code; heed AGENTS.md. No emojis. Flat design (no shadows/gradients-as-decoration/glows/translucency for UI; hover=color only, no vertical movement; reduced-motion-safe). Brand tokens only (var(--color-brand), brand-deep, brand-light, bg, paper, surface, sunk, border, hair, text/text2/text3; font-display Bricolage, body General Sans). 2-space, single quotes, no semicolons. Read before edit. Never throw to the page. Per-user data keyed by Auth0 session.user.sub via utils/supabase/admin.ts (service-role). Keep all vitest tests green; npx tsc --noEmit (0) + npx vitest run + npm run build after changes. Dev :3003.`
const THESIS = `hop's moat = a real perturbable points portfolio + a re-runnable deterministic verdict engine. assembleSearch(params, balances) is pure; computeCpp/effectiveBalanceFor/topValue/affordableWith are pure. These concepts RUN THE SAME ENGINE in new modes — the LLM only translates/narrates, never invents economics. Engine entrypoints: lib/search.assembleSearch, lib/destinations.{computeCpp,topValue,affordableWith,destinationByCode}, lib/transfers.effectiveBalanceFor, lib/accounts.getUserBalances(userId), lib/prefs.getPrefs, lib/travel-profile.getProfile. AI via the AI Gateway (anthropic/claude-sonnet-4-6) — reuse the concierge's streaming/tool pattern + lib/a2ui for any generative UI. Build each as a tasteful, flat, on-brand surface.`

phase('Counterfactual')
const counterfactual = await agent(
  `${RULES}\n${THESIS}\n\nTASK: Build COUNTERFACTUAL YOU in ${REPO} — "what if I had a different points portfolio?". Travel's first financial mirror.\n- lib/counterfactual.ts: pure functions that take the user's real Balance[] and a MUTATION ({op:'add'|'set'|'swap', program, amount} | swap one program for another) and return a perturbed CLONE of Balance[]; then run the SAME engine (effectiveBalanceFor / computeCpp / affordableWith / topValue) on the clone to compute what UNLOCKS — destinations newly affordable, CPP deltas, dollar value gained. Returns a structured diff {unlocked: Destination[], improved: {code, beforeCpp, afterCpp}[], dollarValue}. Deterministic, unit-tested.\n- An NL parser (reuse the gateway pattern): parseMutation(text) -> the structured mutation ("what if I had 50k more Chase UR", "what if I held Alaska instead of Delta"), regex fallback for common cases, clamp to known programs (lib/programs).\n- A UI surface: a "What if…" entry — minimal, on the /account or a /counterfactual surface (your call; keep it discoverable but not cluttered) — input + a flat result panel showing "with X, you'd unlock N trips worth ~$Y" using the engine numbers (never model-invented). Optionally an a2ui 'counterfactual' block so the concierge can render it inline too.\nReport the API, the UI surface, how numbers stay deterministic, tsc/test/build. Use a git worktree.`,
  { label: 'concept:counterfactual', phase: 'Counterfactual', effort: 'high', isolation: 'worktree',
    schema: { type: 'object', additionalProperties: false, required: ['files','api','surface','tscClean','testsPass'], properties: {
      files: { type: 'array', items: { type: 'string' } }, api: { type: 'string' }, surface: { type: 'string' }, tscClean: { type: 'boolean' }, testsPass: { type: 'boolean' } } } },
)

phase('LedgerDream')
const dream = await agent(
  `${RULES}\n${THESIS}\n\nTASK: Build THE LEDGER DREAM in ${REPO} — a cinematic, AI-written "Dream of the Week" generated FROM the user's real points stack, with a transparent "how you afford it" proof. Inspiration generated from your wealth, not filtered by it.\n- lib/ledger-dream.ts: pick the single most aspirational-yet-affordable redemption for the user (engine: affordableWith + topValue + computeCpp over their real balances; prefer a high-CPP premium-cabin or bucket-list trip they can actually reach, possibly via a transfer per effectiveBalanceFor). Returns {destination, milesNeeded, via (direct/transfer+ratio), cpp, cashValue, proof: the exact pool->program path}. Deterministic selection; unit-tested. Signed-out / no-balances -> a "best dream to save toward" fallback (topValue).\n- An AI narration (reuse the gateway streaming pattern): write a short, second-person, evocative-but-not-slop blurb for THAT specific trip ("You fly ANA The Room to Tokyo, $0 out of pocket…"). The model NARRATES the engine's pick; it does not choose the numbers. Graceful fallback to a templated blurb if AI is down.\n- A UI surface: a flat, premium Dream card (real destination photo via lib/images, the proof drawn from the engine, a "make it real" CTA into a seeded search). Place it on the signed-in home (a tasteful module) and/or its own surface — keep it a highlight, not clutter. "Dream me another" regenerates from a different corner of the portfolio.\nReport the selection logic, the narration approach, the UI surface, tsc/test/build. Use a git worktree.`,
  { label: 'concept:ledger-dream', phase: 'LedgerDream', effort: 'high', isolation: 'worktree',
    schema: { type: 'object', additionalProperties: false, required: ['files','selection','narration','surface','tscClean','testsPass'], properties: {
      files: { type: 'array', items: { type: 'string' } }, selection: { type: 'string' }, narration: { type: 'string' }, surface: { type: 'string' }, tscClean: { type: 'boolean' }, testsPass: { type: 'boolean' } } } },
)

phase('StandingOrders')
const standing = await agent(
  `${RULES}\n${THESIS}\n\nTASK: Build STANDING ORDERS in ${REPO} — "the verdict that watches". Plain-English watch -> hop re-runs the verdict on a schedule -> notifies only when YOUR verdict says book.\n- lib/standing-orders.ts + a Supabase table hop_standing_orders { id uuid pk, user_id text, params jsonb (SearchParams), min_cpp numeric, seats int, eligible_programs text[], last_notified_offer text, created_at, active bool }. (Report the exact CREATE TABLE + RLS/policy SQL — do NOT run DDL.)\n- An NL parser to turn "watch SFO->Tokyo business late March, ping me above 2.5 CPP using points I hold" into a StandingOrder (reuse gateway; clamp).\n- A Vercel cron route (app/api/cron/standing-orders or vercel.ts crons) that, per active order, loads the user's live balances (getUserBalances) + runs the UNCHANGED assembleSearch(order.params, balances), compares pick.cpp + seats to the threshold, and on a crossing records it (dedupe via last_notified_offer so it fires on the VERDICT, not the same seat twice). NOTE: actual push delivery (email/web push) may need infra we don't have — if so, implement the detection + a persisted "alerts" record + an in-app "your alerts" surface, and leave a clearly-marked TODO for the push channel. GATE the cron behind an env flag so it doesn't run/charge until enabled.\n- A minimal UI to create/list/pause standing orders (on /account or its own surface).\nThis is the heaviest concept — if any part genuinely can't complete (cron infra, push), build what you can + report exactly what's stubbed and what's needed to flip it live. Report the SQL, the cron design, the UI, tsc/test/build. Use a git worktree.`,
  { label: 'concept:standing-orders', phase: 'StandingOrders', effort: 'high', isolation: 'worktree',
    schema: { type: 'object', additionalProperties: false, required: ['files','sql','cronDesign','stubbed','tscClean'], properties: {
      files: { type: 'array', items: { type: 'string' } }, sql: { type: 'string' }, cronDesign: { type: 'string' }, stubbed: { type: 'string' }, tscClean: { type: 'boolean' } } } },
)

phase('Review')
const reviews = await parallel([
  () => agent(
    `Adversarially review the new concept work in ${REPO} (lib/counterfactual.ts, lib/ledger-dream.ts, lib/standing-orders.ts + their UIs + any cron/route). Failure scenarios: model fabricating points/dollar numbers (must come from the engine on a real or perturbed clone); the counterfactual clone mutating the user's REAL stored balances (must be a pure clone, never persisted); standing-orders cron leaking across users or firing duplicate alerts; unscoped DB writes; the dream selection crashing on empty balances. file:line-cited, severity-ranked, each with a fix.`,
    { label: 'review:adversarial', phase: 'Review', effort: 'high', agentType: 'compound-engineering:ce-adversarial-reviewer',
      schema: { type: 'object', additionalProperties: false, required: ['findings'], properties: { findings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['severity','issue','file','fix'], properties: { severity: { type: 'string', enum: ['critical','high','medium','low'] }, issue: { type: 'string' }, file: { type: 'string' }, fix: { type: 'string' } } } } } } },
  ),
  () => agent(
    `Correctness review of the concept engine reuse in ${REPO}: do counterfactual/ledger-dream/standing-orders use the REAL engine (computeCpp/effectiveBalanceFor/assembleSearch) correctly? edge cases: zero balances, unknown programs, transfer-ratio math, empty results, date/seat thresholds. Verify the numbers they surface match the deterministic engine. file:line-cited, ranked, each with a fix.`,
    { label: 'review:correctness', phase: 'Review', effort: 'high', agentType: 'compound-engineering:ce-correctness-reviewer',
      schema: { type: 'object', additionalProperties: false, required: ['findings'], properties: { findings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['severity','issue','file','fix'], properties: { severity: { type: 'string', enum: ['critical','high','medium','low'] }, issue: { type: 'string' }, file: { type: 'string' }, fix: { type: 'string' } } } } } } },
  ),
])
const high = reviews.filter(Boolean).flatMap((r) => r.findings || []).filter((f) => f.severity === 'critical' || f.severity === 'high')
const fix = high.length === 0 ? { fixed: [], note: 'none' } : await agent(
  `${RULES}\n\nApply fixes for these CRITICAL/HIGH concept findings in ${REPO}:\n${JSON.stringify(high, null, 2)}\nSmallest correct change each; no regressions. Then npx tsc --noEmit (0) + npx vitest run (green) + npm run build (passes). Report fixed + deferred + results.`,
  { label: 'review:apply-fixes', phase: 'Review', effort: 'high',
    schema: { type: 'object', additionalProperties: false, required: ['fixed','deferred','tscResult','vitestResult','buildResult'], properties: {
      fixed: { type: 'array', items: { type: 'string' } }, deferred: { type: 'array', items: { type: 'string' } }, tscResult: { type: 'string' }, vitestResult: { type: 'string' }, buildResult: { type: 'string' } } } },
)

return { counterfactual, dream, standing, highFindings: high.length, fix }
