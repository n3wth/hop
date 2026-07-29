#!/bin/bash
# hop org-liveness watchdog: checks each autonomous desk (branch-prefix owner)
# produced a verified green/merged PR within its expected cadence window.
# Uses scripts/verify-desk-run.mjs for deterministic verification.
#
# Silent when all desks are verified within window; hermes cron runs this
# with --no-agent, so stdout is delivered verbatim and empty stdout means
# no message is sent.

set -u
REPO="n3wth/hop"
NOW=$(date +%s)
ALERTS=()

# Determine directory containing this script / repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

to_epoch() {
  date -j -f "%Y-%m-%dT%H:%M:%SZ" "$1" "+%s" 2>/dev/null || \
  date -d "$1" "+%s" 2>/dev/null || echo 0
}

check_desk() {
  local prefix="$1" limit_days="$2" label="$3"

  local verify_output
  verify_output=$(node "$REPO_DIR/scripts/verify-desk-run.mjs" "$prefix" --repo "$REPO" 2>/dev/null || echo "")

  if [ -z "$verify_output" ]; then
    ALERTS+=("$label: verification script failed for prefix '$prefix'")
    return
  fi

  local ok status reason committed_at
  ok=$(echo "$verify_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ok', False))" 2>/dev/null)
  status=$(echo "$verify_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('status', 'unknown'))" 2>/dev/null)
  reason=$(echo "$verify_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('reason', ''))" 2>/dev/null)
  committed_at=$(echo "$verify_output" | python3 -c "import json,sys; data=json.load(sys.stdin); print(data.get('branch', {}).get('committedAt', ''))" 2>/dev/null)

  if [ "$ok" != "True" ] && [ "$ok" != "true" ]; then
    ALERTS+=("$label: desk run unverified ($status) — $reason")
    return
  fi

  if [ -z "$committed_at" ]; then
    ALERTS+=("$label: no commit timestamp reported for prefix '$prefix'")
    return
  fi

  local latest_epoch
  latest_epoch=$(to_epoch "$committed_at")
  if [ "$latest_epoch" -eq 0 ]; then
    ALERTS+=("$label: invalid timestamp '$committed_at' for prefix '$prefix'")
    return
  fi

  local age_days=$(( (NOW - latest_epoch) / 86400 ))
  if [ "$age_days" -gt "$limit_days" ]; then
    ALERTS+=("$label: silent ${age_days}d (limit ${limit_days}d) — last activity: $committed_at ($reason)")
  fi
}

check_desk "autopilot/" 2 "Engineering autopilot (Jeffrey)"
check_desk "growth/" 3 "Growth desk (Omar)"
check_desk "retro/" 8 "Weekly retro (Bob)"
check_desk "finance/" 8 "Head of finance (Elizabeth)"

if [ ${#ALERTS[@]} -gt 0 ]; then
  echo "hop org-liveness watchdog: ${#ALERTS[@]} desk(s) past their cadence window or unverified"
  for a in "${ALERTS[@]}"; do
    echo "- $a"
  done
fi
