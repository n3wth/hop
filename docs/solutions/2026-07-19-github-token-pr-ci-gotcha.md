---
title: GitHub GITHUB_TOKEN pull request trigger limitation (The PR-CI Gotcha)
date: 2026-07-19
tags: [github-actions, github-token, pull-request, bot, automation, ci]
files: [.github/workflows/data-refresh.yml]
status: solved
---

## Problem

When a GitHub Actions workflow creates a pull request or pushes code using the default `GITHUB_TOKEN`, any subsequent workflows triggered by `pull_request` or `push` events do not run on that PR. This is a security design by GitHub to prevent infinite workflow loops, but it results in a silent failure of Continuous Integration (CI) and build checks on automated, bot-created PRs.

In the case of the Monthly Data Refresh Loop (`data-refresh.yml`), the newly created PR would land with zero CI feedback, potentially bypassing required code quality gates or failing silently on regression bugs.

## Solution

Created pull requests must be authenticated with a fine-grained Personal Access Token (PAT) named `HOP_BOT_TOKEN` instead of the default `GITHUB_TOKEN` secret. 

The PAT must be configured with specific minimum scopes:
- `contents: write` (to push the branch)
- `pull-requests: write` (to open the PR)

Using a custom PAT rather than the default `GITHUB_TOKEN` makes GitHub treat the PR creation as a human-like external action, triggering the `pull_request` CI workflow normally so that all code validation checks are executed before merge.

## Non-obvious learnings

1. **Automation needs explicit human-like identity to trigger other automations.** The GitHub Actions execution boundary is strictly segmented; default tokens cannot spawn secondary events.
2. **Always include local verification inside the generator workflow itself.** Even when using a custom PAT, the `data-refresh.yml` workflow should (and does) run `npm run check` and path-guards locally before pushing. This provides a robust second belt in case the custom PAT expires or the downstream CI fails to trigger.
3. **PAT scope must be fine-grained.** Never use a classic repo-all PAT; configure a fine-grained token scoped strictly to the target repository and the minimum required permissions (`contents` and `pull-requests`) to minimize the blast radius.
