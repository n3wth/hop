---
title: Fresh git worktrees have no env config and background sessions can bypass isolation
date: 2026-07-04
tags: [worktree, env, dev-experience, claude-code-settings, database-url, background-agents]
files: [.claude/settings.json, scripts/setup-worktree.sh, .env.example]
status: solved
---

## Problem

This repo runs heavy parallel worktree usage (many `.claude/worktrees/*` checkouts at any time,
one per feature/agent). Two gaps meant that pattern wasn't actually supported:

1. `.env*` is (correctly) gitignored, and `git worktree add` only checks out tracked files — so
   every new worktree starts with **zero env config**. `MOCK=1` isn't set either, so a fresh
   worktree renders genuine empty/degraded state instead of the "no upstream keys required"
   fixture experience documented in `.env.example`/README.
2. `.claude/settings.json` had an uncommitted `worktree.bgIsolation: "none"` — a Claude Code
   setting meant for repos where worktrees are impractical, which tells **background sessions to
   skip `EnterWorktree` and edit the main checkout directly**. In a repo that's built around
   isolated parallel worktrees, this directly caused background agents to land commits on `main`
   (see the earlier "worktree flips to main" incident).

## Root cause

Both gaps come from the same fact: env files and the isolation mechanism itself are per-checkout
concerns that git/Claude Code don't propagate automatically — the repo has to provision for them
explicitly, and nothing here did.

The naive fix for gap 1 (symlink one shared `.env.local` into every worktree) would have created a
worse problem: `npm run build`/`npm run db:migrate` (`scripts/db-migrate.mjs`) apply Drizzle
migrations against whatever `DATABASE_URL` is set. Sharing one real Neon connection across many
concurrent worktrees means any worktree with unmerged schema changes can mutate the schema every
other worktree (and main) reads from — a migration race across parallel branches.

## Solution

- Removed `worktree.bgIsolation: "none"` from `.claude/settings.json` — background sessions get
  default `EnterWorktree` isolation again.
- Added `scripts/setup-worktree.sh`: run once after `git worktree add` in the new worktree. Writes
  a minimal `.env.local` with `MOCK=1` and **no `DATABASE_URL`** if one isn't already present
  (never overwrites), then runs `npm ci`/`npm install`. Fixtures-only by default — wire a real
  `DATABASE_URL`/API keys into that worktree's `.env.local` yourself only when a task actually
  needs persistence or live upstreams.

## Still open (not fixed here, scoped separately)

- No per-worktree DB isolation (e.g. Neon branch-per-git-branch) for the case where a task does
  need a real database — right now that's on the human/agent to set up carefully per worktree.
- `APP_BASE_URL`/`BETTER_AUTH_URL` assume a fixed origin/port; Next auto-increments past `:3000`
  when running multiple `dev` servers across worktrees, silently drifting the OAuth callback
  origin from what's registered.
- `.vercel/` is gitignored, so `vercel dev`/`vercel env pull` need re-linking per worktree.
- No `.nvmrc`/`engines.node` pin across worktrees.
