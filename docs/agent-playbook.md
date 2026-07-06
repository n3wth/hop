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

## 9. Open threads

**ADOPTED BOARD AMENDMENTS 2026-07-05 (override prior ordering):** the first board review
(`docs/board/2026-07-05-board-memo.md`) found billing live ahead of its own plan gates, GTM
surfaces unshipped while unrelated infra shipped, and no mechanism for the fleet to prefer GTM
over polish. The board's amendment list is now the priority order for everything below and in
`docs/autonomy-runbook.md` — work top-down, not by convenience:

1. R1.5 — verdict receipts (`docs/plans/2026-07-04-business-plan.md`).
2. R1.6 — newsletter signup (`docs/plans/2026-07-02-newsletter-signup.md`).
3. R2.1 — public `/mcp` page + connector registry submissions.
4. Content staleness guard: a "verified as of" marker on sweet-spot entries, auto-hidden once
   past a freshness window.
5. Split `verdict_viewed` into demo-vs-balance-personalized so activation data stays
   interpretable.
6. Add a billing-gate-status line to `docs/ops-runbook.md` cross-referencing business-plan.md
   §3.1's four gates (met/unmet).
7. Alert `HOP_OWNER_EMAIL` on any Stripe webhook that fails to write a tier, so a silent
   paying-and-unentitled customer can't happen unmonitored.
8. Fold agent-fleet compute cost (~$200/mo) into the B3 unit-economics panel.
9. Add Duffel look-to-book ratio monitoring to the same panel.
10. Stand up a weekly "did any stranger use hop this week" report as the lead item on the
    retro desk, ahead of any shipped-features list.
11. Draft (don't send) the owner-action pack: seats.aero written-terms request email,
    affiliate-program applications, community reply drafts. Draft only — see [needs-founder]
    below.

**FREEZE:** no further admin-UI, nav-polish, or content-pipeline-scaling work for the duration
of the founder's absence. Exception: the Team view PR already in flight (Task #15) completes;
after that, freeze applies to it too.

**[needs-founder] — verbatim, no agent substitute:**

- Confirm the configured Stripe keys are TEST mode, or hard-stop live charges and public
  pricing until business-plan.md §3.1's gates close.
- Personally send the seats.aero written commercial-terms request — no agent can do this step.
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
  code gap).
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
- (Found while writing this doc, not previously tracked) `main`'s branch protection doesn't
  require a PR review or block a direct push — only the `Vercel` status check plus no
  force-push/deletion are enforced. "PR-only" is currently a convention backed by tooling
  (`scripts/hooks/guard-main-commit.sh` blocks a `git commit` with `HEAD` on `main` locally),
  not a GitHub-enforced rule. Worth tightening before a month of unattended agent sessions.

**[agents] — pick up per the normal queue in `docs/autonomy-runbook.md`:**

- Task #13 — P2 follow-ups from #217 (AwardWallet cache).
- Enable `HOP_ENABLE_CONTENT_CANDIDATES` once #218 (AI-sourced sweet-spot candidate pipeline)
  merges.
- R1.5 — verdict receipts (see `docs/plans/2026-07-04-business-plan.md`).
- R1.6 — newsletter signup (spec: `docs/plans/2026-07-02-newsletter-signup.md`).
