---
title: "Keep .env.example complete by auditing process.env reads, not by memory"
date: 2026-07-04
tags: [env, ops, documentation, env-example, flags, drift]
files: [.env.example, docs/ops-runbook.md, lib/env.ts, instrumentation.ts]
status: solved
---

**Summary:**
`.env.example` had drifted: an entire production capability (billing —
`HOP_ENABLE_BILLING` + four Stripe vars), the auth flags
(`HOP_ENABLE_EMAIL_PASSWORD_AUTH`, `HOP_ENABLE_PASSKEY_AUTH`,
`HOP_PASSKEY_RP_ID`), `HOP_OWNER_EMAIL`, the PostHog vars, the `KV_REST_API_*`
Upstash aliases, and the Parallel/Autonoma/Firecrawl keys were all read by the
app but absent from the file. Rebuilt it as the complete truth and added
`docs/ops-runbook.md` for the on/off procedures.

**The audit command** (run it whenever adding an env read, or reviewing a diff
that adds one):

```bash
rg -o 'process\.env\.[A-Z0-9_]+' -N --no-filename lib app scripts *.ts *.mjs \
  | sort -u | sed 's/process\.env\.//' \
  | while read v; do grep -q "^$v=" .env.example || echo "MISSING: $v"; done
```

**Learnings:**
- The `EnvKey` union in `lib/env.ts` is NOT the full env surface — cron gates
  (`STANDING_ORDERS_CRON_ENABLED`, `SEO_CRON_ENABLED`, `CRON_SECRET`), email
  identities, PostHog, Upstash, `AI_GATEWAY_*`, and `MOCK` are read via raw
  `process.env` outside it (allowed for flags/non-secrets). Audit by grep, not
  by reading `lib/env.ts` alone.
- Platform-provided vars (`NODE_ENV`, `VERCEL_*`, `NEXT_RUNTIME`, `VITEST`) are
  deliberately excluded from `.env.example` — note the exclusion in the header
  so the next auditor doesn't "fix" it.
- `instrumentation.ts` falls back to a hardcoded write-only PostHog token when
  no key is set — telemetry defaults ON, which is easy to misdocument as
  "absent → off".
