# nextjs-vercel starter — agentic process kit

Drop-in process files for a Next.js App Router project deployed on Vercel with GitHub
Actions. Implements the pattern library at `../../` (docs 01–09).

## Contents

```
AGENTS.md                        rules file — injected into agent sessions
docs/autonomy-runbook.md         rules for unattended runs; kill switch; hold list
scripts/setup-worktree.sh        fresh-workspace setup, mock-mode by default
scripts/merge-gate.mjs           mechanical merge predicate (paths vs. hold list)
.github/workflows/check.yml      the CI gate: lint + typecheck + test + build
agents/reviewers/*.md            starter reviewer checklists (security, resilience, framework-version)
```

## Assumptions

- `npm run check` runs lint + typecheck + tests (add it if missing:
  `"check": "npm run lint && npm run typecheck && npm test"`).
- Vercel is connected to the repo, so every PR gets a preview deployment automatically.
- A `MOCK=1` (or similar) env flag swaps external services for fixtures. If you don't have
  one, add it before pointing agents at the repo — it's what lets workspaces run without
  credentials.

## Setup

1. Copy contents to the repo root; fill every `TODO(project)`.
2. Branch protection on `main`: require the `check` workflow, forbid direct pushes.
3. Verify: `scripts/setup-worktree.sh` in a fresh worktree, then `npm run check`, with no
   env vars set.
4. Auto-merge stays `off` in the runbook until machine review has a track record
   (porting guide, stage 3).

## The loop

```bash
git worktree add /tmp/<task> origin/main -b feat/<task>
cd /tmp/<task> && scripts/setup-worktree.sh
# … implement …
npm run check
git push -u origin feat/<task>
gh pr create --head feat/<task> --base main
node scripts/merge-gate.mjs feat/<task>     # prints AUTO or HOLD + why
git worktree remove /tmp/<task>             # after merge
```
