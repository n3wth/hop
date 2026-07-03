# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ This is NOT the Next.js you know

The app runs **Next.js 16.2.9 + React 19** — APIs, conventions, and file layout differ from older
Next. Before writing any framework code (route handlers, `middleware`/`proxy`, metadata, server
actions, caching, `params`/`searchParams` shapes), read the relevant guide in
`node_modules/next/dist/docs/` and heed deprecation notices. Do not assume training-data behavior.
(This rule also lives in `AGENTS.md`.)

## Repository layout

The **repo root is the Next.js app** (App Router, RSC, TypeScript, Tailwind v4) — run every command
from the root.

- `app/`, `components/`, `lib/`, `public/` — the application
- `docs/design/` — the design source of truth: `CHOSEN-editorial.html` (canonical visual
  reference), `copy-spec.md` (strict copy voice), logo assets
- `docs/plans/` — implementation plans (e.g. the flight-optimizer plan, the Eve agent design)
- `docs/decisions/` — **ADRs**: the load-bearing architectural decisions. Read the relevant one
  before changing a decided area (engine-as-source-of-truth, Eve co-location, delivery layer).
- `docs/solutions/` — **searchable solved-problems library** (YAML frontmatter). Grep here before
  solving something that looks familiar; add an entry after solving something non-obvious.
- `docs/content-plan.md` — content + destination-data strategy (sweet-spots table, SEO,
  concierge seed prompts)
- `.claude/agents/` — specialized **review subagents** (engine-invariant, degradation, copy-voice,
  nextjs16, eve-architecture, security); `.claude/commands/` — slash commands for the dev loop;
  `.claude/workflows/` — **deterministic multi-agent orchestration scripts** (review fan-out,
  plan panel, standing `/audit`) run via the Workflow tool — ADR 0006; read that folder's README
  before adding one
- `eve/` — the **Eve agent scaffold** (proactive travel agent on Vercel Eve). A separate runtime,
  deliberately **excluded** from the Next app's typecheck/lint/build (see `eve/README.md`).

## Compound engineering — how we work here

This repo is **agent-native**: each unit of work should make the next one easier. Follow the loop
(see `docs/decisions/0004-compound-engineering-operating-model.md`):

1. **Plan** — research the codebase + the relevant `node_modules/next/dist/docs/` guide first, then
   write a blueprint to `docs/plans/`. Plans are the source of truth (`/plan`).
2. **Work** — implement in the house style: flag-gated seams (`lib/env.ts`), graceful degradation
   (`withDb`, `{ok:false}` results, never throw), engine-computed numbers only.
3. **Review** — run the specialized reviewers in `.claude/agents/` in parallel over the diff and
   triage P1/P2/P3 (`/review-parallel` — backed by the `review-parallel` workflow, which adds an
   adversarial-verification stage, wherever the Workflow tool exists). Taste belongs in these
   systems, not in ad-hoc review.
4. **Compound** — capture what you learned: a `docs/solutions/` entry, a CLAUDE.md rule, a new ADR,
   or a new reviewer check so the lesson auto-catches next time (`/compound`). **Teach the system,
   don't just do the task** — context given to the system pays compounding dividends.

When you fix a non-obvious bug or make a durable decision, the work isn't done until it's captured
where the next agent (you, or another LLM via `AGENTS.md`) will find it automatically.

## Commands (run from the repo root)

```bash
npm run dev            # dev server (http://localhost:3000)
npm run build          # production build — also catches RSC/route errors
npm run lint           # eslint (next/core-web-vitals + next/typescript), cached
npm test               # vitest run (one-shot)
npm run test:watch     # vitest watch
npm run typecheck      # tsc --noEmit (strict mode)
npm run check          # lint + typecheck + test — the pre-ship gate (CI runs the same)

# single test file / single test by name (tests live in lib/__tests__/)
npx vitest run lib/__tests__/cpp.test.ts
npx vitest run -t "ranks options by cpp"

npm run dev:mock       # serve from mock fixtures (no upstream API keys needed)

npm run db:generate    # drizzle-kit generate (offline SQL from lib/db/schema.ts)
npm run db:migrate     # apply drizzle/ migrations to Neon (no-op without DATABASE_URL)
```

Vitest uses the **node** environment and only collects `lib/**/*.test.ts` and `app/**/*.test.ts`
(see `vitest.config.ts`). The `@/*` path alias maps to the repo root in both tsconfig and vitest.

## Architecture — the big picture

hop is a **points-vs-cash flight optimizer** that knows the user's real loyalty balances and
computes live cents-per-point (cpp) to tell them whether to book with points, transfer partners,
or cash. It is also growing a travel-companion layer (AI concierge, deals feed, destination
inspiration).

### The verdict engine is the moat — `lib/search.ts#assembleSearch`

Everything funnels through one function. It fans out concurrently to upstream sources, computes
per-option economics, and renders a verdict. Two invariants make the whole product resilient:

1. **It always resolves, never throws.** Upstream failures are collected into a `degraded[]`
   array (`'cash'`/`'awards'`/`'balances'`) and surfaced in the UI (`DegradedNote`), so a dead
   API degrades a section instead of crashing the page.
2. **Every number is computed, never generated.** cpp, tiers, ranking, the pick, and the verdict
   come from `lib/*` deterministic code — never from an LLM.

The cpp economics live in `lib/cpp.ts`: `cpp = (cash − taxes) × 100 / miles`; tiers are
`≥3.0 = green`, `≥1.5 = amber`, else `muted`; `POINTS_THRESHOLD_CPP = 2.5` is the line for a
`use-points` verdict. `assembleSearch` collapses the upstream firehose to the best option per
program/airline, ranks by cpp, applies the user's natural-language prefs
(`lib/prefs-model.applyPrefs`) as a filter/tiebreaker, then picks and renders the verdict +
summary (cheapest cash, best miles/cpp, $ saved).

Upstream clients (each returns a discriminated `{ok}` result, never throws):
`lib/duffel.ts` (cash), `lib/seatsaero.ts` (award space), `lib/awardwallet.ts` (balances),
plus `lib/transfers.ts` (transfer reachability) and `lib/booking.ts` (booking URLs).

### Balances: one resolver, two sources — `lib/accounts.ts#getUserBalances`

Every surface (home, deals, ask, search) consumes balances through this single resolver. It
merges **manual** programs (Neon `hop_manual_balances`, the primary path) with an optional
**AwardWallet** live link (`hop_user_accounts`), de-duped by program code; AwardWallet wins for
programs it covers, manual fills the rest. Returns `[]` (never throws) when the user has nothing;
callers decide whether to fall back to mock fixtures.

### Point valuations: static floor, observed ceiling — `lib/valuations.ts` + `lib/valuations-live.ts`

`lib/valuations.ts`'s hand-curated `BASELINE_CPP` table is the permanent fallback for what a
point/mile is worth (used mainly to ground the `/ask` concierge's prompt) and is never modified by
this pipeline — it stays pure, with no top-level I/O. `lib/valuations-live.ts` layers real,
first-party-observed cpp on top: `lib/search.ts#assembleSearch` emits each computed award option's
cpp as an observation (`lib/valuation-telemetry.ts`, fire-and-forget) to a Cloudflare Worker
(`cloudflare/valuations-worker/`), which aggregates a trimmed-mean per program; a Vercel cron
mirrors that aggregate into Neon (`lib/valuation-overrides.ts`), and a program's live cpp only
overrides the static baseline once it has **≥20 fresh samples**. The whole seam is gated behind
`HOP_ENABLE_VALUATION_SYNC` and is fully inert until `cloudflare/valuations-worker/` is deployed
and its secrets are configured (see ADR 0005).

### Auth — Better Auth on Neon (`lib/auth.ts`)

Identity is **Better Auth** with Google social login, persisted via the Drizzle adapter on
**Neon** (`lib/db/`). There is no middleware — `app/api/auth/[...all]/route.ts` serves the whole
auth surface, and sessions resolve server-side per request (`lib/session.ts#getUserId`; the
`lib/auth0.ts` compat shim keeps legacy `auth0.getSession()` call sites working — new code uses
`getUserId`). Sign-in must go through `authClient.signIn.social` (POST — Better Auth has **no**
GET sign-in URL); sign-out through `authClient.signOut()` or the `/auth/logout` route shim.
Identity is the **Better Auth `user.id`**; every `hop_*` row is scoped by `user_id` in code via
`lib/supabase-helpers.ts#withDb` (a Postgrest-compat shim over Drizzle that returns fallbacks
instead of throwing and fails CLOSED on unknown columns). Secrets resolve
`BETTER_AUTH_SECRET → AUTH_SECRET → derived from DATABASE_URL` (`lib/env.ts#resolveAuthSecret`);
the Google provider registers only when configured (`isGoogleAuthEnabled`; `GOOGLE_ID`/
`GOOGLE_SECRET` accepted as aliases). Schema: `lib/db/schema.ts`. Migrations: `drizzle/` applies
automatically during `npm run build` (`scripts/db-migrate.mjs`, no-op without `DATABASE_URL`) or
via `npm run db:migrate`. The MCP transport endpoints use Bearer hop tokens, not session cookies.

### MCP server — `app/api/[transport]/route.ts`

hop's engine is exposed as an MCP server ("Add to Claude") via `mcp-handler`. The dynamic
`[transport]` segment serves both streamable-HTTP (`/api/mcp`) and legacy SSE (`/api/sse`). Tools
(`price_trip`, `verdict`, `sweet_spots`, `transfer_paths`) call the same `lib/*` engine. Auth is
an **optional** Bearer `hop_` token (`lib/api-tokens.ts`): present → resolves to the owner's
user id and loads their real balances; absent → stateless mode with caller-supplied balances.
A user's data is only ever reachable via that user's own token.

### AI concierge — `/ask`

Streamed chat (`ai` SDK + `@anthropic-ai/sdk`, `components/ai-elements/*`, `streamdown` for
markdown) grounded in the user's real `totalPoints` + destination set. Related server logic:
`lib/concierge-*.ts`, `lib/mcp-tools.ts`, `app/api/concierge`/`conversation` routes. Seed prompts
for the composer chips are specified in `docs/content-plan.md` §5.

### Page surfaces (App Router)

`/` is **auth-aware**: signed-out renders the marketing front door (`components/landing/*`),
signed-in renders a personalized dashboard (`SignedInHome`). Other surfaces: `/ask` (concierge),
`/deals`, `/search` (+`/search/loading`), `/book` + `/book/confirmation` (checkout), `/account`
(program management), `/login`, and legal/support (`/privacy`, `/terms`, `/support`). Server
components fetch their independent data sources concurrently with `Promise.all` so a page renders
in one round-trip.

## Conventions & gotchas

- **Env access is lazy** — `lib/env.ts` reads `process.env` at *call* time (not import), so
  importing a client never throws and tests run without real keys. Use `env.*()` accessors and
  `hasEnv(key)`; never read `process.env` for these directly.
- **Feature flags gate unfinished seams.** Native Duffel checkout is off until
  `isCheckoutEnabled()` (`HOP_ENABLE_CHECKOUT` **and** a `DUFFEL_API_KEY_TEST`) — payments must
  **never** touch the live key. Gmail travel-history is off until `isGmailHistoryEnabled()`.
  Default UI keeps cash CTAs deep-linking to the affiliate (Kiwi).
- **`MOCK=1`** swaps in fixtures (`lib/mock.ts`) for cash/awards/balances; only `1`/`true`/`yes`
  count as on. A real signed-in user with no programs sees a genuine empty/onboarding state, not
  fabricated balances.
- **Graceful degradation is the house style** — `lib/*` clients and DB helpers return
  `{ok:false}`/fallbacks instead of throwing, and the UI degrades per-section.
- **Cron**: `vercel.json` runs `/api/cron/standing-orders` (every 6h), `/api/cron/revalidate-seo`
  (weekly), and `/api/cron/valuation-sync` (daily); all guarded by `CRON_SECRET`.

## Design & copy — hold this bar on any UI change

- **Flat editorial** design: **no shadows, gradients, or glows.** Depth comes from a subtle
  paper-grain background, type, color, and composition. Canonical reference:
  `docs/design/CHOSEN-editorial.html`.
- **Tailwind v4 CSS-first**: design tokens are defined in `app/globals.css` `@theme`
  (warm cream canvas, primary teal, value tiers good/ok/weak). **WCAG AA is required** — token
  colors were already darkened to pass; don't regress contrast. Prefer tokens over hardcoded hex.
- **Type**: Bricolage Grotesque (display, `.font-display`), General Sans (body), Fraunces italic
  (`.wordmark`).
- **Motion**: restrained, transform-only entrance micro-interactions (`.hop-rise`, value bars,
  bunny leap) — all gated behind `prefers-reduced-motion`. Single easing token
  `var(--ease-premium)`. **No hover movement, anywhere** — `:hover`/`group-hover:` never
  triggers `translate`/`scale` (no card lift, no arrow nudge). Hover is `transition-colors`
  only (`hover:border-brand`, `hover:text-*`). `.hop-press`/`.hop-press-card`'s `:active`
  scale-down is tap feedback on click, a separate interaction, and is unaffected.
- **Copy voice (strict, see `docs/design/copy-spec.md`)**: terse, confident, plain. State the
  answer and the number. No marketing slop/clichés, no emoji spam, no over-cute bunny chatter.
  The bunny is the **logo + one warm moment per region**, never a narrator on every row.
