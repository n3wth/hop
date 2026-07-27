#!/usr/bin/env bash
# Fresh-workspace setup. Idempotent; no credentials required for the default path.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# 1. Env: mock mode by default. Real credentials are a separate, explicit step.
if [ ! -f .env.local ]; then
  cp .env.example .env.local 2>/dev/null || touch .env.local
  grep -q '^MOCK=' .env.local || echo 'MOCK=1' >> .env.local
  echo "wrote .env.local (mock mode)"
fi

# 2. Deps.
npm ci

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

echo "workspace ready: npm run dev / npm run check"
