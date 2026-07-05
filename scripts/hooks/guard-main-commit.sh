#!/usr/bin/env bash
# Claude Code PreToolUse hook (matcher: Bash) — blocks `git commit` while the
# target checkout's HEAD is `main`. House rule: never commit to main; feature
# branches / worktrees only. Background agents have flipped a checkout to main
# mid-session before (f38ed23 landed on main directly) — this makes the rule
# mechanical instead of remembered.
set -euo pipefail

cmd=$(jq -r '.tool_input.command // ""' 2>/dev/null || echo '')
[ -n "$cmd" ] || exit 0

# Only actual `git [flags] commit` invocations — not `git log --grep commit`.
printf '%s' "$cmd" | grep -Eq '(^|[;&|]|[[:space:]])git([[:space:]]+-[Cc][[:space:]]+[^[:space:]]+|[[:space:]]+-c[[:space:]]+[^[:space:]]+)*[[:space:]]+commit([[:space:]]|$)' || exit 0

# Resolve the checkout the commit targets: honor `git -C <dir>` and a leading
# `cd <dir> && ...`; otherwise the hook's cwd (the session/worktree root).
dir=$(printf '%s' "$cmd" | sed -nE 's/.*git[[:space:]]+-C[[:space:]]+"?([^" ]+)"?.*/\1/p' | head -1)
if [ -z "$dir" ]; then
  dir=$(printf '%s' "$cmd" | sed -nE 's/^[[:space:]]*cd[[:space:]]+"?([^";&| ]+)"?.*/\1/p' | head -1)
fi
dir=${dir:-.}

branch=$(git -C "$dir" symbolic-ref --short HEAD 2>/dev/null || echo '')
if [ "$branch" = "main" ]; then
  cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked by hop guard hook: HEAD is `main` in the target checkout. Never commit to main — switch to / create a feature branch (or run in a worktree) first, then commit."}}
JSON
fi
exit 0
