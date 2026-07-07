# 02 — Isolated workspaces

## The pattern

Every task — human or agent — runs in a fresh workspace branched from trunk, lives as long
as the task, and is deleted after merge. Nothing commits to trunk directly.

```
trunk (protected)
  ├── workspace A (agent 1, task X)   → PR → merge → delete
  ├── workspace B (agent 2, task Y)   → PR → merge → delete
  └── workspace C (human, task Z)     → PR → merge → delete
```

What this buys:

- N agents work in parallel with no shared mutable state; the merge queue serializes them.
- A confused agent can at worst ruin its own workspace.
- A workspace created from trunk contains only the task's changes, so the PR diff is honest.
- Every run starts from the same state: current trunk plus a setup script.

## Requirements

1. **Workspace creation is cheap** — under a minute from task assigned to agent editing. In
   git: `git worktree add <path> origin/main -b <type>/<branch>` (worktrees share the object
   store, so this is much cheaper than a clone). In a monorepo with a virtual filesystem
   (citc/EdenFS), workspaces are already copy-on-write views and this pattern is native.
2. **A checked-in setup script** that produces a working dev environment *without production
   secrets*: install deps, write a local env file defaulting to mock fixtures or hermetic
   fakes. Real credentials are a second, explicit step used only by tasks that need them.
   Two reasons: most agent tasks don't need credentials, and parallel workspaces sharing one
   real database race each other (concurrent schema migrations are the usual casualty).
3. **Trunk protection at two layers**: server-side branch protection (required checks, no
   direct pushes) plus a local pre-commit hook refusing commits on trunk. The hook catches
   agents that never reach the server.
4. **A dirty-checkout rule.** Long-lived checkouts accumulate unrelated WIP. Before opening a
   PR, check status; if unrelated work is present, don't commit it alongside your change —
   create a fresh workspace from trunk, copy in only the files your change touches, and PR
   from there. This prevents the most common multi-agent-repo defect: a PR bundling a
   stranger's half-finished work.
5. **Explicit refs everywhere.** Branch inference fails inside worktrees and detached
   agents. PR creation, CI dispatch, and merges name the branch explicitly
   (`gh pr create --head <branch> --base main`).
6. **Cleanup after merge**: auto-delete the branch, remove the workspace. A periodic sweep
   (doc 08) can file cleanup items for orphans.

## hop's concrete loop

```bash
git worktree add /tmp/<name> origin/main -b <type>/<branch>
cd /tmp/<name>
scripts/setup-worktree.sh          # deps + mock-mode env + trunk-guard hook
# … implement …
npm run check                      # lint + typecheck + tests — same gate CI runs
git push -u origin <type>/<branch>
gh pr create --head <type>/<branch> --base main
gh pr merge <type>/<branch> --merge --auto --delete-branch
git worktree remove /tmp/<name>    # after merge
```

The setup script defaults to `MOCK=1` fixtures (no upstream API keys). A separate
`setup-worktree-auth.sh` pulls secrets from a password manager, used only when a task tests
sign-in flows. The IDE's worktree feature is configured to run the same setup script, so
human- and agent-created workspaces are identical.

## Porting

| Concern | Small git repo | GitHub-scale org | google3-style monorepo |
|---|---|---|---|
| Workspace | `git worktree` | worktree or ephemeral clone in a dev container | citc client (native) |
| Setup | checked-in shell script | devcontainer / setup action | hermetic already; build system provides deps |
| Mock-by-default | env flag + fixtures module | service fakes in a dev tier | hermetic test doubles / staging RPC targets |
| Trunk guard | pre-commit hook + branch protection | org ruleset | submit checks (direct trunk writes already impossible) |
| Cleanup | `git worktree remove` | TTL on ephemeral environments | client garbage collection |

In google3-style environments the VCS layer already solves isolation. The new work is item 2
(a no-credentials-by-default environment tier for agents) and item 4 — or sidestep item 4
entirely by making "fresh client per task" the only mode agents get.
