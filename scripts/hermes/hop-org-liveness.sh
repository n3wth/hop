#!/bin/bash
# hop org-liveness watchdog: checks each autonomous desk (branch-prefix owner)
# produced a branch or PR within its expected cadence window. Silent when all
# desks are within window; hermes cron runs this with --no-agent, so stdout is
# delivered verbatim and empty stdout means no message is sent.
#
# Checks PR history (all states), not just live branches, because a merged PR
# has its branch deleted (--delete-branch) — checking live branches only would
# falsely flag a desk that shipped and merged successfully. Live branches are
# checked too, as a fallback for a pushed-but-not-yet-PR'd branch.
set -u
REPO="n3wth/hop"
NOW=$(date +%s)
ALERTS=()

to_epoch() {
  date -j -f "%Y-%m-%dT%H:%M:%SZ" "$1" "+%s" 2>/dev/null || echo 0
}

check_desk() {
  local prefix="$1" limit_days="$2" label="$3"
  local latest_epoch=0 latest_desc=""

  local pr_json
  pr_json=$(gh pr list --repo "$REPO" --state all --json headRefName,createdAt,url --limit 300 2>/dev/null \
    | python3 -c "
import json, sys
prefix = sys.argv[1]
data = json.load(sys.stdin)
matches = [p for p in data if p['headRefName'].startswith(prefix)]
matches.sort(key=lambda p: p['createdAt'], reverse=True)
print(json.dumps(matches[0]) if matches else '')
" "$prefix" 2>/dev/null)
  if [ -n "$pr_json" ]; then
    local created url
    created=$(echo "$pr_json" | python3 -c "import json,sys;print(json.load(sys.stdin)['createdAt'])" 2>/dev/null)
    url=$(echo "$pr_json" | python3 -c "import json,sys;print(json.load(sys.stdin)['url'])" 2>/dev/null)
    if [ -n "$created" ]; then
      latest_epoch=$(to_epoch "$created")
      latest_desc="PR $url ($created)"
    fi
  fi

  local branches
  branches=$(gh api "repos/$REPO/branches" --paginate --jq ".[] | select(.name | startswith(\"$prefix\")) | .name" 2>/dev/null)
  while IFS= read -r b; do
    [ -z "$b" ] && continue
    local enc date_str e
    enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1], safe=''))" "$b" 2>/dev/null)
    [ -z "$enc" ] && continue
    date_str=$(gh api "repos/$REPO/commits/$enc" --jq '.commit.committer.date' 2>/dev/null)
    [ -z "$date_str" ] && continue
    e=$(to_epoch "$date_str")
    if [ "$e" -gt "$latest_epoch" ]; then
      latest_epoch=$e
      latest_desc="branch $b ($date_str)"
    fi
  done <<< "$branches"

  if [ "$latest_epoch" -eq 0 ]; then
    ALERTS+=("$label: no branch or PR ever seen with prefix '$prefix'")
    return
  fi
  local age_days=$(( (NOW - latest_epoch) / 86400 ))
  if [ "$age_days" -gt "$limit_days" ]; then
    ALERTS+=("$label: silent ${age_days}d (limit ${limit_days}d) — last activity: $latest_desc")
  fi
}

check_desk "autopilot/" 2 "Engineering autopilot (Jeffrey)"
check_desk "growth/" 3 "Growth desk (Omar)"
check_desk "retro/" 8 "Weekly retro (Bob)"
check_desk "finance/" 8 "Head of finance (Elizabeth)"

if [ ${#ALERTS[@]} -gt 0 ]; then
  echo "hop org-liveness watchdog: ${#ALERTS[@]} desk(s) past their cadence window"
  for a in "${ALERTS[@]}"; do
    echo "- $a"
  done
fi
