#!/usr/bin/env python3
"""Mechanical merge predicate (pattern-library doc 05).

Usage: python scripts/merge_gate.py <branch> [--base main]
Prints AUTO or HOLD with reasons; exits 1 on HOLD. Checks the path tier and the kill
switch. CI-green and reviews-clear are enforced by branch protection; this script is the
part branch protection can't express.
"""
import re
import subprocess
import sys
from pathlib import Path

# Hold list: never auto-merged. TODO(project): tune. Keep the self-referential entries —
# agents must not merge changes to the gate itself.
HOLD = [
    r"^\.github/workflows/",        # CI is the merge gate
    r"^scripts/merge_gate\.py$",    # this file
    r"^docs/autonomy-runbook\.md$", # the policy + kill switch
    r"^pyproject\.toml$", r"^uv\.lock$",          # dependencies (supply chain)
    r"^alembic/", r"^app/models/",                # migrations + schema
    r"^app/api/auth", r"^app/core/(auth|security|session)",  # identity
    r"^app/api/(billing|webhooks)", r"^app/services/(payments|billing)",  # money
    r"^\.env", r"^Dockerfile$", r"^deploy/",
]


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: merge_gate.py <branch> [--base main]", file=sys.stderr)
        return 2
    branch = sys.argv[1]
    base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "main"

    runbook = Path("docs/autonomy-runbook.md").read_text()
    if not re.search(r"^Auto-merge:\s*on\b", runbook, re.M):
        print("HOLD: Auto-merge is off in docs/autonomy-runbook.md")
        return 1

    diff = subprocess.run(
        ["git", "diff", "--name-only", f"origin/{base}...origin/{branch}"],
        capture_output=True, text=True, check=True,
    )
    files = [f for f in diff.stdout.splitlines() if f]
    held = [f for f in files if any(re.search(p, f) for p in HOLD)]

    if held:
        # A partially-held PR is entirely held.
        print(f"HOLD: {len(held)} path(s) on the hold list:")
        for f in held:
            print(f"  {f}")
        return 1

    print(f"AUTO: {len(files)} changed path(s), all auto-tier.")
    print("Remaining conditions (enforced elsewhere): CI green on head; zero unresolved "
          "review threads; diff within the item's written scope.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
