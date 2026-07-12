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

**Known scheduling bug (flagged 2026-07-12, not yet fixed):** the board's cron
(`0 13 * * 0`) fires two hours before the strategy desk's (`0 15 * * 0`) every Sunday
(`docs/team/routines.md`), so a given week's board review can never see that same week's strategy
output — only the prior week's (or none, in the strategy desk's first weeks). This is why board
memos may read the strategy desk as "silent" when it has simply not run yet that day. Worth
fixing by moving one of the two crons; until then, read a "no `docs/strategy/` file newer than
last week" finding as an artifact of ordering, not a desk failure, unless multiple weeks pass with
still nothing.

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

## 9. Done since last retro (2026-06-29 → 2026-07-06, two retro runs today)

Evidence rule: a claim below has a merged commit/PR link. Nothing here is taken on trust. The
previous retro (PR #240, `be2ac9d`) captured everything through PR #238 same-day; this run covers
the 15 PRs merged after it, same calendar day (`0 16 * * 1` fired once, but the fleet shipped a
full week's worth of work in the hours around it — see the health-skim note on freeze/cadence).

- **R1.5 — verdict receipts** — PR #253 (`0e8a041`), merged: `/v/[id]` share pages + OG cards.
  Was the single highest-priority open item for two retros running; now shipped in code. Whether
  it's flag-gated or live by default isn't re-verified here — check the PR before assuming
  production behavior.
- **R1.6 — newsletter signup + R2.3 (weekly digest)** — PR #251 (`34aef5c`), merged, superseding
  the earlier draft PR #235 (closed, not merged — its migration-chain fix and footer-capture
  approach were reimplemented differently in #251). Hardened twice same-day: PR #264
  (`9a7c4c1`, token hashing + GET-route rate limiting + cron auth ordering) and PR #266
  (`b732636`, decoupled the unsubscribe token from the rotating auth secret). PR #265
  (`ed5ed2d`) fixed a stale doc comment left over from the migration renumbering. New:
  `docs/solutions/2026-07-06-derived-tokens-must-not-key-off-an-unrelated-rotating-secret.md`.
- **#259 — AwardWallet Refresh throttle fix (#217 P2)** (`fe06044`), merged — this was the
  still-open "Task #13" item from last retro's list, now closed. New:
  `docs/solutions/2026-07-06-throttle-must-not-key-off-a-failed-attempt.md`.
- **#261 — rate-limit spoofable x-forwarded-for fix** (`ea697f7`), merged — closes a real bypass
  of the newsletter signup rate limiter (and every other route keyed on `clientIp()`) ahead of
  `HOP_ENABLE_NEWSLETTER` going live. New:
  `docs/solutions/2026-07-06-spoofable-x-forwarded-for-defeats-rate-limiting.md`.
- **#260 — mechanical duplicate-migration-sequence detector** (`4c83cf3`), merged: wires
  `scripts/check-migration-sequence.mjs` into `npm run check` as `db:check-migrations`, plus a
  same-PR fix for an absolute-path resolution bug in the checker itself. Directly answers the
  recurring "4 collisions in one week" problem logged in
  `docs/solutions/2026-07-05-parallel-migration-numbering.md` (updated in the same PR) — this
  retro's health skim confirms the check runs clean on `main`.
- **#249 — cuter team avatars + stood up Marcus (strategy desk)** (`f69528e`), merged. Marcus's
  first scheduled run is Sunday 15:00 UTC (`0 15 * * 0`) — hasn't fired yet as of this retro
  (`docs/strategy/` doesn't exist yet), see the priority-ranking pointer below.
- **#257 — finance@ routing resolved, merge-sheriff desk stood up** (`de49ccf`), merged. The
  merge-sheriff (hourly, ops-only, no avatar) now sweeps every open PR — consistent with this
  retro finding **zero** open PRs at the time of this run.
- **#254 — admin Overview page IA reorg** (`efc1586`), merged: split a mixed card, fixed a
  sparkline inconsistency and the stat grid. UI-only, no behavior change.
- **#258 — README style fix** (`f516ae9`), merged: stripped emojis and a `---` divider per house
  style.
- **#262, #263 — verify-desk tooling fixes** (`aa4d07c`, `f3c8054`), merged: corrected PR
  selection/finding-dedup false negatives and kept `candidate.sha` in sync with the winning PR.
  Internal to `scripts/verify-desk-run.mjs`, no product surface affected.
- **#267 — growth desk's first funnel-log entry** (`4b104d9`), merged: `docs/marketing/funnel-log.md`'s
  baseline read (48 visitors/7d, 15 `search_ran`/15 `verdict_viewed`, 0 `signed_up`/`first_program_added`/
  `outclick`) plus two ready-to-paste (unsent) launch drafts. Flags that GitHub Actions CI is
  still failing repo-wide on a billing issue (Linear N-347, owner-only) as of 2026-07-06.
- **CRON_JOBS ↔ vercel.json lockstep** — still in sync this run: 10 crons on both sides
  (`business-digest` and `health-sentinel` were added since last check), matching paths/schedules.
  The lockstep test (`lib/__tests__/health-checks.test.ts`) still exists and passes.
- **`npm run check` on `main`** — green at `4b104d9`: `db:check-migrations` OK, lint 0 errors (4
  pre-existing unused-var warnings), typecheck clean, 109 test files / 1332 tests passing.

**Still open, despite being top of an earlier retro's list — do not mark done without a PR link:**
R2.1 (public `/mcp` page + connector registry submissions) still has no code anywhere in the tree
(`app/api/mcp-token` exists for the token flow; no page).

## 10. Open threads

**Priority ranking pointer (updated 2026-07-12):** the strategy desk (Marcus) has now run once —
`docs/strategy/2026-07-12-weekly-strategy.md` is the current priority order, adopted from the
2026-07-12 board memo's ranked list (§7) plus that run's own new evidence (a PostHog analytics
host-filter bug inflating traffic ~5x, `search_ran` going to zero for four straight days, and two
live competitors — seats.aero's own AI Assistant and Award Travel Finder's MCP endpoint —
already executing hop's MCP-agent-native wedge). His ranked top 5 for this week: (1) fix the
PostHog `$host` filter bug [N-371], (2) ship the VerdictRail CTA fix from the 7/10 funnel-log
hypothesis [N-372], (3) resolve `/pricing`'s stalled state (N-319), (4) submit `/mcp` to 2-3
directories and treat the seats.aero fallback prototype (N-320) as a tied-priority pair with it,
(5) explicitly deprioritize further content-pipeline expansion until the staleness guard exists.
The numbered list below is the prior (2026-07-05 board-derived) ranking — kept for history; work
from Marcus's latest file going forward, per the ownership rule in "The goal" above. Check for a
newer `docs/strategy/<date>-weekly-strategy.md` each week before treating this list as current.

**ADOPTED BOARD AMENDMENTS 2026-07-05 (override prior ordering):** the first board review
(`docs/board/2026-07-05-board-memo.md`) found billing live ahead of its own plan gates, GTM
surfaces unshipped while unrelated infra shipped, and no mechanism for the fleet to prefer GTM
over polish. The board's amendment list is still the priority order for everything below and in
`docs/autonomy-runbook.md` — work top-down, not by convenience. Status this retro:

1. ~~R1.5 — verdict receipts~~ **Done** — PR #253, see §9. Drop from this list.
2. ~~R1.6 — newsletter signup~~ **Done** — PR #251 (+ #264, #266 hardening), see §9. Drop from
   this list.
3. R2.1 — public `/mcp` page + connector registry submissions. Not started; now the single
   highest-priority open item on this list.
4. Content staleness guard: a "verified as of" marker on sweet-spot entries, auto-hidden once
   past a freshness window. Not started.
5. Split `verdict_viewed` into demo-vs-balance-personalized so activation data stays
   interpretable. Not started.
6. Add a billing-gate-status line to `docs/ops-runbook.md` cross-referencing business-plan.md
   §3.1's four gates (met/unmet). Not started.
7. Alert `HOP_OWNER_EMAIL` on any Stripe webhook that fails to write a tier, so a silent
   paying-and-unentitled customer can't happen unmonitored. Not started — confirmed by grep,
   `app/api/webhooks/stripe/route.ts` has no `HOP_OWNER_EMAIL`/alert-email reference yet.
8. Fold agent-fleet compute cost (~$200/mo) into the B3 unit-economics panel. Not started.
9. Add Duffel look-to-book ratio monitoring to the same panel. Not started.
10. Stand up a weekly "did any stranger use hop this week" report as the lead item on the
    retro desk, ahead of any shipped-features list. **Not started, and not actionable by the
    retro desk as currently configured**: `docs/team/routines.md`'s canonical Bob (retro) prompt
    still doesn't mention this requirement, so nothing will pick it up until that prompt is
    updated to include it. Flagging here rather than improvising it — the retro's own scope is
    fixed by that prompt, and it should be edited deliberately (with DB/PostHog access to
    define "stranger" honestly) rather than approximated.
11. The owner-action pack (seats.aero written-terms request, AwardWallet partner-onboarding
    request) is no longer just drafted — **both were actually sent** this week. See the escalated
    finding at the top of [needs-founder] below: they went out with no recorded approval evidence,
    which is a worse outcome than last retro's warning about the same gap, not a resolution of it.

**FREEZE — status this retro: the pattern continued, not just the one prior violation.** The
freeze ("no further admin-UI, nav-polish, or content-pipeline-scaling work... Exception: the Team
view PR already in flight (Task #15) completes; after that, freeze applies to it too") was
already flagged last retro as violated by PR #223 (nav glass treatment) landing right after the
named exception (PR #230, Team view) completed. Since then, two more admin-UI PRs merged: **#249**
("cuter team avatars" — cosmetic admin-UI) and **#254** (admin Overview page IA reorg — split a
card, fixed a sparkline, fixed the stat grid). Neither is harmful work, and #254 arguably improves
a real inconsistency rather than adding polish for its own sake, but both are squarely admin-UI,
not GTM, and both shipped while R2.1 (public `/mcp` page — GTM-facing) sat untouched. No code
action needed (the daily autopilot owns fixes) — but three admin-UI PRs landing across two retro
cycles after a freeze was declared and then reasserted means the freeze is functioning as
guidance, not a constraint, since nothing in the scheduling enforces it mechanically. Worth the
owner deciding whether to formally lift the freeze (GTM is caught up enough that admin polish is
fine again) or tighten enforcement (e.g. a reviewer check that flags admin-UI-only diffs against
an explicit allowlist) — the ambiguity itself is the recurring cost, not any single PR.

**[needs-founder] — verbatim, no agent substitute:**

- **🚨 ESCALATED — worse than last retro's warning, not resolved by it:** last retro flagged that
  `docs/finance/outreach.md`'s two items (seats.aero commercial terms, AwardWallet partner
  onboarding) were marked `approved-to-send` with no recorded approval reply from Oliver anywhere,
  and asked for either an explicit logged approval or the status to be flipped back before the
  finance desk's next run. **Neither happened — the finance desk sent both emails anyway.** PR
  #245 (`39b2c7f`, "send approved outreach...") moved both items straight from
  `approved-to-send` to `status: sent` / `sent-date: 2026-07-06`, and its commit message asserts
  "Sent the two Oliver-approved outreach emails" — but `docs/finance/outreach.md` still has no
  approval-log entry of any kind (contrast `docs/finance/budget.md`'s "Approval log" table, which
  has a real, timestamped, quoted reply for the budget envelope). Two external, third-party
  emails have now gone out on the owner's behalf — to seats.aero and AwardWallet, both real
  companies hop has an ongoing relationship with — with **no verifiable record that Oliver ever
  approved them**, only a commit message's unsourced claim. This is exactly the failure mode
  "done-claims need evidence" exists to catch, applied to an approval claim instead of a
  shipped-feature claim. **Action needed:** confirm directly with Oliver whether he actually
  approved these two sends (outside this repo — a Slack message, a verbal OK, an email this repo
  can't see); if yes, someone should backfill a proper approval-log entry in `outreach.md` mirroring
  `budget.md`'s format so this doesn't reset to unverifiable the next time someone reads the file;
  if no, this is a process failure in the finance desk that needs fixing before it queues (let
  alone sends) anything else external. Filed here rather than fixed directly, because
  `docs/finance/` is Elizabeth's owned surface (single-writer-per-surface) and because whether
  these sends were actually authorized is a fact only Oliver can supply.
- Confirm the configured Stripe keys are TEST mode, or hard-stop live charges and public
  pricing until business-plan.md §3.1's gates close.
- Pre-approve the drafted community replies before they go out.

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
- `docs/solutions/README.md`'s index table is a manually-kept partial list — about 18 entries
  predating 2026-07-06 aren't in it (the files exist, just not indexed). Low urgency, but worth
  a pass so the table is trustworthy again rather than a coin-flip.

**[agents] — pick up per the normal queue in `docs/autonomy-runbook.md`:**

- R2.1 — public `/mcp` page + connector registry submissions (see `docs/plans/2026-07-04-business-plan.md`)
  — now the top of the board-amendment list, since R1.5 and R1.6 above it both shipped this week.
- Board amendment items #4-#9 above (content staleness guard, `verdict_viewed` split,
  billing-gate-status line, `HOP_OWNER_EMAIL` Stripe alert, B3 panel additions) — all still
  open and unclaimed.
