#!/usr/bin/env bash
# Provisions a new git worktree for local dev. `.env*` is gitignored, and
# `git worktree add` only checks out tracked files — so every fresh worktree
# starts with NO env config, silently breaking the "MOCK=1, no keys needed"
# onboarding path documented in .env.example/README.
#
# Deliberately does NOT copy a real DATABASE_URL from another worktree: every
# worktree sharing one Neon connection means `npm run build`/`db:migrate` run
# from any of them applies schema migrations against the SAME database, racing
# other in-progress branches. Fixtures only, by default — wire up a real DB
# per worktree yourself if a task actually needs persistence.
#
# Usage: run from inside the new worktree after `git worktree add`.
#   scripts/setup-worktree.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env.local ]; then
  echo "setup-worktree: .env.local already present, leaving it alone."
else
  cat > .env.local <<'EOF'
# Fixture-only defaults for a fresh worktree — see scripts/setup-worktree.sh.
# No DATABASE_URL on purpose: this worktree shouldn't touch a shared database.
MOCK=1
EOF
  echo "setup-worktree: wrote .env.local (MOCK=1, no DATABASE_URL)."
fi

if [ -f package-lock.json ]; then
  npm ci || npm install
else
  npm install
fi

echo "setup-worktree: ready. 'npm run dev' for fixtures, or wire a real DATABASE_URL/API keys into .env.local yourself if this task needs them."
