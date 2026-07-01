#!/usr/bin/env bash
# Setup script for the Claude Code cloud container (point the environment's
# "setup script" at this file). Idempotent: safe to re-run. Installs deps only —
# the agent runs `npm run build` itself after each code change.
#
# Env vars for the container are set in the Claude Code environment settings,
# NOT here (see .env.example for the list). The two that matter for iterating on
# website content/aesthetics visually are UNSPLASH_ACCESS_KEY (destination
# photos) and MOCK=1 (cash/awards/balances fixtures) — everything else degrades
# to a clean no-op when unset, so pages still render.
set -euo pipefail

cd "$(dirname "$0")/.."

# Prefer the reproducible install; fall back to `npm install` if there's no
# lockfile-in-sync (npm ci is strict and fails on drift).
if [ -f package-lock.json ]; then
  npm ci || npm install
else
  npm install
fi

# The headless Chromium used for visual verification is pre-installed at
# $PLAYWRIGHT_BROWSERS_PATH (/opt/pw-browsers) on this harness — nothing to do.
echo "setup-cloud: deps installed. Build with 'npm run build', shoot with 'scripts/shoot.sh /'."
