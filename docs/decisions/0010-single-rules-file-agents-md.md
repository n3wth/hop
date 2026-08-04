# 0010. Single rules file: AGENTS.md is canon, CLAUDE.md imports it

Status: Accepted
Date: 2026-07-07

## Context

The repo carried two always-loaded rules files: `CLAUDE.md` (248 lines, read by Claude Code)
and `AGENTS.md` (120 lines, read by Cursor, Codex, Copilot, Jules, and any other harness).
They overlapped heavily — the same invariants, worktree recipe, and conventions phrased
differently — which is exactly the ADR 0006 "two sources of truth" drift class the
invariant-audit's memory lens exists to police. Meanwhile `AGENTS.md` has become the
cross-vendor standard, and Claude Code resolves `@`-imports inside `CLAUDE.md`, so the
duplication no longer buys anything.

## Decision

- **`AGENTS.md` is the single rules file** for every agent. The merge deduplicated the two
  files' content; genuinely Claude-only mechanics live in a "Claude Code specifics" section
  at the bottom (inert for other agents).
- **`CLAUDE.md` is a stub**: `@AGENTS.md` plus one paragraph telling any reader that canon
  lives in `AGENTS.md`. An import line rather than a symlink (Windows checkouts; some tools
  don't resolve symlinks). No rules may be added to it.
- Canon references across `.claude/agents/`, `.claude/commands/`, `.claude/workflows/`,
  `docs/agent-playbook.md`, and `docs/autonomy-runbook.md` now point at `AGENTS.md`.
  Historical records (dated plans, board memos, solutions entries) keep their original
  `CLAUDE.md` references — they describe the repo as it was.
- The compound loop's promotion target "a CLAUDE.md rule" is now "an AGENTS.md rule"
  (`.claude/commands/compound.md`).

## Consequences

- One file to amend, one file for the audit's memory lens to check against the code, no
  cross-file drift class.
- Rules-file context cost drops for Claude sessions (the merged file is shorter than the
  two files' sum) and other-agent sessions gain the architecture/conventions detail that
  previously lived only in `CLAUDE.md`.
- Any tool that reads `CLAUDE.md` raw (without resolving imports) sees the pointer paragraph
  and must follow it manually — acceptable, since every known consumer either resolves the
  import or reads `AGENTS.md` natively.
