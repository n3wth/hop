---
title: Cheap-model iteration playbook — where hop sessions actually spend tokens, and the routing rules that follow
date: 2026-07-05
tags: [llm-iteration, token-economy, model-routing, subagents, mcp, context, screenshots, compaction, tooling-hygiene]
files: [CLAUDE.md, .claude/agents/, .claude/workflows/, docs/plans/]
status: solved
---

## Problem

Fable/Opus-class capacity is scarce; day-to-day hop work must run mostly on Sonnet (settings.json
already pins Sonnet 5) without quality collapse. Where do sessions actually burn tokens, and what
should route where?

## Evidence (quantitative audit of all 38 hop sessions + 48 subagent sessions, 78MB of transcripts, 2026-07-05)

- **Cache reads dwarf everything**: ~1.13B cache-read tokens vs ~4.3M output tokens (~260:1).
  The cost driver is long sessions re-reading accumulated context every turn — not any single
  expensive call.
- **Session-start tax**: 20–67K tokens of system prompt + tool/skill schemas before any hop work,
  dominated by ~40 unrelated MCP connectors (finance, food delivery, tax, whiteboards…) and ~200
  skills that hop sessions never call. Paid again every session.
- **Screenshot loops are the whales**: the two most expensive sessions were UI-iteration threads
  holding 40+ screenshots at ~180KB base64 each in main-thread context.
- **Tool hygiene gaps**: 0 native Grep calls vs 404 Bash grep/rg; `cat` 66× despite the standing
  rule; 540 `echo` round-trips used as status narration; 58 Bash stdouts >5KB (max 30KB, mostly
  untruncated build/test output); 43 file/session pairs re-Read the same file ≥2× (worst: 14×).
- **No compaction events found in any session** — the `/compact` at ~60% guidance exists but is
  not being followed.
- **Routing was mostly sane** (Sonnet 2609 turns / Fable 2054 / Opus 317), but 250 of the Opus
  turns were one screenshot-comparison session a cheaper model could have run.

## Solution — the playbook

**Session setup**
1. Scope the MCP surface: `.claude/settings.json` sets `"disableClaudeAiConnectors": true`, so
   claude.ai cloud connectors (finance, food delivery, tax…) never load in hop sessions. Local
   plugin servers (Linear, Context7, Figma, chrome) are unaffected. This is the single biggest
   recurring saving (60–80% of the session-start tax, every session). Need a connector once?
   Flip it in `.claude/settings.local.json` for that session, then flip back.
   Relatedly: `scripts/hooks/guard-main-commit.sh` (PreToolUse hook, same file) mechanically
   blocks `git commit` while HEAD is `main` — the never-commit-to-main rule no longer relies
   on any model remembering it.
2. Start cheap by default (Sonnet pin). Escalate the *session*, not the task list: bring in
   Fable/Opus only for plan-writing, architecture/design judgment, or after Sonnet has failed the
   same fix twice (the global "max 2 iterative fixes then re-diagnose" rule).

**Work shape**
3. Plan expensive, execute cheap: big-model output belongs in `docs/plans/` blueprints and
   `docs/` rules; Sonnet executes plans mechanically (`/plan` → execute). The repo's docs are the
   compounding interface between model tiers — a rule written once is cheap-model context forever.
4. Screenshot/UI iteration loops run in a subagent (design-iterator or a general-purpose agent
   with the chrome tools), which returns conclusions, not images. Never accumulate dozens of
   screenshots in the orchestrating thread. When driving visuals inline is unavoidable, prefer
   zoomed regions over full-page captures.
5. Delegate wide exploration to Explore/general-purpose subagents (optionally `model: haiku`)
   and keep only their conclusions.

**Context hygiene (any model)**
6. Native Grep/Glob/Read over Bash `grep`/`rg`/`find`/`cat` — structured, pre-truncated results.
7. Truncate gate output: `npm run check 2>&1 | tail -N` by default; full output only when
   actively debugging that failure.
8. Don't `echo` status narration through Bash; say it in prose. Don't re-Read files already in
   context unless they plausibly changed.
9. `/compact` at ~60% context for real — the audit found zero compactions across 38 sessions.

**Verification stays engine-grade**: cheap models must still run `npm run check`, the
`.claude/agents/` reviewers (workflow `review-parallel` with adversarial verify), and screenshot
verification at 390/768/1360/1512/1920 for UI (docs/design/experience-heuristics.md §12) — the
gates are what make cheap execution safe.

## Symptoms this prevents

Sessions that stall at context limits mid-feature; Fable/Opus capacity burned on mechanical
loops; UI threads that slow to a crawl from embedded screenshots; the same file re-read a dozen
times; 30KB build logs crowding out real signal.
