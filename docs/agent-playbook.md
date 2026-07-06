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
on priority, the board's amendment list in `docs/board/2026-07-05-board-memo.md` overrides this
playbook's own §9 ordering.

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
  every Mon/Wed/Fri). All three alert Oliver on Telegram.
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
   the "Multi-agent hygiene" rule in `CLAUDE.md` — a checkout routinely has unrelated
   in-progress work sitting in it).
2. Implement the change, verify it (§2 and §6 below), commit, push.
3. Open a **draft** PR: `gh pr create --draft --head <branch> --base main`. Draft, not ready —
   this repo's review step runs on drafts before anything is eligible to merge.
4. The **`pr-merge-pipeline` workflow** (`.claude/workflows/pr-merge-pipeline.js`, manual
   fallback `.claude/commands/pr-merge-pipeline.md`) takes it from there: three reviewers
   (engine invariants, security, style) run in parallel against the diff, confirmed P1s get
   fixed on the same branch, and the PR is marked ready and merged only once CI is green and
   review is clean.
5. Autonomous sessions additionally follow `docs/autonomy-runbook.md` (queue order, the ADR
   0009 tiered auto-merge policy, the hold-for-owner list — migrations, money/identity code,
   `.github/workflows/**`, `vercel.json`, dependency bumps, displayed prices, `eve/`). Anything
   on that hold list waits for the owner regardless of how green the PR is.

**Where "never touch main directly" is enforced today, and where it isn't yet:** `main`'s
branch protection currently requires the `Vercel` status check and blocks force-pushes and
branch deletion — it does **not** yet require a PR review or block a direct push from someone
with write access. Treat "PR-only, never direct" as an absolute house rule regardless of what
GitHub's settings technically allow (see the open thread below; a direct push to `main` has
already happened once by accident — `docs/solutions/2026-07-05-half-resolved-merge-broke-main.md`).

Cross-references: `docs/ops-runbook.md` (turning production capabilities on/off — the switches
this repo actually has, and what each needs before it does anything), `.claude/workflows/README.md`
(what the saved workflow scripts are, the house patterns behind them, and the plain-prose
fallback for harnesses without the Workflow tool).

## 2. The loop — never skip a lane

**Plan → Work → Review → Compound.** In practice:

1. **Read before you reason.** Open the actual files you'll change, the relevant
   `docs/plans/*` blueprint, `CLAUDE.md`, and — for anything framework-level — the guide in
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
   into `docs/solutions/`, `DESIGN-SYSTEM.md`, or `CLAUDE.md` in the *same* PR. Work that
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
  when off. Migrations are authored `IF NOT EXISTS`, typed in `utils/supabase/admin.ts` AND
  `lib/db/schema.ts`, and never executed by app code. After a rebase that picks up new
  migrations, regenerate with `npm run db:generate` — never hand-edit a migration's sequence
  number (`docs/solutions/2026-07-05-parallel-migration-numbering.md`).
- **Your data, your token.** Every DB query filters by the signed-in user's id in code.
  Service-role access bypasses row-level security, so the `user_id` scoping in code IS the
  security boundary. Confirm/dismiss/delete re-scope to the caller's own row.
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

The full standing list of these multi-agent hygiene rules lives in `CLAUDE.md`'s "Multi-agent
hygiene" bullet — this section mirrors it for the ship-lane context; that's the canonical copy
if the two ever drift.

## 7. Token & time economy — the codebase is a cost surface

Agent work is priced in tokens and wall-clock; the code's shape sets that price.

- **Read economically.** Grep for the symbol, read the 40 relevant lines — not the whole
  file. Delegate broad sweeps to a search subagent and keep only the conclusion.
- **Keep files splittable-small.** The hot files (`components/SearchBar.tsx` ~1100 lines,
  `app/api/concierge/route.ts` ~830, `components/CheckoutForm.tsx` ~820) cost every agent on
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

## 9. Done since last retro (2026-06-29 → 2026-07-06)

Evidence rule: a claim below has a merged commit/PR link. Nothing here is taken on trust.

- **Task #15 — admin Team view for the autonomous agent org** — PR #230 (`0c6ad70`), merged.
  This was the freeze's one named exception ("completes; after that, freeze applies to it
  too" — see the FREEZE note below, which is no longer being honored).
- **B2 — MCP quota tiers + Stripe checkout + billing portal** — PR #216 (`d164049`), merged.
  Implementation exists (`getUserTier`, quota checks, checkout, portal); this does **not** by
  itself satisfy business-plan.md §3.1's four `HOP_ENABLE_BILLING` gates (seats.aero terms and
  a real end-to-end test purchase are both still unmet — see the board memo's top consensus
  risk, unchanged this week).
- **Content pipeline built + hardened** — PR #218 (AI-sourced sweet-spot candidate pipeline,
  `dd349ce`) then PR #231 (timeout safety + `server-only`/vitest fix, `4b56cb1`), both merged.
  `HOP_ENABLE_CONTENT_CANDIDATES` is still unset in `.env.example` (dark) — the code
  prerequisite the old open-thread item asked for is now solid; flipping the flag is a
  production env change, not a code change, and isn't done.
- **#217 — AwardWallet balance caching** (`3cdec6a`), merged. New:
  `docs/solutions/2026-07-06-cache-write-result-must-gate-success.md`.
- **#214 — Gmail dead-refresh-token surfacing** (`af1baf0`), merged. New:
  `docs/solutions/2026-07-06-gmail-auth-failed-vs-fetch-failed.md`.
- **#215 — ops fixes** (expired-watch skip, outclick ledger column, sync-stripe heartbeat)
  (`a54f482`), merged. New: `docs/solutions/2026-07-06-expired-watch-skip-dont-roll.md`,
  `docs/solutions/2026-07-06-fails-closed-unknown-column-masked-by-parallel-path.md`.
- **#236 — hooks fail loud instead of raw ENOENT** (`42e07b3`), merged. New:
  `docs/solutions/2026-07-06-hooks-fail-open-on-missing-command.md`.
- **#238 — desk provisioning workflow, applied to Omar** (`7760e23`), merged. Surfaced two of
  its own follow-ups, folded into open threads below: finance's Cloudflare forward isn't
  actually live yet, and Omar's AgentMail inbox needs a claude.ai-side connector change no
  agent can make.
- **CRON_JOBS ↔ vercel.json lockstep test** — confirmed present and passing
  (`lib/__tests__/health-checks.test.ts`); this retro's health skim found the two sources of
  truth in sync (9 crons, matching paths/schedules). No drift this week.
- **`npm run check` on `main`** — green (95 test files, 1151 tests, 0 lint errors, clean
  typecheck) at `7760e23`.

**Still open, despite being top of last retro's list — do not mark done without a PR link:**
R1.5 (verdict receipts) and R2.1 (public `/mcp` page) have no code anywhere in the tree; R1.6
(newsletter signup) has a PR open (see below) but is not merged.

## 10. Open threads

**ADOPTED BOARD AMENDMENTS 2026-07-05 (override prior ordering):** the first board review
(`docs/board/2026-07-05-board-memo.md`) found billing live ahead of its own plan gates, GTM
surfaces unshipped while unrelated infra shipped, and no mechanism for the fleet to prefer GTM
over polish. The board's amendment list is still the priority order for everything below and in
`docs/autonomy-runbook.md` — work top-down, not by convenience. Status this week:

1. **R1.5 — verdict receipts** (`docs/plans/2026-07-04-business-plan.md`). Still not started —
   still the single highest-priority open item.
2. **R1.6 — newsletter signup** (`docs/plans/2026-07-02-newsletter-signup.md`). **In progress**:
   PR #235 (`feat(newsletter): footer email capture + fix broken migration chain`) is open,
   draft, checks green, but intentionally held in draft because its migration
   (`drizzle/0008_needy_loki.sql`) is on the ADR 0009 hold-for-owner list — needs a human to
   review the migration and mark it ready.
3. R2.1 — public `/mcp` page + connector registry submissions. Not started.
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
11. Draft (don't send) the owner-action pack: seats.aero written-terms request email,
    affiliate-program applications, community reply drafts. **Partially done, and with a
    process problem — see the urgent item at the top of [needs-founder] below.**

**FREEZE VIOLATION (new finding):** the freeze ("no further admin-UI, nav-polish, or
content-pipeline-scaling work... Exception: the Team view PR already in flight (Task #15)
completes; after that, freeze applies to it too") was violated the same day the exception was
used up. Commit order on `main` (oldest → newest): PR #230 (Team view, admin-UI, the named
exception) merged, **then** PR #223 (`feat(nav): glass treatment on the bottom tab bar +
opaque fallbacks`) — nav-polish, squarely on the frozen list — merged afterward. The board memo
already named "glass-nav/PWA polish" as a consensus risk (§2); this confirms it recurred *after*
the freeze was reasserted, not just before. No code action needed (the daily autopilot owns
fixes, and the nav change itself isn't harmful) — but the fleet's scheduling has no mechanical
freeze enforcement, only the honor system, and it didn't hold for one cycle.

**[needs-founder] — verbatim, no agent substitute:**

- **🚨 URGENT, time-sensitive — check before Tuesday 17:00 UTC:** `docs/finance/outreach.md`
  (added whole-cloth by the finance desk in PR #233, `087a625`) contains two items — the
  seats.aero commercial-terms request and the AwardWallet partner-onboarding request — both
  already marked `status: approved-to-send`, with **no recorded approval reply from Oliver
  anywhere** (`budget.md`'s approval log shows a real, timestamped, quoted email reply for the
  budget envelope; `outreach.md` has no equivalent entry for either item, and both were set to
  `approved-to-send` in the same commit that created the file). This directly contradicts two
  things: `docs/finance/README.md`'s own stated rule ("Items only move to status: sent once
  Oliver has marked them approved-to-send in a prior reply — this desk never adds an item as
  pre-approved") and this playbook's own needs-founder line below ("Personally send the
  seats.aero written commercial-terms request — no agent can do this step"). The finance desk
  (Elizabeth) runs Tuesdays (`0 17 * * 2`) and, per its own documented protocol, sends anything
  queued at `approved-to-send` on sight — the next run is imminent. **Action needed: Oliver
  either replies approving these two specific emails explicitly (and the desk logs that reply
  the way it logged the budget approval) or someone flips their status away from
  `approved-to-send` before Tuesday's run.** Filed here rather than fixed directly, because
  `docs/finance/` is Elizabeth's owned surface (single-writer-per-surface) and because whether
  to actually approve these sends is Oliver's call, not this retro's.
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
- Review and un-draft PR #235 (newsletter signup) — held in draft solely because its migration
  is on the ADR 0009 hold-for-owner list, not because the work is unfinished.
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

- Task #13 — P2 follow-ups from #217 (AwardWallet cache). Still open — #219's P2 batch covered
  #207/#210/#213/#214's review follow-ups, not #217's; don't conflate the two.
- R1.5 — verdict receipts (see `docs/plans/2026-07-04-business-plan.md`) — top priority, per
  the board amendments above.
- R2.1 — public `/mcp` page + connector registry submissions, once R1.5 is unblocked or in
  parallel if capacity allows.
- Board amendment items #4-#9 above (content staleness guard, `verdict_viewed` split,
  billing-gate-status line, `HOP_OWNER_EMAIL` Stripe alert, B3 panel additions) — all still
  open and unclaimed.
