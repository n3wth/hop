---
description: Ship lane — review an open hop PR with three fixed lenses in parallel, fix P1s on the PR branch if any, then merge once CI is green.
argument-hint: "<PR number>"
---

# /pr-merge-pipeline — review, fix, merge one PR

Takes a single **$ARGUMENTS** (the PR number, required).

## 0. Prefer the saved workflow (ADR 0006)

If the harness has the **Workflow tool**, use it instead of the manual steps below:
`Workflow({ name: 'pr-merge-pipeline', args: { pr: $ARGUMENTS } })`
(`.claude/workflows/pr-merge-pipeline.js`). Steps 1–3 are the **manual fallback** for harnesses
without the tool.

## 1. Review — three lenses in parallel

Dispatch three reviewers **in a single batch** (one message, multiple Task calls) against
`gh pr diff $ARGUMENTS`, each scoped to one lens:

- **engine** — every economic number computed by `lib/*`, never LLM-generated; graceful
  degradation (`{ok:false}`/fallbacks via `withDb`, never throw to a page/route).
- **security** — `user_id` scoping on every `withDb`/DB query, token hashing, no secrets in
  client bundles, route authz (owner/admin gating, `CRON_SECRET`), no plaintext leaks.
- **style** — Next.js 16.2.9 + React 19 correctness (check `node_modules/next/dist/docs/` when
  unsure, not training data), flat-editorial design (no shadows/gradients/hover movement), copy
  voice per `docs/design/copy-spec.md`.

Each reviewer returns `p1`/`p2` findings with `file`, `line`, `issue`, and (for P1) a `fix`.
Be skeptical of your own findings — only report a P1 you can defend with `file:line` evidence.
An empty array is a fine answer.

## 2. Fix — only if P1s were found

`gh pr checkout $ARGUMENTS` into a dedicated worktree (`git worktree add /tmp/hop-fix-pr$ARGUMENTS <head-branch>`,
reuse it if it already exists). Apply the minimal fix for each P1, run `npm run check` (must
pass), commit on the **same branch** (verify with `git branch --show-current` chained into the
commit command; co-author trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`), and
push. If a finding turns out to be wrong, skip it and say why — do not force a fix.

## 3. Merge — only once green

`gh pr checks $ARGUMENTS --watch` (up to 15 min; if the repo has no configured checks, verify
`npm run check` passed instead — either from the PR conversation or by running it in a worktree
of the head branch). If checks fail, **do not merge** — report the failure verbatim and stop.
Otherwise: `gh pr ready $ARGUMENTS` (ignore an error if it's already ready), then
`gh pr merge $ARGUMENTS --merge --delete-branch` (merge-commit, per ADR 0009 — matches repo
history; not `--squash`).
