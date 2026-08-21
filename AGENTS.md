<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

The app runs **Next.js 16.2.9 + React 19** — before writing any framework code (route handlers,
`middleware`/`proxy`, metadata, server actions, caching, `params`/`searchParams` shapes), read the
relevant guide in `node_modules/next/dist/docs/`. Do not assume training-data behavior.

> This is the single rules file for every agent (Claude Code resolves it via `CLAUDE.md`'s
> `@AGENTS.md` import; Cursor, Codex, Copilot, Jules read it directly). **If you are a
> smaller/less-capable model, read `docs/agent-playbook.md` first** — it encodes the operating
> judgment (the loop, the invariants, the design canon, the taste-call protocol) so you can
> follow it without re-deriving it.

# Repository layout

The **repo root is the Next.js app** (App Router, RSC, TypeScript, Tailwind v4) — run every command
from the root.

- `app/`, `components/`, `lib/`, `public/` — the application
- `docs/design/` — the design source of truth: `CHOSEN-editorial.html` (canonical visual
  reference), `copy-spec.md` (strict copy voice), logo assets
- `docs/plans/` — implementation plans. **`2026-07-04-business-plan.md` is the adopted
  business plan** (positioning, pricing, gates). **`2026-08-20-path-to-first-dollar.md`
  sequences the next 90 days**; **`2026-08-21-replace-seatsaero.md`** is the award-data
  replacement (gate ④). Start there when deciding what to build next.
- `docs/decisions/` — **ADRs**: the load-bearing architectural decisions. Read the relevant one
  before changing a decided area.
- `docs/solutions/` — **searchable solved-problems library** (YAML frontmatter). Grep here before
  solving something that looks familiar; add an entry after solving something non-obvious.
- `docs/meta/` — the dev process itself as portable patterns + starter kits for other repos
- `.claude/agents/` — specialized **review subagents** (engine-invariant, degradation, copy-voice,
  nextjs16, eve-architecture, security); `.claude/commands/` — slash commands for the dev loop;
  `.claude/workflows/` — **deterministic multi-agent orchestration scripts** run via the Workflow
  tool (ADR 0006; read that folder's README before adding one)
- `eve/` — the **Eve agent scaffold** (a separate Vercel Eve runtime), deliberately **excluded**
  from the Next app's typecheck/lint/build — do not add it to the build graph (`eve/README.md`).

# Compound engineering — how we work here

This repo is **agent-native**: each unit of work should make the next one easier. Follow the loop
(see `docs/decisions/0004-compound-engineering-operating-model.md`):

1. **Plan** — research the codebase + the relevant `node_modules/next/dist/docs/` guide first, then
   write a blueprint to `docs/plans/`. Plans are the source of truth (`/plan`).
2. **Work** — implement in the house style: flag-gated seams (`lib/env.ts`), graceful degradation
   (`withDb`, `{ok:false}` results, never throw), engine-computed numbers only.
3. **Review** — run the specialized reviewers in `.claude/agents/` in parallel over the diff and
   triage P1/P2/P3. On a harness with the Workflow tool, the lanes are already scripted — run the
   saved workflows in `.claude/workflows/` (`review-parallel`, `plan-panel`, `invariant-audit`)
   instead of improvising dispatch (ADR 0006). On any other harness, the `.claude/commands/*`
   files are the same process as plain-prose recipes — follow them manually; the loop is designed
   to lose cost, not shape, on smaller models (`.claude/workflows/README.md` §Model portability).
4. **Compound** — capture what you learned: a `docs/solutions/` entry, an AGENTS.md rule, a new
   ADR, or a new reviewer check so the lesson auto-catches next time (`/compound`). **Teach the
   system, don't just do the task.** When you fix a non-obvious bug or make a durable decision,
   the work isn't done until it's captured where the next agent will find it automatically.

**Non-negotiable invariants:**

- Every economic number (cpp, miles, price, verdict) is computed by `lib/*` — **never** generated
  by an LLM. Agents narrate computed values; they don't invent them.
- Graceful degradation: persistence goes through `lib/supabase-helpers.ts#withDb`; clients return
  `{ok:false}`/fallbacks and **never throw**.
- New seams ship **flag-gated** (`lib/env.ts`) and degrade to a clean no-op when unconfigured.
- Copy voice is strict (`docs/design/copy-spec.md`): terse, state the number, no marketing slop,
  no emoji.

Write every `docs/solutions/` entry for a reader new to LLM-assisted development — define terms
on first use, lead with what/why in plain language.

# Worktree quickstart — any agent (Cursor, Codex, Devin, Claude, human)

The unit of work is a **fresh worktree off `origin/main` → PR → merge**. Never commit to `main`
(a git `pre-commit` hook enforces this once setup has run). The whole loop:

```bash
git worktree add /tmp/<name> origin/main -b <type>/<branch>   # fresh, isolated checkout
cd /tmp/<name>
scripts/setup-worktree.sh              # .env.local (MOCK=1) + npm ci + git main-guard
scripts/setup-worktree-auth.sh         # ONLY if you need sign-in (/account, /admin):
                                       #   pulls secrets from 1Password "Hop Local Dev",
                                       #   runs db:migrate (needs `op` CLI signed in)
npm run dev                            # fixtures — no upstream keys needed
npm run check                          # migration-sequence check + lint + typecheck + tests — the pre-ship gate
npx vitest run lib/__tests__/<f>.test.ts   # single test file; -t "name" for one test
git commit …                           # verify `git branch --show-current` ≠ main first
git push -u origin <type>/<branch>
gh pr create --head <type>/<branch> --base main   # --head EXPLICITLY (worktree inference fails)
gh pr merge <type>/<branch> --merge --auto --delete-branch
git -C <main-checkout> worktree remove /tmp/<name>   # after merge
```

- **Never bundle a PR with unrelated WIP.** This repo runs many concurrent worktrees, so a
  checkout often has unrelated uncommitted changes sitting in it. Check `git status` first; if
  there's unrelated WIP, branch off `origin/main` in a fresh worktree, copy in only your files,
  and PR from there.
- Cursor's native worktrees run `scripts/setup-worktree.sh` automatically (`.cursor/worktrees.json`).
- `MOCK=1` fixtures are the default; don't wire a shared `DATABASE_URL` into a worktree unless the
  task genuinely needs persistence (parallel migrations against one Neon DB race each other).
- Local Google sign-in uses the same OAuth client as prod (project `hop-auth`); callbacks for
  `localhost:3000` and `:3001` are pre-authorized. `redirect_uri_mismatch` on another port → add
  that port's callback in Cloud Console (see `docs/solutions/2026-07-05-local-google-oauth-redirect-uri.md`).

# What to build next

**`docs/plans/2026-07-04-business-plan.md` is the adopted business plan** — positioning,
pricing, revenue streams, and the four §3.1 billing gates. **Sequencing for the next 90 days
is `docs/plans/2026-08-20-path-to-first-dollar.md`.** Pickup: **FD-copy** (stop calling
observations "live bookings") then **FD-charts** (chart-cpp replacement — N-386
re-specified; spec `2026-08-21-replace-seatsaero.md` §5). Gate ④ passes when that is
in production **and** the Production key is unset — chart quality is not the gate.
Then **FD-live** only after seats.aero is off Production **and** founder/counsel signs
the first recipe. Skip shipped July 4 B1–B4 epics, design-system callsites, and
seats.aero-primary failover. If Linear still says "written terms" / "failover," the
2026-08-21 plan wins. Items marked **owner** (A-terms remaining env flip — default:
billing off **now**, A-hn, A-mcp PR #409, A-gov PR #373, A-cards, R3.4) are human-only
— flag them, don't attempt them.

The work queue is mirrored in Linear (team `n3wth`, project
[hop](https://linear.app/newth/project/hop-9365da373b9a)). If Linear disagrees with the
first-dollar pickup rule, the first-dollar plan wins for 90 days. Billing is not
*legitimate* until the four §3.1 gates pass (gate ④ = Partner API not called **and**
Production key unset, ADR 0014). The billing *flag* being ON does not satisfy that.
**④ ≠ keep billing ON** — alerts/MCP must not claim space on chart (④b). Spec:
`docs/plans/2026-08-21-replace-seatsaero.md`.
The **ambition layer** is `docs/plans/2026-07-05-media-engine-to-1m.md` (M-series). It does
not jump the first-dollar queue. The 2026-07-05 "$10k MRR in 30 days" target expired
2026-08-05 at $0 and is not a planning input. Company-scale (MCP listing + one B2B
conversation) runs **in parallel** with consumer first-dollar, not after a Floor chase.

**Autonomous sessions** (Claude Code routines, delegated agents): `docs/autonomy-runbook.md`
governs your run — queue rules, the merge policy (ADR 0009: merge only when CI is green,
reviews are clear, and every changed path is auto-tier; the runbook's `Auto-merge:` line is the
kill switch), hard guardrails (one item per run; flags/env/money stay human), the git-fallback
mode when Linear is unreachable, and the mandatory compound step (`docs/autonomy-log.md` +
runbook amendments).

# Commands (run from the repo root)

```bash
npm run dev            # dev server (http://localhost:3000)
npm run build          # production build — also catches RSC/route errors
npm run lint           # eslint (next/core-web-vitals + next/typescript), cached
npm test               # vitest run (one-shot)
npm run test:watch     # vitest watch
npm run typecheck      # tsc --noEmit (strict mode)
npm run check          # migration-sequence check + lint + typecheck + test — the pre-ship gate (CI runs the same)

# single test file / single test by name (tests live in lib/__tests__/)
npx vitest run lib/__tests__/cpp.test.ts
npx vitest run -t "ranks options by cpp"

npm run dev:mock       # serve from mock fixtures (no upstream API keys needed)

npm run db:generate    # drizzle-kit generate (offline SQL from lib/db/schema.ts)
npm run db:migrate     # apply drizzle/ migrations to Neon (no-op without DATABASE_URL)
```

Vitest uses the **node** environment and only collects `lib/**/*.test.ts` and `app/**/*.test.ts`
(see `vitest.config.ts`). The `@/*` path alias maps to the repo root in both tsconfig and vitest.

# Architecture — the big picture

hop is a **points-vs-cash flight optimizer** that knows the user's real loyalty balances and
computes live cents-per-point (cpp) to tell them whether to book with points, transfer partners,
or cash. It is also growing a travel-companion layer (AI concierge, deals feed, destination
inspiration).

## The verdict engine is the moat — `lib/search.ts#assembleSearch`

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

## Balances: one resolver, two sources — `lib/accounts.ts#getUserBalances`

Every surface (home, deals, ask, search) consumes balances through this single resolver. It
merges **manual** programs (Neon `hop_manual_balances`, the primary path) with an optional
**AwardWallet** live link (`hop_user_accounts`), de-duped by program code; AwardWallet wins for
programs it covers, manual fills the rest. Returns `[]` (never throws) when the user has nothing;
callers decide whether to fall back to mock fixtures.

## Point valuations: static floor, observed ceiling — `lib/valuations.ts` + `lib/valuations-live.ts`

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

## Auth — Better Auth on Neon (`lib/auth.ts`)

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

## MCP server — `app/api/[transport]/route.ts`

hop's engine is exposed as an MCP server ("Add to Claude") via `mcp-handler`. The dynamic
`[transport]` segment serves both streamable-HTTP (`/api/mcp`) and legacy SSE (`/api/sse`). Tools
(`price_trip`, `verdict`, `sweet_spots`, `transfer_paths`, `compare_programs`,
`best_card_for_program`) call the same `lib/*` engine. Auth is
an **optional** Bearer `hop_` token (`lib/api-tokens.ts`): present → resolves to the owner's
user id and loads their real balances; absent → stateless mode with caller-supplied balances.
A user's data is only ever reachable via that user's own token.

## AI concierge — `/ask`

Streamed chat (`ai` SDK + `@anthropic-ai/sdk`, `components/ai-elements/*`, `streamdown` for
markdown) grounded in the user's real `totalPoints` + destination set. Related server logic:
`lib/concierge-*.ts`, `lib/mcp-tools.ts`, `app/api/concierge`/`conversation` routes. Seed prompts
for the composer chips are specified in `docs/content-plan.md` §5.

## Page surfaces (App Router)

`/` is **auth-aware**: signed-out renders the marketing front door (`components/landing/*`),
signed-in renders a personalized dashboard (`SignedInHome`). Other surfaces: `/ask` (concierge),
`/deals`, `/sweet-spots`, `/destinations`, `/points` (value-oriented redemption/inspiration
surfaces), `/pricing`, `/search` (+`/search/loading`), `/book` + `/book/confirmation` (checkout),
`/account` (program management), `/admin` (owner-only), `/login`, and legal/support (`/privacy`,
`/terms`, `/support`) — not an exhaustive list; see README.md's "Key routes" for the curated
subset and `app/` for the full route tree. Server components fetch their independent data sources
concurrently with `Promise.all` so a page renders
in one round-trip.

# Conventions & gotchas

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
- **Cron**: `vercel.json` runs ten jobs, all guarded by `CRON_SECRET` — `/api/cron/standing-orders`
  and `/api/cron/awardwallet-sync` (every 6h), `/api/cron/balance-autosync` and
  `/api/cron/sweet-spot-candidates` (daily), `/api/cron/valuation-sync` and
  `/api/cron/sync-stripe` (daily), `/api/cron/revalidate-seo` and `/api/cron/newsletter-digest`
  (weekly), `/api/cron/business-digest` (weekly), and `/api/cron/health-sentinel` (daily). See
  `vercel.json` for exact schedules — don't restate them here, they drift (see
  `docs/solutions/2026-07-09-stale-claude-agent-instructions-after-platform-migration.md`).
- **Ops**: turning any production capability on/off (alerts, valuation sync, self-improve,
  billing, checkout, auth flags) is documented in `docs/ops-runbook.md`; `.env.example`
  enumerates every env var the app reads.
- **Multi-agent hygiene** (see `docs/solutions/2026-07-05-*.md`): after any merge-conflict
  resolution, grep for leftover `<<<<<<<`/`=======`/`>>>>>>>` markers and run `npm run check`
  before pushing. Mark roadmap items done only with a commit/PR link; grep for a feature before
  proposing to build it. Byte-compare stray uncommitted files against `origin/main` before
  committing them — they may be stale pre-merge artifacts. Regenerate Drizzle migrations after
  rebasing; never hand-edit the sequence number. When an ADR supersedes a platform/architecture
  decision, grep `.claude/agents/`, `.claude/commands/`, and `.claude/workflows/` for the old
  stack's terms and update reviewer instructions in the same PR — stale references send reviewer
  subagents hunting for files/concepts that no longer exist
  (`docs/solutions/2026-07-09-stale-claude-agent-instructions-after-platform-migration.md`).

# Design & copy — hold this bar on any UI change

- **Flat editorial** design: **no shadows, gradients, or glows.** Depth comes from a subtle
  paper-grain background, type, color, and composition. Canonical reference:
  `docs/design/CHOSEN-editorial.html`.
- **Primitives index**: New UI composes `components/ui/*` — a hand-rolled button, chip, card, field, or stat recipe in a diff is a defect; index in `docs/design/DESIGN-SYSTEM.md`.
- **Experience heuristics** (`docs/design/experience-heuristics.md`) govern composition:
  imagery is structural (in-flow grid), never absolutely-positioned ornament; no element ever
  covers text; motion is content changing (slow cross-fades), never idle decoration; verify
  every UI change by screenshot at 390/768/1360/1512/1920 before calling it done.
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

# Content data — committed snapshots, regenerable offline

Destination content is grounded in **real data fetched once, offline, and committed** — the live site
never calls these APIs at request time (keeps `force-static` builds deterministic and sidesteps
rate-limits / non-commercial *endpoint* terms; the underlying *data* licenses allow redistribution).
Each dataset has a regenerator under `scripts/`; re-run it and commit the output to refresh. See
**`docs/content-apis.md`** for the full sourcing + licensing rationale.

- `lib/climate-normals.ts` ← `scripts/gen-climate-normals.mjs` — ERA5 monthly normals (Open-Meteo,
  CC BY 4.0). `lib/climate.ts#computeSeasonality` derives the honest, per-city "when to go" verdict.
- `lib/place-facts.ts` ← `scripts/gen-place-facts.mjs` — currency (Wikidata, CC0), timezone
  (Open-Meteo), USD FX snapshot (Frankfurter/ECB). `lib/place-info.ts` renders the essentials chips +
  the computed "how far your dollar goes" line. **Wikidata's raw language/currency-name fields are
  noisy** — they're curated in the script; the codes/timezone/FX stay sourced.

Same invariant as the engine: these are **real, looked-up, date-stamped values, never LLM-generated**.

# Dynamic images

- **OG/social cards** are computed per page via `next/og` (`app/**/opengraph-image.tsx`) sharing
  `lib/og.tsx` (bunny mark, brand hex — Satori can't read CSS vars, fonts vendored under `lib/fonts/`
  as TTF/OTF/WOFF since `next/font` ships WOFF2). They carry the **same `lib/cpp` verdict the page
  shows**. Routes are statically prerendered, so fonts are read only at build.
- **Photo placeholders**: `lib/blurhash.ts` decodes the Unsplash `blur_hash` (`lib/images.ts` captures
  it) to a tiny blurred SVG + avg color; image frames use it as their background so a still-loading
  `<img>` fades up from a blur of itself. No client JS, no-JS-safe.

# Visual verification on agent harnesses

`npm run build` catches RSC/route errors. To actually *see* a page, screenshot **localhost** with the
pre-installed headless Chromium — but two gotchas: (1) `next start` will **not persist** as a detached
background process here, and (2) the agent proxy **closes Chromium's connection to any external URL**
(`ERR_CONNECTION_CLOSED`), so you can't screenshot the Vercel preview. Both are handled by the helper —
after a build, one command shoots any set of paths:

```bash
npm run build && scripts/shoot.sh / /deals /destinations/tokyo   # → /tmp/shot-*.png
```

It starts the server and takes the shots inside **one** foreground command (so the server stays alive
during capture) and kills it on exit. `UNSPLASH_ACCESS_KEY` gates destination photos (absent → the
solid/blur fallback), and `MOCK=1` swaps in cash/awards/balances fixtures — set both in the environment
(see `.env.example`) for full-fidelity local shots; without the key you still verify
**layout / spacing / cohesion**, just not the imagery. Rebuild before shooting after any code change
(the static pages are prebuilt). For the real prod render, push and let the Vercel **preview** deploy —
the human reviews it.

New containers: point the environment's **setup script** at `scripts/setup-cloud.sh` (installs deps);
the two visual-loop vars go in the environment settings, not in the repo. The full settings
template (setup script + env tiers + what to leave unset) is `docs/cloud-env.md`.

# Claude Code specifics (harmless elsewhere)

- **Concierge/prompt work (`lib/concierge-*.ts`, `/ask`)**: iterate against `MOCK=1` fixtures, not
  live upstream calls — cheaper and faster per turn. Lock in deterministic logic (cpp, tiers,
  ranking) with `npm run test:watch` on `lib/__tests__/`; reserve live Anthropic calls for
  checking tone/voice against `docs/design/copy-spec.md`, not correctness.
- **Sessions**: keep context small so turns stay fast — `/compact` before ~60% context, delegate
  exploration/research to subagents (`Explore`, `general-purpose`) instead of doing wide searches
  inline, and use `/review-parallel` instead of manually rereading a diff.
- **Cheap-model routing** (evidence: `docs/solutions/2026-07-05-cheap-model-iteration-playbook.md`):
  default sessions run Sonnet; Fable/Opus only for plans, architecture/design judgment, or after
  two failed fix attempts. Screenshot/UI loops run in a subagent that returns conclusions, not
  images. Native Grep/Glob/Read over Bash grep/rg/cat; `| tail` build output; no `echo` status
  narration; never re-Read a file already in context.
