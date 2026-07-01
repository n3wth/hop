#!/usr/bin/env bash
# One-command visual verification for this harness. Wraps the recipe from
# AGENTS.md ("Visual verification on this harness") into a single foreground
# command, because two things bite here:
#   1. `next start` will NOT persist as a detached background process, so the
#      server and the screenshots must run inside ONE foreground command.
#   2. The agent proxy CLOSES Chromium's connection to any external URL, so you
#      can only screenshot localhost — never the Vercel preview.
#
# Usage:  scripts/shoot.sh [path ...]        # defaults to "/"
#   e.g.  scripts/shoot.sh / /deals /destinations/tokyo
# Writes one PNG per path to /tmp (a slugged filename) and prints where.
#
# Run `npm run build` first — the static pages are prebuilt, so a stale .next
# shows stale UI. UNSPLASH_ACCESS_KEY gates photos; MOCK=1 gates fixtures. Both
# are read from the environment (set them in the Claude Code env settings).
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${SHOOT_PORT:-3200}"
PATHS=("$@")
[ ${#PATHS[@]} -eq 0 ] && PATHS=("/")

CHROME=$(ls /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -n1)
if [ -z "${CHROME:-}" ]; then
  echo "shoot: no headless Chromium under /opt/pw-browsers — is this the cloud harness?" >&2
  exit 1
fi

node_modules/.bin/next start -p "$PORT" >/tmp/shoot-srv.log 2>&1 &
SRV=$!
trap 'kill "$SRV" 2>/dev/null || true' EXIT

# Wait for the server to answer (up to ~30s) before shooting.
for _ in $(seq 1 15); do
  sleep 2
  curl -sf -o /dev/null "http://localhost:$PORT/" && break
done

for p in "${PATHS[@]}"; do
  slug=$(printf '%s' "$p" | sed 's#^/##; s#[/?&=]#-#g; s#^$#home#')
  out="/tmp/shot-${slug}.png"
  "$CHROME" --headless --no-sandbox --disable-gpu --hide-scrollbars \
    --virtual-time-budget=12000 --window-size=1280,1600 \
    --screenshot="$out" "http://localhost:$PORT$p"
  echo "shoot: $p -> $out"
done
