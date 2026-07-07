# fastapi-postgres starter

Drop-in process files for a Python 3.12 / FastAPI / Postgres project using Alembic
migrations and GitHub Actions. Implements the pattern library at `../../` (docs 01–09).

## Contents

```
AGENTS.md                        rules file, injected into agent sessions
docs/autonomy-runbook.md         rules for unattended runs; kill switch; hold list
scripts/setup-worktree.sh        fresh-workspace setup, fake-backends by default
scripts/merge_gate.py            mechanical merge predicate (paths vs. hold list)
.github/workflows/check.yml      the CI gate: ruff + mypy + pytest
agents/reviewers/*.md            starter reviewer checklists (security, resilience, migrations)
```

## Assumptions

- `uv` for dependency management (`uv sync`); swap for pip/poetry if that's your setup.
- One gate command exists; the kit assumes a Makefile target:
  `make check` = `ruff check . && mypy . && pytest`. Add it if missing.
- An `APP_FAKE_BACKENDS=1` env flag swaps Postgres/external services for in-memory fakes or
  a disposable SQLite/testcontainer. If you don't have one, add it first: it's what lets
  workspaces run with no credentials, and lets N parallel workspaces avoid racing one
  shared database (Alembic migrations from two branches against one DB is the canonical
  collision).
- Preview: deploy the PR image to an ephemeral environment (Fly/Render/K8s namespace) and
  post the URL + smoke-test result on the PR. Stack-specific; the kit leaves a `TODO`.

## Setup

1. Copy contents to the repo root; fill every `TODO(project)`.
2. Branch protection on `main`: require the `check` workflow, forbid direct pushes.
3. Verify: `scripts/setup-worktree.sh` in a fresh worktree, then `make check`, with no env
   vars set.
4. Auto-merge stays `off` in the runbook until machine review has a track record.

## Task loop

```bash
git worktree add /tmp/<task> origin/main -b feat/<task>
cd /tmp/<task> && scripts/setup-worktree.sh
# … implement …
make check
git push -u origin feat/<task>
gh pr create --head feat/<task> --base main
python scripts/merge_gate.py feat/<task>    # prints AUTO or HOLD + why
git worktree remove /tmp/<task>             # after merge
```
