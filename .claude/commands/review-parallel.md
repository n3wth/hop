---
description: Review lane (40%) — run hop's six specialized reviewers in parallel over the current diff, merge into one P1/P2/P3 list, then fix P1s in isolation.
argument-hint: "[optional base ref, e.g. main or a commit SHA — defaults to the uncommitted + branch diff]"
---

# /review-parallel — many specialists, one prioritized list

You are in the **Review lane** (40% of the loop). "Build safety nets, not review processes" and
"taste belongs in systems, not in review" — so this command does not improvise a review. It
dispatches hop's **standing specialized reviewers** (`.claude/agents/*`) over the current diff,
each in its own context, **in parallel**, then merges their findings.

Optional scope: **$ARGUMENTS** (a base ref). If empty, review the working diff plus the current
branch's commits.

## 1. Capture the diff once

Determine the change set so every reviewer judges the same thing:

- If `$ARGUMENTS` names a ref, diff against it: `git diff $ARGUMENTS...HEAD` plus
  `git diff` (unstaged) and `git diff --staged`.
- Otherwise: `git status`, `git diff`, `git diff --staged`, and
  `git diff main...HEAD` (or the repo's default branch). Use `git merge-base` if needed.

Summarize the touched files in one short list before dispatching, so the reviewers know the
surface area. If the diff is empty, say so and stop.

## 2. Dispatch the six reviewers IN PARALLEL

Launch all applicable reviewers **in a single batch** (one message, multiple Task calls) so they
run concurrently — each is a subagent with its own context defined in `.claude/agents/`. Pass each
the diff scope and the list of changed files. The roster:

- **engine-invariant-reviewer** — every economic number (cpp/miles/tier/ranking/verdict/$ saved)
  is computed by `lib/*` and only narrated by an LLM, never invented. Run whenever a figure is
  surfaced (concierge, MCP tools, Eve tools, email/alert templates, a2ui).
- **degradation-reviewer** — `lib/*` clients + DB helpers return `{ok:false}`/fallbacks via
  `withDb` and never throw to a page/route/agent; sections degrade individually. Run on changes to
  upstream clients, DB access, routes, server components, Eve tools.
- **copy-voice-reviewer** — `docs/design/copy-spec.md` voice (terse, state the answer + number, no
  slop/clichés, no emoji, bunny = logo + one warm moment) and flat-editorial design (no
  shadows/gradients/glows, tokens over hex, WCAG AA, motion gated). Run on any user-facing copy/UI.
- **nextjs16-reviewer** — framework code matches **Next.js 16.2.9 + React 19** per
  `node_modules/next/dist/docs`, not training-data Next (async `params`/`searchParams`, route
  handler + middleware/proxy shapes, caching defaults). Run on route handlers, middleware,
  metadata, server actions, caching.
- **eve-architecture-reviewer** — Eve changes (agent/tools/skills/channels/schedules/state) and the
  proactive seams: tools wrap `lib/*` (no duplicated economics), every seam is flag-gated with a
  graceful no-op, deliveries don't double-send (dedupe on the `lastNotifiedOffer` fingerprint via
  `lib/email.ts#sendAlertEmail`), state/channels used correctly, human-in-the-loop on irreversible
  actions. Run on `eve/*` and notification/standing-order changes.
- **security-reviewer** — `user_id` scoping on every `withDb` query (service-role bypasses RLS; no
  RLS safety net), `hop_` tokens hashed not plaintext, no secrets in logs/responses/client bundles,
  lazy env via `lib/env.ts`, route/cron authz. Run on auth, tokens, DB queries, env, routes,
  MCP/agent endpoints, client components.

Skip a reviewer only if the diff plainly cannot trigger its domain (say which you skipped and why).
When in doubt, run it — reviewers are cheap and return **no findings** when clean.

## 3. Merge into one prioritized list

Collect every reviewer's output and produce a single, de-duplicated, severity-ranked list:

- **P1 (blocker):** correctness/safety/invariant breaches — an invented economic number, a
  verdict shown while its section is `degraded[]`, a query missing `user_id` scoping, a secret in a
  client bundle, a send path that can double-fire, autonomous booking/payment with no approval gate,
  a synchronous use of async `params`. Must fix before merge.
- **P2:** real defects that aren't immediately exploitable/breaking — `Promise.all` over rejectable
  calls, missing `degraded` check, marketing slop/hype, mis-scoped state, pre-16 framework idiom that
  still type-checks.
- **P3:** polish — weak prompt guardrails, hardcoded hex where a token exists, missing dedupe-key
  stability, non-`--ease-premium` easing.

For each finding keep the reviewer's `file:line`, the violated invariant, and the concrete failure
scenario. Collapse duplicates (multiple reviewers flagging one line) into a single entry that notes
both lenses. If everything came back clean, say **no findings** and stop.

## 4. Offer to fix P1s first, each in isolation

Do not bulk-fix. Present the P1 list and offer to fix them **one at a time, each as its own
isolated change**, so each fix is independently reviewable and revertable. For each P1 you fix:
re-run the single most relevant reviewer (or the targeted test) to confirm it's resolved, and add a
regression test where one is missing. Only after P1s are clear, ask whether to proceed to P2s.

End by reminding the user to run `/compound` on anything learned here — especially any P1 that an
existing reviewer or test *should* have caught but didn't, so the safety net gets tighter next time.
