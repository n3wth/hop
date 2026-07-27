# The hop agent playbook — how to work here so it compounds

> For every model that works on hop, especially smaller ones — and for a human who is new to
> LLM-assisted development and wants to understand how this repo runs itself. This encodes the
> operating principles behind the 2026-07 elevation run (native /ask, the icon system, the
> memory spine, monetization Phase 1) so the same quality is reproducible without the same
> horsepower. Follow it mechanically; the judgment is already baked in.
>
> **If a term below is unfamiliar**, check this list once, then keep reading — the rest of the
> doc assumes you know these:
>
> - **Worktree** — a second, independent working copy of this repo on disk, checked out to its
>   own branch, so one agent's in-progress edits never collide with another's. `git worktree
>   add /tmp/<name> origin/main -b <branch>` creates one; you `cd` into it like a normal clone.
> - **Branch** — a named, independent line of commits. `main` is the one Vercel deploys to
>   production; every change starts on its own branch off `main`.
> - **PR (pull request)** — a proposal to merge one branch's commits into another (almost always
>   into `main`), reviewable before it lands. A **draft PR** is explicitly marked "not ready
>   yet" — it exists so automated review can run on it, but it can't be merged until it's marked
>   ready.
> - **CI (continuous integration)** — automated checks (lint, type-check, tests, build) that run
>   against a PR's code before anyone merges it, so broken code is caught by a machine, not by
>   the next person to pull `main`.
> - **Branch protection** — GitHub settings on a branch (here, `main`) that can block force
>   pushes, deletions, or merges until a named check passes. It is a technical backstop, not a
>   substitute for the house rule below.
> - **ADR (architecture decision record)** — a short, dated doc in `docs/decisions/` recording a
>   decision that was made once, with its reasoning, so nobody re-litigates it from scratch.
> - **Flag-gated** — a feature wrapped in an environment-variable check (`HOP_ENABLE_*`) so it
>   ships in the codebase but does nothing until explicitly turned on in production.

## The goal

**$10k+ MRR by 2026-08-05** (declared 2026-07-05; the "$10k-MRR-within-30-days" target in
`docs/plans/2026-07-05-agentic-travel-agent-northstar.md`, whose "The revenue goal" section also
sets the weekly gates — Wk2/Wk4 checkpoints — every desk works against). Where the two disagree
on priority, the board's amendment list in the latest `docs/board/<date>-board-memo.md` overrides
this playbook's own §9 ordering.

**Ownership order, explicit (from 2026-07-12):** the board (`docs/board/`, weekly, Sunday
13:00 UTC) is the periodic deep, adversarial check; the strategy desk (`docs/strategy/`, Marcus,
Sunday 15:00 UTC) is the weekly tracker. **When the two conflict, the latest board memo's
amendment list wins** — the board's job is explicitly to check whether the org followed through
on prior amendments, so its ranking is the more authoritative, harder-won one. Adopt the latest
board memo's amendment list as-is; fall back to the strategy desk's ranking only for priority
questions the current board memo doesn't address, and fall back further to re-deriving from the
business plan's own sequencing only if neither review exists yet.

**Known scheduling bug (flagged 2026-07-12, still not fixed as of 2026-07-19 — 2nd week
running):** the board's cron (`0 13 * * 0`) fires two hours before the strategy desk's
(`0 15 * * 0`) every Sunday (`docs/team/routines.md`), so a given week's board review can never
see that same week's strategy output — only the prior week's (or none, in the strategy desk's
first weeks). This is why board memos may read the strategy desk as "silent" when it has simply
not run yet that day. Worth fixing by moving one of the two crons; until then, read a "no
`docs/strategy/` file newer than last week" finding as an artifact of ordering, not a desk
failure, unless multiple weeks pass with still nothing. Fixing this cron ordering is itself
`[agents-can-execute]` — see the latest board memo's ranked amendment list.

**Ownership order reaffirmed (2026-07-19):** the board memo dated 2026-07-19
(`docs/board/2026-07-19-board-memo.md`) independently re-confirmed the ownership order above —
its own ranked amendment list (§7) is this week's authoritative priority order, and it found the
org executing on roughly 1 of 13 of the prior week's board amendments, so treat "the board's list
is the harder-won, more authoritative one" as load-bearing, not aspirational: a desk that finds
its own prior-week asks unmet should escalate rather than silently re-derive a fresh ranking.

**Ownership order reaffirmed again (2026-07-26):** the board memo dated 2026-07-26
(`docs/board/2026-07-26-board-memo.md`, open/unmerged — PR #333) and the strategy desk's
2026-07-26 review (`docs/strategy/2026-07-26-weekly-strategy.md`, open/unmerged — PR #334, which
explicitly adopts the board's list as-is per this same ownership rule) agree: the board's ranked
amendment list is current. This retro adopts that list in §10 below. Read both from their open
PRs, not `main` — neither has merged yet, because both are queued behind the merge-pipeline stall
§10 describes.

**Ongoing priority ownership (from 2026-07-06):** the board memo above was a one-time review; the
strategy desk (Marcus, `docs/team/routines.md`) now owns re-ranking priority on a weekly cadence
via `docs/strategy/<date>-weekly-strategy.md`. Once Marcus has run at least once, his latest file
is the current priority order — see the pointer at the top of §9.

## Reliability practices

Plain-language ground rules for running this as an unattended agent fleet. Where a
`docs/solutions/2026-07-05-*.md` entry already covers the mechanism in depth, this list points at
it rather than repeating it.

- **One unit of work per run** bounds cost and blast radius (blast radius = how much of the
  system a single mistake could reach). A scheduled desk does exactly one well-chosen thing per
  run instead of chaining unrelated work, so a bad run costs one unit, not a cascade.
- **Done-claims need PR links.** A claim that something shipped doesn't count without an attached
  commit/PR link — `docs/solutions/2026-07-05-roadmap-done-claims-need-evidence.md`.
- **Least-privilege connectors.** A connector is a third-party integration (Linear, PostHog,
  AgentMail, etc.) a routine is allowed to call. The claude.ai platform auto-attaches **all** of
  the account's connectors to any newly created routine by default — always strip that down to
  the short list the desk actually needs (see the connector column in `docs/team/routines.md`'s
  desk table).
- **Human approval only for money, identity, or anything irreversible** — spending, charging,
  transferring points, canceling a booking, changing auth/credentials. Everything reversible, a
  desk handles on its own.
- **Liveness monitoring.** Scheduled checks ("crons") on Oliver's Mac mini, run by his own agent
  there (Hermes), confirm the fleet is actually alive: `hop-uptime-watchdog` runs daily and stays
  silent unless something is failing; `hop-watchdog-heartbeat` runs Mondays as a positive
  "still alive" signal; `hop-org-liveness-watchdog` runs Tuesday and Friday and checks that each
  desk produced output within its own cadence window (e.g. the growth desk should show activity
  every Mon/Wed/Fri). All three alert Oliver on Telegram. **Known gap:** as of 2026-07-05,
  `hop-org-liveness-watchdog` checks branch *recency* only — a branch existing and being recent
  does not mean the desk actually shipped (its push could have landed but the PR creation or CI
  silently failed afterward, and recency alone would still read "alive"). `npm run verify:desk
  -- <prefix>` (`scripts/verify-desk-run.mjs`) is the deterministic, non-agentic replacement:
  given a branch prefix it independently confirms via `gh api`/`gh pr checks` that the branch's
  latest commit has a PR, that PR's head SHA matches the branch HEAD, and that PR is either
  merged or fully green — exiting non-zero on anything short of that. The watchdog's crontab
  itself lives on the mini and isn't reachable from this repo; it still needs to be updated to
  call this script per desk prefix instead of its current recency check.
- **Kill switch.** Disable the routine at https://claude.ai/code/routines — the single, immediate
  way to stop a desk.
- **Single-writer per surface.** Each desk owns its own branch prefix (`autopilot/`, `growth/`,
  `retro/`, `finance/` — see `docs/team/routines.md`) so two desks never race to edit the same
  branch.
- **`docs/team/routines.md` is canonical.** If a routine's schedule or prompt ever needs to be
  recreated or audited, that file — not whatever happens to be configured in the claude.ai UI —
  wins; bring claude.ai's config back into line with it, never the other way around.

## 1. How work ships here

One task = one worktree off `origin/main` = one branch = one **draft** PR. Never commit to
`main` directly, and never push straight to it — even for a one-line fix.

1. `git worktree add /tmp/<name> origin/main -b <branch>` — always branch from a freshly
   fetched `origin/main`, never from whatever a shared checkout happens to have staged (see
   the "Multi-agent hygiene" rule in `AGENTS.md` — a checkout routinely has unrelated
   in-progress work sitting in it).
2. Implement the change, verify it (§2 and §6 below), commit, push.
3. Open a **draft** PR: `gh pr create --draft --head <branch> --base main`. Draft, not ready —
   this repo's review step runs on drafts before anything is eligible to merge.
4. The **`pr-merge-pipeline` workflow** (`.claude/workflows/pr-merge-pipeline.js`, manual
   fallback `.claude/commands/pr-merge-pipeline.md`) takes it from there: three reviewers
   (engine invariants, security, style) run in parallel against the diff, confirmed P1s get
   fixed on the same branch, and the PR is marked ready and merged only once CI is green and
   review is clean.
5. **Immediately before merging, update the branch against `main`** —
   `gh pr update-branch <PR>` (or `git fetch origin main && git merge origin/main`), then wait
   for the check to re-run green — before `gh pr merge --squash`. This is a hard rule, not a
   suggestion: `main`'s branch protection does **not** currently require a PR's branch to be
   up to date with `main` before merging (`required_status_checks.strict` is `false` — verify
   with `gh api repos/n3wth/hop/branches/main/protection`), so two desks merging within minutes
   of each other can each show a green check that only proves their *own* branch built cleanly
   against a `main` that no longer exists by the time they land — a stale-base race, the same
   failure shape as `docs/solutions/2026-07-05-half-resolved-merge-broke-main.md` but from two
   independently-green PRs instead of a botched conflict resolution. Updating the branch
   immediately before merge is the repo-side substitute for GitHub's `strict` setting; several
   PRs already did this ad hoc the night that incident happened — this makes it a rule instead
   of tribal knowledge every desk has to rediscover.
6. Autonomous sessions additionally follow `docs/autonomy-runbook.md` (queue order, the ADR
   0009 tiered auto-merge policy, the hold-for-owner list — migrations, money/identity code,
   `.github/workflows/**`, `vercel.json`, dependency bumps, displayed prices, `eve/`). Anything
   on that hold list waits for the owner regardless of how green the PR is.

**Where "never touch main directly" is enforced today, and where it isn't yet:** `main`'s
branch protection currently requires the `Vercel` status check and blocks force-pushes and
branch deletion — it does **not** yet require a PR review or block a direct push from someone
with write access, and it does **not** require a PR's branch to be current with `main` before
merging (§1.5 above is the repo-side stand-in for that gap). Treat "PR-only, never direct" as
an absolute house rule regardless of what GitHub's settings technically allow (see the open
thread below; a direct push to `main` has already happened once by accident —
`docs/solutions/2026-07-05-half-resolved-merge-broke-main.md`). Turning on GitHub's
`required_status_checks.strict` and a required-review rule would close both gaps at the
platform level instead of relying on every desk following §1.5 — that's a repo-settings change
for the owner to make, not something a desk should flip on its own.

Cross-references: `docs/ops-runbook.md` (turning production capabilities on/off — the switches
this repo actually has, and what each needs before it does anything), `.claude/workflows/README.md`
(what the saved workflow scripts are, the house patterns behind them, and the plain-prose
fallback for harnesses without the Workflow tool).

## 2. The loop — never skip a lane

**Plan → Work → Review → Compound.** In practice:

1. **Read before you reason.** Open the actual files you'll change, the relevant
   `docs/plans/*` blueprint, `AGENTS.md`, and — for anything framework-level — the guide in
   `node_modules/next/dist/docs/`. Never work from memory of "how Next works"; this repo is
   Next 16 + React 19 and your training data is wrong somewhere. Grep for a feature before
   proposing to build it — verify against the code, not the roadmap doc
   (`docs/solutions/2026-07-05-roadmap-done-claims-need-evidence.md`).
2. **Work in the smallest shippable slice.** One cohesive PR per concern. If your diff wants
   to do two things, it's two PRs. XS/S/M only — split anything larger.
3. **Verify with all four, every time:** `npx tsc --noEmit` · `npm run lint` · `npm test` ·
   `npm run build` (or the single `npm run check` + `npm run build` combo). Green on all four
   is the *floor*, not the finish.
4. **Review before merge.** Run the specialist reviewers over the diff (`/review-parallel`, or
   the review workflow if available) — or let `pr-merge-pipeline` do it per §1. Fix confirmed
   P1/P2s; log P3s. Never merge on "looks right to me."
5. **Compound.** If you learned something durable — a rule, a fix pattern, a gotcha — it goes
   into `docs/solutions/`, `DESIGN-SYSTEM.md`, or `AGENTS.md` in the *same* PR. Work that
   doesn't teach the system is half-done. Mark a roadmap item done only with a commit/PR link
   attached, in both directions (don't mark something done without evidence, and don't propose
   building something already shipped).

## 3. The invariants — violating any of these is an automatic P1

- **Numbers are computed, never generated.** cpp (cents-per-point: `(cash − taxes) × 100 /
  miles`) / miles / prices / verdicts / $ saved come from `lib/*` deterministic code. An LLM
  may narrate a number the engine produced; it may never produce one. No number is stored where
  it can go stale (calendars, summaries, memory).
- **Degrade, never throw.** `lib/*` clients and DB helpers return `{ok:false}` / `[]` / `''`
  via `withDb`; surfaces degrade per-section (`DegradedNote`). A dead upstream dims a card —
  it never crashes a page.
- **Flag-gated seams.** Unfinished or costly capability ships **dark** behind `HOP_ENABLE_*`
  (checked lazily via `lib/env.ts` — never `process.env` directly) and no-ops byte-for-byte
  when off. Migrations are Drizzle-only: authored `IF NOT EXISTS` in `lib/db/schema.ts`, never
  executed by app code. After a rebase that picks up new migrations, regenerate with
  `npm run db:generate` — never hand-edit a migration's sequence number
  (`docs/solutions/2026-07-05-parallel-migration-numbering.md`).
- **Your data, your token.** Every DB query filters by the signed-in user's id in code — Neon
  via Drizzle has no RLS to fall back on, so the `user_id` scoping in `withDb` IS the entire
  security boundary (`docs/decisions/0011-platform-stack-rationale.md`). Confirm/dismiss/delete
  re-scope to the caller's own row.
- **Money is human-gated.** Nothing books, charges, or spends without an explicit user
  action; payments never touch the live Duffel key.

## 4. Design — the canon decides, not your taste

The design system is *law you look up*, not vibes you generate:

- **Tokens only.** Radii `--radius-sm/10 · --radius/14 · --radius-lg/20 · --radius-hero/28`;
  colors from `@theme` in `app/globals.css`; containers `--container-sm` (prose) and
  `--container-shell` (app surfaces); tracking `--track-eyebrow/label/tag`. A hardcoded hex or
  off-scale radius in your diff is a defect.
- **Flat is the law:** no shadows, no gradients (photo-legibility scrims excepted), no glows.
  Depth = paper grain + type + color + composition. Hover = color only (plus the two
  sanctioned micro-moves: image zoom-in-frame, arrow nudge). Everything transform-only and
  gated behind `prefers-reduced-motion`.
- **Icons:** sizes 12/16/20/24 only (the type enforces it), `regular` weight unless it's a
  status mark or brand tile, and one concept = one glyph (the table in DESIGN-SYSTEM.md).
  When you need an icon, look it up; when it's not in the table, ask whether you need an
  icon at all (usually: no).
- **Copy:** terse, confident, state the answer and the number (`docs/design/copy-spec.md`).
  No marketing slop, no emoji spam. The bunny is a logo plus at most one warm moment per
  region — never a narrator.
- **WCAG AA always:** contrast, focus-visible, labels on icon-only controls, `aria-live` for
  streamed content, focus trap + restore in overlays. And never combine `items-center` with
  `overflow-y-auto` on the same element (top overflow becomes unreachable — we shipped and
  fixed that bug; don't re-ship it).

## 5. Taste calls — decide, write it down, move

When two options are defensible: pick the one that (a) follows an existing pattern in this
repo over inventing one, (b) follows platform convention over novelty (chat surfaces behave
like chat apps), (c) is honest over impressive (a `warning` glyph on a degraded note, a true
"Best value" label). Then **write the decision and rationale into the relevant doc** so it's
settled once. A taste call made silently will be re-litigated forever.

## 6. Process mechanics that keep the fleet fast

- **Main moves every ~20–30 minutes.** Fetch and rebase before you open a PR; resolve
  conflicts by *keeping both intents* (read what the other change wanted). After resolving any
  conflict, grep the touched files for leftover `<<<<<<<`/`=======`/`>>>>>>>` markers and run
  `npm run check` before pushing — a half-resolved conflict has broken `main` for hours before
  (`docs/solutions/2026-07-05-half-resolved-merge-broke-main.md`).
- **One branch per work stream.** Never stack unrelated commits on a shared PR.
- **PRs open as draft** (§1) and merge only once `pr-merge-pipeline` (or an equivalent manual
  review) has marked them ready and CI is green. Squash-merge with the PR number in the title.
- **Commits:** verify the branch in the *same* command as the commit (`git branch
  --show-current | grep -qx '<branch>' && git commit ...`) — a shared checkout can silently
  land you back on `main` mid-session. End the message with the
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer used across this repo.
- **Stray uncommitted files before you commit them:** byte-compare against `origin/main` — they
  may be stale pre-merge artifacts left by a previous session, not new work
  (`docs/solutions/2026-07-05-stale-wip-looks-like-new-work.md`).
- **Paired secrets** (a value set in two places, like a worker secret mirrored into Vercel):
  rotate both sides in the same sitting and verify the second side actually took, or the pair
  silently desyncs (`docs/solutions/2026-07-05-paired-secret-rotation.md`, and the valuation-sync
  section of `docs/ops-runbook.md`).
- **Report honestly.** Failing test → say so with output. Skipped item → say what you saw.
  "Done" means verified with a commit/PR link, not written.

The full standing list of these multi-agent hygiene rules lives in `AGENTS.md`'s "Multi-agent
hygiene" bullet — this section mirrors it for the ship-lane context; that's the canonical copy
if the two ever drift.

## 7. Token & time economy — the codebase is a cost surface

Agent work is priced in tokens and wall-clock; the code's shape sets that price.

- **Read economically.** Grep for the symbol, read the 40 relevant lines — not the whole
  file. Delegate broad sweeps to a search subagent and keep only the conclusion.
- **Keep files splittable-small.** The hot files (`components/SearchBar.tsx` ~1100 lines,
  `app/api/concierge/route.ts` ~830, `components/checkout/CheckoutForm.tsx` ~836) cost every agent on
  every read and collide in every parallel session. When you touch one, extract the piece you
  touched into its own module if the diff stays reviewable — shrink-as-you-go. Dedicated
  split-refactors happen only as their own scoped issue, never alongside feature work.
- **One source of truth per fact.** Duplicated tables/copy (chip tables, valuation notes,
  glyph lists) rot and double the read cost — consolidate when you see a twin.
- **Plans are cheaper than exploration.** If a blueprint exists in `docs/plans/`, trust it and
  read the code it names, in that order.

## 8. What NOT to attempt without a stronger driver or the owner

- Running migrations or touching production data/env.
- Editing `.github/workflows/**` unattended — it's on the ADR 0009 hold-for-owner list because
  CI is the merge gate itself; an agent edit here could weaken the thing that catches its own
  mistakes. An interactive session doing this at the owner's explicit direction still ships it
  as a normal reviewed PR, never a direct push.
- Anything under `eve/` scheduling real deliveries, Stripe/webhook code, auth flows.
- Multi-surface refactors (container systems, scroll models) — take the Linear issue's exact
  scope instead; if the issue is under-specified, comment on it rather than improvising.

## 9. Done since last retro (2026-07-20 → 2026-07-27)

Evidence rule: a claim below has a merged commit/PR link. Nothing here is taken on trust. The
previous retro (PR #306, `b6026ea`) captured everything through PR #305. **Only 10 PRs merged
after it before the pipeline stalled dead: #307–#317.** PR #317 (`57c886d`, 2026-07-23T10:48 UTC)
is the last commit on `main` as of this run — every PR opened since (#318 onward, 25+ and still
growing as of PR #356 today) is stuck behind a frozen required status check. That stall, not any
single shipped feature, is this retro's dominant finding — see §10.

- **Design system PR 5 — Stat primitive + format utilities** — PR #307 (`6dd29a9`), merged.
  Solutions entry: `docs/solutions/2026-07-20-format-utilities-and-stat-primitive.md`.
- **Design system PR 6 — Field/Input/Textarea/Select primitives** — PR #308 (`cbfb549`), merged.
  Solutions entry via PR #309 (`2239f8b`):
  `docs/solutions/2026-07-21-base64url-padding-tampering-and-field-accessibility.md` (also
  captures an unrelated base64url padding tampering-test lesson found during the same review).
- **Design system PR 7 — Button variants, enforcement flips, primitives index docs** — PR #310
  (`74f3296`), merged. Feature/enforcement work, not a bug fix — no solutions entry warranted.
- **Design system PR 8 — outline-none focus-ring accessibility audit + ESLint rule** — PR #311
  (`aa4012c`), merged. Solutions entry:
  `docs/solutions/2026-07-21-outline-none-focus-ring-audit-and-eslint-enforcement.md`.
- **claude.ai/design sync** — PR #314 (`2431d47` + `fe386f4`), merged: hop's component library
  synced to claude.ai/design, recorded as **ADR 0010** plus a solutions entry
  (`docs/solutions/2026-07-22-sync-nextjs-app-components-to-claude-design.md`).
- **Competitor-branding removal** — PR #315 (`309de77`/`cebafa9`), merged: genericized the MCP
  landing page's copy/config snippets and removed named-competitor (Claude/ChatGPT) branding from
  public surfaces. **The commit message states the actual reason**: Oliver can't publicly
  name/promote non-Gemini LLM products while at Google. Solutions entry via PR #316 (`4c08557`):
  `docs/solutions/2026-07-23-genericize-competitor-branding-across-public-surfaces.md`. This is a
  materially new structural fact for the MCP-distribution bet, and the 2026-07-26 board memo
  flags it as an unresolved contested strategy point (§4 there) — not this retro's call to settle.
- **Shareable verdict receipts** — PR #317 (`57c886d`), merged — **the last PR to land on `main`**.
  Solutions entry (`19b5878`):
  `docs/solutions/2026-07-23-snapshot-at-share-time-social-verdict-receipts.md`.
- **`npm run check` on `main`** — still green at `57c886d`: `db:check-migrations` OK (standalone,
  runs first), lint 0 errors (263 warnings — same hand-rolled Card/Eyebrow migration reminders as
  last retro, informational), typecheck clean, 113 test files / 1356 tests passing. Same
  documented false-alarm `[check-migration-sequence] FAILED` line mid-`npm test` as last retro —
  reconfirmed it's the checker's own self-test error path, not a real collision.
- **Cron lockstep** — still in sync: all 10 `vercel.json` crons (`standing-orders`,
  `revalidate-seo`, `valuation-sync`, `sync-stripe`, `business-digest`, `health-sentinel`,
  `balance-autosync`, `sweet-spot-candidates`, `awardwallet-sync`, `newsletter-digest`) have a
  matching path/schedule entry in `lib/health-checks.ts#CRON_JOBS`. No drift, no gap.
- No merged PR since last retro fixed a non-obvious bug without an accompanying `docs/solutions/`
  entry — every bug-shaped merge above already captured its lesson in the same or a paired PR.

- **Board ranked amendment #1 — `/pricing`'s `<head>` advertised `$49/yr` unconditionally** — PR
  #304 (`ac45604`), merged same morning it was flagged: `app/pricing/page.tsx`'s static `metadata`
  export became `generateMetadata()`, gated on `isBillingEnabled()` (the page body already
  branched correctly; only the `<head>`/social-preview description didn't). Verified with
  `typecheck`/`lint`/`test`/`build` per the growth desk's own funnel-log entry
  (`docs/marketing/funnel-log.md`, 2026-07-20). This is a genuine same-day close of a board
  finding — the fastest amendment turnaround logged so far.
- **Self-improvement loop (ADR 0007), two more slices shipped**: PR #300 (`bebf850`) — system
  digest section in `lib/business-digest.ts` plus a new **D6 "dead watches" detector**
  (`lib/health-checks.ts`: flags standing-order watches older than `WATCH_DEAD_DAYS` with zero
  alerts fired). PR #301/#302 (`692b709` + `947d37f` fixup + `cdb4a01` docs) — the **Data Refresh
  Loop (L3)**: a new monthly GitHub Actions workflow (`.github/workflows/data-refresh.yml`)
  regenerates `lib/place-facts.ts`/`lib/climate-normals.ts` from Wikidata/Open-Meteo/Frankfurter
  and opens a PR, gated by a new `lib/__tests__/data-snapshot.test.ts` structural-invariant suite
  so a malformed upstream payload fails the Action instead of landing as a broken diff. Adversarial
  review on the first pass caught three real defects before merge — a `GITHUB_TOKEN`
  (vs. `HOP_BOT_TOKEN`) checkout that would have opened PRs with no CI trigger
  (`docs/solutions/2026-07-19-github-token-pr-ci-gotcha.md`), an `|| echo` that swallowed all
  `gh pr create` failures as green, and a weakened affiliate-tracking test assertion — all fixed in
  `947d37f` and captured in three new `docs/solutions/` entries (see below). **Needs an owner
  action to actually run**: see the new `[Oliver]` item below — the workflow references
  `secrets.HOP_BOT_TOKEN`, which has no evidence of being set as a repo secret yet, and GitHub
  Actions billing on this account is still broken (carried board item), so this workflow can't fire
  either way until both are resolved.
- **Astryx a11y primitives port** — PR #291 (`897996e`), merged: Dialog, DropdownMenu, Toast, and
  EmptyState rebuilt on `@astryxdesign/core` (native `<dialog>`/focus-trap/roving-menu-focus
  instead of hand-rolled JS), themed to hop's tokens via `lib/astryx-theme.ts`. Shipped a real,
  non-obvious production-only build crash (Astryx's dist hardcoded a dev-only `jsxDEV` import that
  crashes Next 16's static prerendering under React 19's production JSX runtime, fixed via two
  `patch-package` patches) and a CSS `@layer` cascade-order bug. **No `docs/solutions/` entry
  existed for either — written this retro**:
  `docs/solutions/2026-07-14-astryx-jsxdev-prod-crash-and-css-layer-order.md`.
- **Design system PR 4 — Card and Eyebrow primitives** — PR #303 (`62260ca`), merged: new `<Card>`/
  `<Eyebrow>` primitives plus call-site migrations. Not a full sweep — `npm run lint` still flags
  ~10 hand-rolled card/eyebrow instances across `components/landing/*` this run (informational
  `no-restricted-syntax` warnings, not errors); remaining migrations are follow-up work, not a
  defect in this PR.
- **Security** — PR #297 (`7bac24f`), merged: removed a third-party `emrldtp.com` attribution
  script that was tripping Safe Browsing flags. Already has a solutions entry from the same week
  (`docs/solutions/2026-07-18-remove-emrldtp-attribution-tag-safe-browsing-flag.md`).
- **Docs infra** — PR #295 (`ce9879d`), merged: added the Spiral writing skill and brought
  README's stack description up to date.
- **Board review (weekly)** — PR #298 (`f397b2b`), `docs/board/2026-07-19-board-memo.md`: found the
  org executed 1 of 13 prior amendments (the VerdictRail CTA fix, already closed last retro), 1
  net-negative (content freeze violated again), 11 unchanged/worse. **Strategy review (weekly)** —
  PR #299 (`6f17223`), `docs/strategy/2026-07-19-weekly-strategy.md`: adopted the board's ranked
  list as-is (per the ownership rule — this was the first week the board memo wasn't stale
  relative to the strategy desk), added a fresh PostHog pull and market scan (point.me's 2026-07-16
  "Explore"/"My Points" launch lands close to hop's cpp-verdict pitch; a journalist's LLM test found
  no assistant recommends hop by name yet), and logged the first-ever nonzero `signed_up`/
  `first_program_added` read (2026-07-18, n=1, one real multi-search session) as a watch item, not
  a confirmed fix.
- **Growth desk** — PR #292/#294/#296/#305 (`925db17`/`12d7708`/`f6b8d04`/`23e1c1e`): weekly
  funnel-log entries. #293 (`7d22b7e`) shipped `/guides/points-101`, a beginner-education SEO page
  sourced entirely from `lib/programs.ts`/`lib/cpp.ts` — **this is the content-pipeline freeze's
  third violation** (after PR #275 and PR #288), confirmed by the board's own follow-through table;
  see the updated freeze note in Open Threads. #296 also drafted (but could not complete
  unattended) copy for 3 MCP-directory submissions — Smithery/PulseMCP/mcp.so all hit auth or
  scope walls; drafts sit in `docs/marketing/drafts/2026-07-17-mcp-directory-submissions.md`.
- **Finance desk** — PR #290 (`aae2b66`): paused the credit/discount-hunt cadence (Oliver's direct
  feedback that the memos had become repetitive) and escalated the subscriber-count access gap to
  the board. No finance PR since — the desk has now gone 6 days silent, matching the board's own
  finding; not a new problem this retro is surfacing, just confirming it's still true.
- **CRON_JOBS ↔ vercel.json lockstep** — still in sync this run: same 10 crons on both sides,
  matching paths/schedules (the new `data-refresh.yml` is a GitHub Actions workflow, not a Vercel
  cron, so it's correctly outside `CRON_JOBS`' scope). The lockstep test
  (`lib/__tests__/health-checks.test.ts`) still exists and passes.
- **`npm run check` on `main`** — green at `23e1c1e`: `db:check-migrations` OK, lint 0 errors (268
  warnings — mostly the `no-restricted-syntax` Card/Eyebrow migration reminders above, expected and
  informational), typecheck clean, 112 test files / 1353 tests passing. **One easy-to-misread
  wrinkle**: mid-run, `npm test`'s console briefly prints a `[check-migration-sequence] FAILED —
  migration sequence collision detected` line that looks like a build failure. It isn't — it's
  `lib/__tests__/migration-sequence-check.test.ts` exercising the checker's own error path against
  an in-memory fixture, and the real `db:check-migrations` step (which ran first, standalone)
  already reported OK. Confirmed by running `npm run db:check-migrations` in isolation. Not a
  P1/P2 — just noting it here so the next retro doesn't lose a few minutes re-diagnosing a false
  alarm; a low-effort follow-up would be silencing that test's `console.error` under
  `vi.spyOn`.
- **Zero open PRs** at the time of this run — the queue is clear, same as last retro.

## 10. Open threads

**The dominant thread this run: the merge pipeline has been fully stuck since 2026-07-23.** The
last commit to land on `main` was PR #317 (`57c886d`, 2026-07-23T10:48 UTC). Every PR opened since
— #318 through at least #356, 25+ and still growing as of today — shows the required `Vercel`
status check frozen `pending` for 24–45+ hours with zero update, and `main`'s branch protection
requires that check before merge, so nothing is actively rejecting these PRs, they're simply
accumulating. Four independent reads this week converge on the same evidence: the 2026-07-26
board memo (open, unmerged — PR #333), the same-day strategy review (open, unmerged — PR #334,
which adopts the board's list as-is), the 2026-07-27 sheriff sweep (open, unmerged — PR #345,
which narrowed the cause to a GitHub App identity mismatch on the Vercel check and separately
found/dispatched fixes for 9 PRs with real git merge conflicts), and today's funnel-log entry
(open — PR #356, 4th independent reconfirmation in 24h). **PR #352 (open, unmerged) documents the
root cause precisely: the Vercel status was posted by the OAuth App identity, not the installed
Vercel GitHub App branch protection expects.** The concrete, human-only fix, per PR #356: **GitHub
→ Settings → Integrations → reauthorize the Vercel GitHub App** — under 5 minutes, unsticks all
queued PRs across every desk. This is now the single highest-leverage founder action open, ahead
of the two longer-running founder blockers below. This retro's own PR will queue behind the same
stall.

**Priority ranking (adopted from the 2026-07-26 board memo, `docs/board/2026-07-26-board-memo.md`
§7, open PR #333 — per the ownership rule in this doc's header, the board's ranked list wins, and
the 2026-07-26 strategy review, PR #334, independently adopts the same list as-is):**

1. Diagnose and unstick the frozen Vercel required-status-check — **narrowed this run** (see
   above): an identity-split root cause is documented (PR #352) and the fix is a founder-only
   GitHub App reauthorization (PR #356). **[needs-founder]** for the actual click;
   **[agents-can-execute]** was the diagnosis, now done.
2. Once unstuck, land the small, ready, already-reviewed PRs first — #331 (a real prerender-crash
   fix), #324 (`/pricing` FAQ/JSON-LD, closes N-319/board item below), #325 (growth's stale
   funnel-log entry) — before any new feature PR merges. **[agents-can-execute]**.
3. Hold new design-system and self-improve PR creation (open: #319, #329, #330 design-system;
   #320, #327, #328 self-improve) until the pipeline is confirmed clear, then resume — #320/#327
   additionally can't fire until GitHub Actions billing (item 9) is separately fixed, so they'd
   land dead-on-arrival regardless. **[agents-can-execute]**.
4. Start the fallback award-data-source prototype — **still zero code**, now a 4th–5th
   consecutive week flagged, and the market scan in the 2026-07-26 strategy review confirms
   seats.aero's own published policy leaves no ambiguity about the written approval it requires.
   **[agents-can-execute]**.
5. Verify whether `HOP_ENABLE_VALUATION_SYNC` and the Cloudflare worker are actually live — the
   board found the flag unset and the worker untouched, meaning hop's claimed observed-cpp
   differentiator may currently be inert while the strategy review's market scan found *four*
   competitors (point.me, PointsYeah, Award Travel Finder, and a new direct MCP-native clone,
   `gondola-ai/gondola-mcp`, created 2026-07-19) converging on the same wedge. **[agents-can-
   execute]** to verify/flip if config-only; **[needs-founder]** if the differentiator claim
   itself needs revisiting.
6. Reply to seats.aero (N-320) or explicitly decide to flip `HOP_ENABLE_BILLING` off — **21 days
   unanswered as of this run** (was 15 at last retro), still the oldest founder blocker.
   **[needs-founder]**.
7. Post the 3 ready-to-paste community drafts — ~20 days stale for the oldest two.
   **[needs-founder]**.
8. Grant the finance desk read-only DB/Stripe access, or explicitly pause it — **12 days silent**
   (was flagged at 6 days last retro; the weekly cadence itself lapsed, no 2026-07-21 entry at
   all). **[needs-founder]**.
9. Fix GitHub Actions billing — now 17+ days broken, compounded by the separate Vercel-check
   stall above. **[needs-founder]**.
10. Decide explicitly whether to reset the 2026-08-05 $10k MRR target — **10 days remain** as of
    the board's writing (fewer now); N-320 unmoved 20+ of the last 22 days. **[needs-founder]**.
11. Add the missing `docs/finance/outreach.md` approval-log entries (see the 🚨 escalated item
    below) — mechanically **[agents-can-execute]**, but whether Oliver actually approved the
    sends is **[needs-founder]** to confirm.
12. Fix the board/strategy cron ordering (board `0 13 * * 0` fires two hours before Marcus's
    `0 15 * * 0` every Sunday) — **still not done, now a 4th week running**, `docs/team/
    routines.md` unchanged. **[agents-can-execute]**, but touches another desk's schedule —
    flagging rather than changing it unilaterally in a docs retro PR.
13. Grant this session's harness Linear connector access (or fix whatever makes it non-
    interactive-unreachable) so board/strategy/retro reviews can verify Linear state directly
    instead of falling back to git-only mode every week. **[needs-founder]** (connector/auth
    configuration).
14. Fold `llmCostUsd` into the B3 unit-economics panel — carried 3rd+ week, still hardcoded
    `null` at `lib/unit-economics.ts:32,120` (grep-confirmed this run). **[agents-can-execute]**.
15. Write Product Hunt and X launch drafts (named as intended channels but never drafted, unlike
    HN/Reddit/MCP-directories) — a real, still-open agent task independent of the founder-blocked
    posting itself. **[agents-can-execute]**.

**New this run, not on the board's numbered list:**

- **PR #353 — ADR 0013 (mobile client is a thin engine consumer)**: open, unmerged, docs-only.
  Settles a real upcoming taste call (Expo/React Native as the default mobile target, engine
  numbers only reach a client via direct `lib/*` import or the `/api/mcp` tools) before any mobile
  work starts. Worth merging promptly once the pipeline clears — it's exactly the kind of decision
  §5 (Taste calls) says to settle once rather than re-litigate.
- **PR #348 — LLM tracing privacy fix** (`charliecreates` bot): open. Double-locks the
  already-landed LLM tracing path behind `HOP_ENABLE_LLM_TRACING` + a configured PostHog key, sets
  `recordInputs`/`recordOutputs: false`. Worth prioritizing once unstuck — it's a privacy
  tightening, not new surface area, so it isn't caught by the design-system/self-improve hold in
  item 3 above.
- **PR #346/#347 — bug fixes** (`charliecreates` bot): admin cron-heartbeat unavailable-vs-empty
  presentation, and points-band search dates going stale/ignoring the `ret` query key. Both small,
  already-reviewed, in the same "land these first" bucket as item 2 above.
- **PR #343 — Hopper disambiguation FAQ + competitive-positioning plan**: open, adds a
  `/support` FAQ distinguishing hop from Hopper (the travel-booking app) plus
  `docs/plans/2026-07-02-competitive-positioning.md`. Not board-ranked yet — flag for next week's
  board/strategy review to weigh in given the new gondola-mcp competitor finding above.

**Separately (board's Kill list §5, not a ranked amendment)**: no further `/mcp` page polish until
at least one MCP-directory submission lands — **still open**, folded into ranked item #7 above.

**FREEZE — status this run: held clean for a second straight week.** `git log --since=2026-07-20
-- app/guides app/sweet-spots` is empty, confirming both the board's and strategy desk's
independent reads. Violation count stands at 3 total (PRs #275, #288, #293), unchanged since last
retro. Nothing mechanical enforces it yet (ranked item 4 in the previous retro's numbering, now
folded into general vigilance since it dropped off this week's board list) — still one clean
streak of discipline, not a guardrail.

**[needs-founder] — verbatim/paraphrased from the board, no agent substitute:**

- **🚨 ESCALATED, still unresolved 3 weeks running:** `docs/finance/outreach.md`'s two
  `status: sent` items (seats.aero, AwardWallet, both dated 2026-07-06) still have no
  approval-log entry anywhere, despite being escalated in the 2026-07-19 retro and again in the
  2026-07-19 and 2026-07-26 board memos. Two external, third-party emails went out on the owner's
  behalf with no verifiable record he approved them — only a commit message's unsourced claim
  (PR #245, `39b2c7f`). **Action needed:** confirm directly with Oliver whether he approved these
  sends; if yes, backfill an approval-log entry in `outreach.md` mirroring `budget.md`'s format
  (which has a real, timestamped, quoted reply); if no, this is a finance-desk process failure to
  fix before it sends anything else external. Filed here, not fixed directly — `docs/finance/` is
  Elizabeth's owned surface, and whether the sends were authorized is a fact only Oliver can
  supply.
- **Reauthorize the Vercel GitHub App** (GitHub → Settings → Integrations) — see the pipeline
  stall above; the single highest-leverage founder action open right now, <5 minutes.
- Confirm the configured Stripe keys are TEST mode, or hard-stop live charges and public pricing
  until business-plan.md §3.1's gates close.
- Pre-approve the drafted community replies before they go out.
- **Reply to seats.aero (N-320) or explicitly decide to flip `HOP_ENABLE_BILLING` off** — 21 days
  unanswered as of this run.
- **Grant the finance desk read-only DB/Stripe access, or explicitly pause it** — 12 days silent,
  a lapsed weekly cadence, not just an unanswered question.
- **Decide explicitly whether to reset the 2026-08-05 $10k MRR target** — under 10 days remain and
  N-320 hasn't moved in 20+ of the last 22.

Things that are known, tracked, and waiting on a specific owner — check here before re-filing
something that's already known. Mirrored into Linear (team `n3wth`, project
[hop](https://linear.app/newth/project/hop-9365da373b9a)) where noted.

**[Oliver] — owner-only, needs a human with account/credential access:**

- `AWARDWALLET_CONNECT_URL` onboarding — the hosted "Connect Users" URL from the AwardWallet
  business dashboard is unset, so the connect CTA stays disabled (`.env.example`).
- A PostHog personal API key, so an agent session can read LLM-cost analytics back
  programmatically instead of the owner checking the dashboard by hand.
- Record the Google OAuth verification demo video required for the Gmail travel-history scope
  review (`docs/ops-runbook.md` § Gmail travel-history).
- Save the Google OAuth credentials to Vaultwarden (currently only in Vercel env).
- After the next valuation-sync tick (13:30 UTC), confirm the worker secret and the Vercel
  mirror actually match — a paired-secret rotation is only confirmed once both sides are
  checked (`docs/solutions/2026-07-05-paired-secret-rotation.md`).
- Decide the UX for an expired standing-order watch (currently undecided product call, not a
  code gap — see `docs/solutions/2026-07-06-expired-watch-skip-dont-roll.md` for why the cron
  now skips rather than rolls the date forward in the meantime).
- Click the Cloudflare Email Routing verification link for `finance-hop@agentmail.to` (arrived,
  cannot be auto-verified — Cloudflare's bot detection blocks WebFetch/curl/headless-Chromium
  alike per `docs/finance/agentmail-domain-dns.md`) and, separately, the same style of
  verification for the growth desk's forward once Omar provisions one (`docs/marketing/README.md`,
  from PR #238) — plus add the AgentMail connector to Omar's routine (trigger
  `trig_017UarsY5ENomVMLdZpRZCwg`) on claude.ai, a config change no agent can make.
- **GitHub Actions billing is broken** on this account ("recent account payments have failed or
  your spending limit needs to be increased") — this is what's actually blocking the `check` CI
  gate from running on PRs, not a missing workflow file (`.github/workflows/ci.yml` already
  defines a `check` job identical in shape to what a from-scratch CI gate would look like; it's
  parked on `workflow_dispatch`-only, see `docs/ops-runbook.md` § CI). Fix billing, then
  `gh workflow run ci.yml --ref main` to confirm a dispatched run goes green, **then** restore
  the `pull_request`/`push` triggers in both `ci.yml` and `deploy-valuations-worker.yml` (kept
  in the file's own comments), and only then add `check` to `main`'s required status-check
  contexts. Doing the required-context step before billing is fixed would make every PR
  permanently unmergeable — check the order.
- `main`'s branch protection still doesn't require a PR review or block a direct push — only
  the `Vercel` status check plus no force-push/deletion are enforced. "PR-only" is currently a
  convention backed by tooling (`scripts/hooks/guard-main-commit.sh` blocks a `git commit` with
  `HEAD` on `main` locally — and per `docs/solutions/2026-07-06-hooks-fail-open-on-missing-command.md`,
  that guard itself silently no-ops in any checkout missing the script, so it's a softer
  backstop than it looks), not a GitHub-enforced rule. Worth tightening before a month of
  unattended agent sessions.
- `docs/solutions/README.md`'s index table is a manually-kept partial list — now ~24 entries
  predating 2026-07-14 aren't in it (the files exist, just not indexed, including the new Astryx
  entry this retro added). Low urgency, but worth a pass so the table is trustworthy again rather
  than a coin-flip.
- The Data Refresh Loop (L3) GitHub Actions workflow (`.github/workflows/data-refresh.yml`,
  merged PR #301/#302) checks out and pushes using `secrets.HOP_BOT_TOKEN` — a fine-grained PAT
  scoped to `contents: write` + `pull-requests: write`
  (`docs/solutions/2026-07-19-github-token-pr-ci-gotcha.md` explains why). Still no evidence this
  session can see that `HOP_BOT_TOKEN` is actually set as a repo secret, and GitHub Actions
  billing is separately still broken (ranked item 9 above) — so this monthly workflow can't
  produce a working, CI-checked PR until both are resolved.

**[agents-can-execute] — pick up per the normal queue in `docs/autonomy-runbook.md`:** see the
numbered ranked list at the top of this section (items marked `[agents-can-execute]`) — that list
is now the single current queue; this bullet exists only to point there so nobody re-derives a
second, competing list.
