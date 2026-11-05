---
title: Weekly audit authenticates with GitHub workload identity
date: 2026-11-04
category: security
tags: [github-actions, anthropic, authentication]
---

The weekly invariant audit uses workload identity federation: GitHub signs a short-lived
identity token, and the Anthropic SDK exchanges it for Claude API access. The workflow no
longer injects `ANTHROPIC_API_KEY`. Local API-key runs still work.

The Newth.ai federation rule `hop-weekly-audit` permits only:

- GitHub issuer `https://token.actions.githubusercontent.com`, audience `https://api.anthropic.com`.
- Owner `n3wth` / ID `5912894`, repository `n3wth/hop` / ID `1284267448`.
- Subject `repo:n3wth/hop:ref:refs/heads/main` and ref `refs/heads/main`.
- Workflow `n3wth/hop/.github/workflows/weekly-audit.yml@refs/heads/main`.
- Events `schedule` or `workflow_dispatch`.
- Default workspace, scope `workspace:developer`, token lifetime capped at 600 seconds.

The SDK already supports federation; no dependency upgrade or custom exchange code is
needed. The identity file is private, masked in logs, and removed after the audit.
Audit steps are bounded to five minutes so they finish within the identity token's
usable lifetime without a token refresh loop.

After merging, dispatch the audit on `main` with `dry_run=true` and confirm a successful
exchange in the Claude Console authentication events. A rule existing in the Console
does not prove a successful exchange. Keep existing API keys until their other consumers
are identified and migration is verified.
