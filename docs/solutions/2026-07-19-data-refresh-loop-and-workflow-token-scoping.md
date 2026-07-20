---
title: Data Refresh Loop (L3) - GitHub Actions Token Scoping and Safe CLI Error Gates
date: 2026-07-19
decisions: [ "0007", "0009" ]
---

# Data Refresh Loop (L3) - GitHub Actions Token Scoping and Safe CLI Error Gates

## 1. Symptom

During the implementation of the monthly Data Refresh Loop (L3) workflow (`.github/workflows/data-refresh.yml`), the system was designed to automatically regenerate place facts and climate normal datasets, commit them, and open a plain diff Pull Request. However, two load-bearing workflow errors were identified during peer/adversarial review:

1. **Token Scoping / Push Blindness:** The initial workflow used `actions/checkout` with default settings and then passed `GITHUB_TOKEN` to the `gh pr create` step. Because `actions/checkout` persists the default repo token (`github.token`) in origin, subsequent git pushes ran under the default token instead of the configured Personal Access Token (PAT). In restricted environments, the push would fail silently or, if it succeeded, the resulting PR would not trigger `pull_request` CI checks because events triggered by default tokens do not chain workflows.
2. **Fragile CLI Error Gates:** The `gh pr create` step was appended with `|| echo "PR already exists"` to make the workflow idempotent. This swallowed all other classes of API/CLI failures (such as expired tokens, permission drift, or CLI crashes) as successful green runs, even though no PR was created.
3. **Weakened Test Assertions:** An unrelated test for tracking links was relaxed to `/[?&]ref=/` instead of `ref=hop-card`. Since the tracking helper resolves to `NEXT_PUBLIC_CJ_AFFILIATE_TAG` without a default-value fallback if unconfigured, this weakened check allowed empty parameters (`?ref=`) to pass, silently leaking attribution in unconfigured environments.

## 2. Root Cause

1. **GitHub Action Invariant:** `actions/checkout` persists the credentials of the token it receives at checkout. If a PAT is needed to push changes that trigger downstream actions, the token must be passed to the checkout step itself.
2. **Bash Pipestatus & Short-circuiting:** Using a broad catch-all short-circuit (`||`) in bash discards the exit status of the preceding command completely. In automated cron loops, this makes silent failures the default mode of operation.
3. **Environment Leakage:** Relaxing tests to match any occurrence of `?ref=` rather than asserting the non-empty presence of an actual tag (`/[?&]ref=[^&]+/`) allows regressions in environment-variable binding to go uncaught in test suites.

## 3. Solution

We refactored both the workflow and the test files to enforce strict error handling and tighter verification:

### Direct PAT Scoping in Checkout
We explicitly scoped the `actions/checkout` step with the correct bot token so git pushes leverage the PAT natively and trigger standard pull-request checks:

```yaml
      - name: Checkout repository
        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          fetch-depth: 0
          token: ${{ secrets.HOP_BOT_TOKEN }}
```

### Targeted CLI Error Isolation
Instead of discarding all CLI errors, we captured the stderr/stdout of `gh pr create` and parsed it to selectively ignore "already exists" conditions while propagating all other execution failures:

```bash
          # Create pull request using GitHub CLI, ignoring only if it already exists
          gh pr create --head bot/data-refresh --base main \
            --title "chore(data): monthly place facts and climate normals refresh" \
            --body "Monthly auto-refresh of Wikidata facts, Open-Meteo climate normals, and Frankfurter FX rates. This PR is created automatically by the Data Refresh Loop (L3)." > pr_output.log 2>&1 || {
              cat pr_output.log
              if grep -qi "already exists" pr_output.log; then
                echo "PR already exists"
              else
                echo "Error: gh pr create failed"
                exit 1
              fi
            }
```

### Non-Empty Parameter Assertion
We updated the affiliate tracking test in `lib/__tests__/card-affiliates.test.ts` to assert that `ref` is always bound to a non-empty value, catching unconfigured environment variables before they reach production:

```typescript
      expect(card.applyUrl, id).toMatch(/[?&]ref=[^&]+/)
```

## 4. Lessons Learned

1. **Always Pass PATs to Checkout:** If a GitHub Action needs to push commits back to the repo that trigger downstream CI, pass the custom PAT directly into `actions/checkout@v4` with `token: ${{ secrets.YOUR_PAT }}`.
2. **Avoid Broad Catch-all Short-circuits (`|| true`):** If a command is allowed to fail under a specific condition (e.g., resource already exists), redirect output to a log file, verify the exact error message, and let all other failures fail-closed.
3. **Verify Values, Not Just Key Presences:** When writing assertions for URL tracking parameters, check that the value is non-empty (`[^&]+`) to prevent environment unbindings from silently eroding conversion.
