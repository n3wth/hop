---
title: "A missing hook script doesn't block anything — it silently stops enforcing"
date: 2026-07-06
tags: [hooks, claude-code, settings.json, guard-main-commit, fail-open, worktree]
files: [.claude/settings.json, scripts/hooks/guard-main-commit.sh]
status: solved
---

**What happened:**
This repo's `.claude/settings.json` runs a "hook" (a shell command the Claude Code CLI runs
automatically before certain actions) that calls `scripts/hooks/guard-main-commit.sh` to block a
`git commit` from landing directly on `main`. A checkout created from a branch point before that
script existed doesn't have the file on disk. When the hook's command tried to run it, the shell
failed with a plain "no such file or directory" error — and the commit went through anyway. The
guard wasn't rejecting the commit on purpose; it just wasn't there.

**Why it matters:**
When a hook command itself fails to execute (as opposed to running and reporting "block this"),
Claude Code treats that as fail-open, not fail-closed — the action it was supposed to gate
proceeds as if no hook were configured at all. That is the opposite of what most people assume a
safety guard does, and it produces zero visible signal: no error dialog, no red text, nothing
that looks different from a successful run. This applies to *any* hook in this file, not just the
main-branch guard — a hook that references a script that gets renamed, moved, or deleted quietly
stops protecting whatever it was protecting.

**The rule going forward:**
Never invoke a hook script as a bare path. Wrap it so a missing file is a loud, visible failure
instead of a silent no-op:

```sh
bash -c '[ -f scripts/hooks/guard-main-commit.sh ] && exec scripts/hooks/guard-main-commit.sh "$@" || echo "guard-main-commit.sh missing — see docs/solutions/2026-07-06-hooks-fail-open-on-missing-command.md" >&2' --
```

The existence check plus an explicit `echo ... >&2` turns "the guard silently isn't running" into
"the guard is visibly broken," which someone will actually notice and fix. When adding a new hook
to `.claude/settings.json`, apply the same wrapper — assume the referenced script won't always be
present in every checkout (a worktree cut from an older commit, a fresh clone missing a later
addition) and design for that case explicitly rather than trusting the path always resolves.

**Evidence:** pull request #236.
