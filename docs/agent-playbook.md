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

**One attributed consumer dollar** (Travelpayouts commission or a *legitimate* Stripe charge)
**and, in parallel, MCP listing + one B2B conversation.** Operating plan:
`docs/plans/2026-08-20-path-to-first-dollar.md`. Award-data: won't-buy seats.aero
(`docs/plans/2026-08-21-replace-seatsaero.md`, ADR 0014) — gate ④ is Partner API off the
paid path via chart-cpp, not a license letter. The July 4 Floor (~15–25 Pro/year covering
infra) is a default-alive readout, not the 90-day company target. Pricing, streams, and
billing gates still live in `docs/plans/2026-07-04-business-plan.md`.

The 2026-07-05 north-star target of **$10k+ MRR by 2026-08-05** expired on that date at $0
realized revenue, without the launch posts or licensed billing the north-star's own Wk1/Wk2
gates required. It is historical — recorded in
`docs/plans/2026-07-05-agentic-travel-agent-northstar.md` §The revenue goal — not a live desk
target. Do not plan sprints against it.

Where this playbook's §9 ordering disagrees with the first-dollar plan
(`docs/plans/2026-08-20-path-to-first-dollar.md`) or the board's latest *merged* amendment
list (`docs/board/`), **the first-dollar plan wins for 90 days**, then the merged board list,
then this playbook. Do not re-derive a $10k-MRR sprint from this file's historical retro notes.

**Ownership order, explicit (from 2026-07-12, amended 2026-08-20):** for 90 days the
first-dollar addendum outranks board and strategy on *what to build next*. Board vs strategy
when the addendum is silent: the latest **merged** board memo's amendment list wins over
strategy. Do not fall back to re-deriving a sprint from the expired $10k target or from
shipped July 4 B1–B4 epics.

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

**Ownership order reaffirmed again (2026-07-26), with a new caveat:** the board memo dated
2026-07-26 (`docs/board/2026-07-26-board-memo.md`) again re-confirms the board's ranked amendment
list (§7) as this week's authoritative priority order over the strategy desk's own ranking when
the two conflict — no change to the rule itself. The caveat: that review found the merge pipeline
itself stuck (last successful merge to `main` was PR #317, 2026-07-23; 13 PRs accumulated behind a
frozen `Vercel` required-status-check with zero merges in the 3 days since), which means the
board's own #1-ranked item this week is "unstick the pipe," not a product/content amendment — any
desk picking up this playbook's priority order should check whether that's still true before
assuming a later-ranked item is actually reachable. If a future board memo confirms the pipeline is
healthy again, that caveat lapses; don't carry it forward past the memo that raised it.

**Strategy desk independently re-confirmed the same day:** the 2026-07-26 strategy review
(`docs/strategy/2026-07-26-weekly-strategy.md`) adopted the board's ranked list as-is after
checking it against a fresh PostHog pull and market scan — neither contradicted it — and directly
re-verified the caveat above was *still* true several hours after the board's own write-up (PR
#333 itself, opened the same morning, still showed `Vercel: pending` that afternoon). Any desk
picking up this playbook's priority order should check current PR-merge status before assuming a
later-ranked item is actually reachable.

**Ownership order made fully explicit (2026-08-02), with a new caveat about "resolved" claims:**
to remove any remaining ambiguity — **the board (`docs/board/`, weekly, Sunday 13:00 UTC) is the
periodic deep, adversarial check; the strategy desk (`docs/strategy/`, Marcus, Sunday 15:00 UTC) is
the weekly tracker that adopts the board's ranking by default.** When the two conflict, the
board's latest ranked amendment list wins, full stop — this has been true since 2026-07-12 and
this note changes nothing about the rule itself, only states it as a standalone sentence so a
future reader doesn't have to reconstruct it from three separate weekly notes.

The caveat: the 2026-08-02 board memo (`docs/board/2026-08-02-board-memo.md`) found that the
board's *own* prior-week PR (#333, the 2026-07-26 memo) asserted inside its own body that it had
"gets merged with `main`" while remaining open, draft, and unmerged a full 7 days later — a false
done-claim the board process produced about itself. **Do not treat a board or strategy memo's own
prose as proof its content reached `main`** — check `git log`/`gh pr view` for the actual file
before citing "this week's board memo says X" as settled. The ownership-order rule above still
holds; what changed is that "the board's ranked list wins" now explicitly means the *merged*
ranked list, not a draft PR's claimed one.

**Ownership order reaffirmed again (2026-08-02), plus one resolved question worth acting on
immediately once the merge pipeline allows it:** the board memo dated 2026-08-02
(`docs/board/2026-08-02-board-memo.md`) exists only as an unmerged draft PR (#383) as of this
note — same institutional-memory-pipeline failure the memo itself names (PR #333, the 2026-07-26
board memo, was still open 7 days later at the time of this review). Per the caveat added
2026-08-02: this playbook's own pointer means the *merged* ranked list, not a draft PR's claimed
one — but with no merged board/strategy memo newer than 2026-07-19 on `main`, the most current
available adversarial evidence is PR #383's content, verified independently (live GitHub PR
status, a live PostHog pull, a live curl of the valuation-sync worker) by
`docs/strategy/2026-08-02-weekly-strategy.md` rather than trusted as prose. That file is the
current priority order per the pointer below. One genuinely new, actionable finding: the board's
own "is `HOP_ENABLE_VALUATION_SYNC` actually live" contested question is now answerable with
reasonable confidence from `docs/ops-runbook.md`'s current-state table plus a live worker
response — it is very likely live, not inert — which unblocks shipping a public page off it as a
near-term agent-executable move (not a founder-gated one) once merges resume.

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

## 9. Done since last retro (2026-07-20 → 2026-08-03)

Evidence rule: a claim below has a merged commit/PR link. Nothing here is taken on trust. **A
retro attempt for 2026-07-27 was opened as PR #357 but never merged** — it sat as a draft for a
full week with no promotion (see the new "stuck desk-memo PRs" thread in §10) — so this run
reconstructs the two-week gap directly from `git log`/PR history rather than trusting that
draft's contents.

- **The merge pipeline stalled hard, then recovered.** Starting 2026-07-23T10:48 UTC, every PR's
  required `Vercel` status check wedged in `pending` — a GitHub App identity mismatch (the check
  was posted by a stale OAuth App id instead of the installed Vercel App id `8329` that branch
  protection requires). Nothing merged for 4 days across ~25 queued PRs, documented across 18
  consecutive merge-queue-sheriff entries in `docs/autonomy-log.md` (2026-07-27–28), until Oliver
  fixed the Vercel↔GitHub App integration by hand and 11 PRs merged in a one-minute burst at
  2026-07-27T21:59 PT. Confirmed still healthy this run: `npm run check` is green on `main` today
  (see Health skim below) and merges have continued normally since, most recently PR #387
  (2026-08-02). Don't confuse this with the separate, still-open GitHub Actions billing problem
  below — this was a Vercel↔GitHub App check issue, not a GitHub Actions billing issue.
- **A self-improve PR merged in violation of ADR 0009, and the correction is still unresolved 5
  days later — the single highest-priority open item this retro found.** PR #362
  (`.github/workflows/data-refresh.yml` + a solutions doc) was squash-merged directly by a
  merge-queue-sheriff sweep without checking ADR 0009's full hold-for-owner list, which holds
  `.github/workflows/**` unconditionally ("CI is the merge gate itself; an agent edit could weaken
  it"). PR #373 (opened 2026-07-29) proposes reverting it and flipping `docs/autonomy-runbook.md`'s
  `Auto-merge` kill switch to `off`, per ADR 0009's own remediation for a bad autonomous merge —
  but **PR #373 is still open and unmerged as of this run**: `main` still reads `Auto-merge: on`
  and PR #362's content is still live. See §10 — this needs a founder decision this week, not a
  desk re-derivation.
- **Design system migration swept nearly the entire app.** Ten-plus PRs (#370, #372, #374, #375,
  #378–#382, #386) built new `Field`/`Input`/`Textarea`/`Select` form primitives and migrated
  hand-rolled card/eyebrow/tier-chip markup across points/deals/guides/destination pages, loading
  skeletons, callout boxes, confirmation sections, and interactive components. Each migration
  shipped its own `docs/solutions/` entry (17 added this window — see the compound note below);
  `npm run lint`'s remaining `no-restricted-syntax` warnings (211, 0 errors) are almost entirely a
  handful of `components/landing/*` call sites still flagged for the same migration — tracked,
  not a regression.
- **ADR 0013 — mobile client is a thin engine consumer**
  (`docs/decisions/0013-mobile-client-is-a-thin-engine-consumer.md`, plus a same-day follow-up
  clarifying the invariant is about *provenance* — which code computes a number — not which CPU
  runs it): a new architectural decision worth reading before any future native/mobile work
  touches `lib/*`.
- **Competitive positioning** shipped — a competitive plan plus a Hopper-disambiguation FAQ and
  schema, responding to the market scan the 2026-07-19 strategy review flagged (point.me's "My
  Points" launch landing close to hop's cpp-verdict pitch).
- **`/pricing`'s FAQ/JSON-LD finish work is done** — board amendment #2 ("resolve N-319 fully") is
  now fully closed: `app/pricing/page.tsx` has `generateMetadata()`, a FAQ section, and a
  `FAQPage` JSON-LD block, all built from `lib/pricing.ts`/`lib/subscription.ts` and gated on
  `isBillingEnabled()` — confirmed by reading the file this run. Only the metadata half was done
  at the last retro; drop this from the open-threads list.
- **`docs/ops-runbook.md` now cross-references business-plan.md §3.1's billing gates** (board
  amendment #7) and **`lib/unit-economics.ts`'s B3 panel now folds in real `llmCostUsd`** instead
  of a hardcoded `null` (board amendment #8, PR #358, solutions entry
  `2026-07-27-llm-cost-telemetry-and-ops-runbook-billing-gates.md`) — both confirmed by direct
  grep this run. Drop both from the open-threads list.
- **The content-pipeline freeze held for a second straight window.** No commits under
  `app/guides/**`/`app/sweet-spots/**` added new content this window — the only touches were the
  design-system Card/Eyebrow/TierChip migrations above, which don't count as new content.
  Violation count stays at 3 (PRs #275, #288, #293), unchanged since the last retro.
- **Growth desk** kept its weekly funnel-log cadence (merged through PR #377, the 2026-07-31
  entry; a 2026-08-03 entry is drafted as PR #389 but not yet merged). `signed_up`/
  `first_program_added` remain zero for confirmed-`Regular` traffic across every day logged since
  2026-07-05 — 26 days as of the last merged read, 29 per the still-open draft. The Wk1 MRR gate
  (payment path proven) is not met and can't be until N-320 (seats.aero terms, owner-only) moves.
- **Compound step, done well this window**: 17 new `docs/solutions/` entries landed (the
  design-system migration series, the cron-sweep-automation series, the vitest
  sequential-orchestration timeout fix). This retro adds one more — a truncated-write incident
  that had no entry yet: an agent's write tool call replaced ~400 lines of `docs/autonomy-log.md`
  with 24 bytes of base64 (restored same-day in commit `71fdf6b`, no lasting damage, but no
  lesson had been written down) — see
  `docs/solutions/2026-08-03-tool-call-truncated-a-shared-log-to-24-bytes.md`.

*(The 2026-07-13 → 2026-07-20 window's own done-list — board amendment #1, the self-improve L3
data-refresh loop, the Astryx a11y port, PR #303's Card/Eyebrow primitives, and that week's
board/strategy/growth/finance output — was captured in full by the prior retro and is preserved
in this file's git history; not repeated here to keep this section scoped to its own window.)*

## 10. Open threads

**Priority ranking pointer (updated 2026-08-03):** per this run's instructions, adopt the
strategy desk's latest ranking from `docs/strategy/` as-is. **The latest file actually merged
into `docs/strategy/` is still 2026-07-19** — the same one the last retro cited. The strategy
desk has run at least once more since (`strategy/2026-08-02`, PR #384) and the board twice more
(`board/2026-07-26` PR #333, `board/2026-08-02` PR #383), but **none of those three PRs have
merged** — all three are still open drafts (see the new "stuck desk-memo PRs" thread below), so
their content isn't live on `main` and isn't "latest" in the sense that matters (a ranking nobody
can read from the merged doc tree isn't actionable). The 2026-07-19 board's ranked list (adopted
as-is by the 2026-07-19 strategy review) remains the operative one; this run re-verified each
item against current code/docs rather than re-deriving a new ranking:

1. ~~Gate `app/pricing/page.tsx`'s `metadata` export via `generateMetadata()` behind
   `isBillingEnabled()`~~ **Done** — PR #304 (closed last retro).
2. ~~Resolve N-319 (`/pricing`) fully~~ **Done this run** — FAQ + JSON-LD shipped, gated on
   `isBillingEnabled()` (see §9). Drop from this list.
3. Start the fallback award-data-source prototype — **still zero code**, confirmed by this run's
   grep (no file matching `fallback`/`FallbackAward` anywhere under `lib/`). **[agents-can-execute]**.
4. Build the content staleness/"verified as of" guard before any further content ships — **still
   unbuilt**, freeze held for a second straight two-week window with no new violation (see §9).
   **[agents-can-execute]**.
5. Reopen Linear N-370 ("board review" perpetual thread, marked Done 6 seconds after creation) and
   fix whatever board-routine step closes it — **not verified this run**, no Linear access from
   this session. **[agents-can-execute]**, needs Linear-connector access.

**Separately (§5 Kill list, not a ranked amendment)**: no further `/mcp` page polish until at
least one MCP-directory submission lands — **still open**, drafts only
(`docs/marketing/drafts/2026-07-17-mcp-directory-submissions.md`); PulseMCP now has a `/submit`
form but it's behind a Cloudflare bot-challenge with no unattended path (re-verified 2026-07-29
per the growth funnel-log), Smithery/mcp.so unchanged. **[needs-founder]**.

Further down the board's §7 list, re-verified this run:

- **#6 — fix the board/strategy cron ordering** (board `0 13 * * 0` fires two hours before
  Marcus's `0 15 * * 0` every Sunday) — **still not done**, confirmed unchanged in
  `docs/team/routines.md`, now flagged a 5th week running. **[agents-can-execute]**, but touches
  another desk's schedule — flagging rather than changing it unilaterally in a docs retro PR.
- **#7 — billing-gate-status line in `docs/ops-runbook.md`** — **Done** this window, see §9.
- **#8 — fold `llmCostUsd` into the B3 unit-economics panel** — **Done** this window, see §9.
- **#9, #10 — referrer/source-split in the funnel log, and de-tracking the $99/yr raise-gate** —
  **partially addressed**: the funnel log now routinely breaks down `signed_up`/`outclick` by
  `$virt_traffic_type` (Automation vs. Regular) on every read, the same instinct as a referrer
  split even if not the literally-named metric; the $99/yr de-tracking status is still unverified
  either way this run. **[agents-can-execute]**.
- **#11–#15 — the five `[needs-founder]` items** (reply to seats.aero / decide on billing, post
  the 3 ready-to-paste community drafts, fix GitHub Actions billing, grant the finance desk
  DB/Stripe read access; the Aug-5 $10k MRR target listed here is **historical** — it expired
  2026-08-05 at $0; live goal is `docs/plans/2026-08-20-path-to-first-dollar.md`) — **all still
  open as of this 2026-08-03 retro**; the Aug-5 target was then **2 days away** with the Wk1
  gate still unmet — see the `[needs-founder]` list below.

**New this run — critical, needs a founder decision within days:** PR #373 (revert PR #362 / flip
the `Auto-merge` kill switch — see §9) has sat open and unmerged for **5 days**, despite being
independently flagged by the 2026-07-31 growth funnel-log entry and now this retro. Every day it
stays open, autonomous sessions keep merging under an `Auto-merge: on` policy that PR #373 itself
argues was already violated once. Pick one: merge #373 (revert #362, pause auto-merge until the
sheriff prompt is fixed to check ADR 0009's full hold list, not a paraphrase of it), or close #373
and manually re-affirm `Auto-merge: on` if #362's content should stay. **[needs-founder]** — not a
call any desk should make by re-deriving around it.

**New this run — desk-memo PRs open as draft and never get promoted, unlike growth's:**
`docs/board/`, `docs/strategy/`, `docs/finance/`, and this retro's own lane have each produced at
least one PR since 2026-07-19 that is **still open as a draft** with no merge activity for a week
or more: PR #333 (board, opened 2026-07-26, 8 days old), PR #357 (the last retro attempt,
2026-07-27, 7 days old — superseded by this retro, safe to close), PR #364 (finance run 7,
2026-07-28, 6 days old), PR #383/#384 (board/strategy, 2026-08-02, 1 day old — too fresh to call
stuck, worth watching). Contrast the growth desk's funnel-log PRs (#372, #377, #389), which open
**not as draft** and merge automatically once CI is green — that mechanical difference is the
most likely reason board/strategy/finance memos haven't landed on `main` in two weeks while
growth's have landed every week, and it's why the priority-ranking pointer above is still citing a
2026-07-19 review: the desks kept running, their output just never lands. **[agents-can-execute]**:
either stop opening these desks' PRs as draft, or add a step (to `pr-merge-pipeline` or a
scheduled sweep) that promotes a docs-only draft PR to ready once CI is green, matching how
growth's already ship.

**New this run — a stale duplicate PR to close:** PR #390 ("increase rate-limit test timeout in
shared-verdicts test") duplicates work already merged as PR #376 on 2026-07-30 — identical code
change, identical solutions-doc filename and content, confirmed by diffing both PRs' file changes.
Close as a duplicate rather than merge; merging would be a no-op at best.

**Health skim (this run, per the retro's §4):**

- `npm run check` on `main` (`a8f40d0`) — **green**: `db:check-migrations` OK standalone, `lint` 0
  errors / 211 warnings (almost entirely the expected `no-restricted-syntax` Card/Eyebrow
  migration reminders on a handful of `components/landing/*` files, plus a few unused-var
  warnings in test files), `typecheck` clean, 121 test files / 1414 tests passing. Reproduced the
  same false alarm the last retro flagged: `npm test`'s console prints a
  `[check-migration-sequence] FAILED` line mid-run — that's
  `lib/__tests__/migration-sequence-check.test.ts` exercising the checker's own error path against
  an in-memory fixture, not a real collision (`npm run db:check-migrations` run standalone reports
  OK). Confirmed still a false alarm, not a regression — no action needed.
- `lib/health-checks.ts#CRON_JOBS` vs. `vercel.json` — **still in lockstep**: same 10 cron paths
  on both sides (`standing-orders`, `revalidate-seo`, `valuation-sync`, `sync-stripe`,
  `business-digest`, `health-sentinel`, `balance-autosync`, `sweet-spot-candidates`,
  `awardwallet-sync`, `newsletter-digest`), confirmed by diffing both lists this run. No drift.

**FREEZE — status this run: held for a second consecutive two-week window.** No commits under
`app/guides/**`/`app/sweet-spots/**` added new content since PR #293 (2026-07-15) — this window's
only touches were the design-system Card/Eyebrow/TierChip migrations (§9), which don't count as
new content. Not claiming the freeze is "fixed" — nothing mechanical enforces it yet (item 4
above), so this is discipline, not a guardrail. Violation count stands at 3 total (PRs #275,
#288, #293), unchanged since the last retro.

**[needs-founder] — verbatim, no agent substitute:**

- **🚨 NEW, most urgent — decide PR #373 (revert PR #362 / the `Auto-merge` kill switch)**, open
  and unmerged for 5 days as of this retro; see §9 and §10's dedicated note above. This governs
  whether autonomous sessions keep merging at all, so it outranks everything below it.
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
  these sends were actually authorized is a fact only Oliver can supply. **Carried forward
  unverified this run** — this retro didn't re-check `docs/finance/outreach.md` for a new
  approval-log entry; treat as still open until someone confirms either way.
- Confirm the configured Stripe keys are TEST mode, or hard-stop live charges and public
  pricing until business-plan.md §3.1's gates close.
- Pre-approve the drafted community replies before they go out.
- **Reply to seats.aero (N-320)** — **closed 2026-08-21 as won't-buy.** Remaining founder
  action is billing off until FD-charts, or FD-charts in production + Partner API off.
  See `docs/plans/2026-08-21-replace-seatsaero.md`. Do not re-send the commercial-terms email.
- **Grant the finance desk read-only DB/Stripe access, or explicitly pause it** — carried forward
  unverified this run; as of the last retro the desk had been silent since 2026-07-14 with no
  DB-verified subscriber count.
- **Decide explicitly whether to reset the 2026-08-05 $10k MRR target** — **historical note from
  the 2026-08-03 retro (2 days then remained).** The date has since passed at $0. Live target is
  `docs/plans/2026-08-20-path-to-first-dollar.md`. Not a call any desk should make by quietly
  re-planning around a dead number.

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
- **GitHub Actions billing** — carried forward, **not reverified this run**: as of the last retro
  it was broken on this account and blocking the `check` CI gate from running on PRs (parked on
  `workflow_dispatch`-only, see `docs/ops-runbook.md` § CI). Note this is a *separate* mechanism
  from the merge-pipeline stall §9 describes (a Vercel↔GitHub-App status-check identity mismatch,
  fixed 2026-07-27) — fixing that one did not necessarily fix this one, since PRs have kept
  merging on the `Vercel` check alone without `check` ever becoming a required context. If still
  broken: fix billing, then `gh workflow run ci.yml --ref main` to confirm a dispatched run goes
  green, **then** restore the `pull_request`/`push` triggers in both `ci.yml` and
  `deploy-valuations-worker.yml` (kept in the file's own comments), and only then add `check` to
  `main`'s required status-check contexts — doing the required-context step before billing is
  fixed would make every PR permanently unmergeable.
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
- **New this run**: the Data Refresh Loop (L3) GitHub Actions workflow
  (`.github/workflows/data-refresh.yml`, merged PR #301/#302) checks out and pushes using
  `secrets.HOP_BOT_TOKEN` — a fine-grained PAT scoped to `contents: write` + `pull-requests:
  write` (`docs/solutions/2026-07-19-github-token-pr-ci-gotcha.md` explains why: the default
  `GITHUB_TOKEN` can't trigger downstream `pull_request` CI on its own PRs). No evidence this
  session can see that `HOP_BOT_TOKEN` is actually set as a repo secret yet, and GitHub Actions
  billing is separately still broken (see above) — so this monthly workflow (next scheduled fire:
  the 1st of the month) can't produce a working, CI-checked PR until **both** are resolved. Create/
  confirm the secret alongside the GitHub Actions billing fix, since both block the same class of
  automated PR.

**[agents] — pick up per the normal queue in `docs/autonomy-runbook.md`:**

- Content staleness/"verified as of" guard — board's #4, now overdue three times over (PRs #275,
  #288, #293 all shipped ahead of it); the freeze held for a second straight window with no new
  violation, so this is the highest-leverage next pickup before the next content PR risks a
  fourth.
- Prototype first-party award quotes (chart-cpp, **not** seats.aero-primary failover) —
  board's old #3, re-specified 2026-08-21 as **FD-charts**. Spec:
  `docs/plans/2026-08-21-replace-seatsaero.md`. Pickup after FD-copy.
- Reopen Linear N-370 and fix whatever board-routine step closes it seconds after creation —
  board's #5, needs Linear-connector access to verify/fix.
- Cron ordering (#6) and the funnel-log referrer split / $99/yr de-tracking status (#9, #10) —
  still open, see §10 above for this run's re-verification. (#2, #7, #8 are done — see §9; drop
  if still listed elsewhere.)
- **New this run**: fix the mechanism that leaves board/strategy/finance/retro desk PRs stuck as
  unpromoted drafts (see §10's dedicated note) — either stop opening these as draft, or add a
  promotion step so a clean, CI-green docs-only draft ships the way growth's funnel-log PRs
  already do.
- **New this run**: close PR #390 as a stale duplicate of already-merged PR #376, and close PR
  #357 (the unmerged 2026-07-27 retro attempt) as superseded by this retro.
