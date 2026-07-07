#!/usr/bin/env bash
# Fresh-workspace setup. Idempotent; no credentials required for the default path.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# 1. Env: fake backends by default. Real credentials are a separate, explicit step.
if [ ! -f .env ]; then
  cp .env.example .env 2>/dev/null || touch .env
  grep -q '^APP_FAKE_BACKENDS=' .env || echo 'APP_FAKE_BACKENDS=1' >> .env
  echo "wrote .env (fake backends)"
fi

# 2. Deps (uv; swap for pip/poetry if that's the project's tool).
uv sync

# 3. Trunk guard: refuse commits on the default branch.
HOOK=.git/hooks/pre-commit
mkdir -p "$(dirname "$HOOK")"
cat > "$HOOK" <<'EOF'
#!/usr/bin/env bash
branch=$(git branch --show-current)
if [ "$branch" = "main" ]; then
  echo "refusing to commit on main — create a branch (see AGENTS.md)" >&2
  exit 1
fi
EOF
chmod +x "$HOOK"

echo "workspace ready: make dev / make check"
