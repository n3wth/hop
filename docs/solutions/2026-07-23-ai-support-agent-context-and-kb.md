---
title: Deterministic KB search and account context bounds for AI support agent
date: 2026-07-23
tags: [support, ai-agent, kb, search, security, escalation]
files: [lib/support-kb.ts, lib/support-context.ts, lib/support-agent-tools.ts, app/support/page.tsx, components/SupportChat.tsx]
status: solved
---

## Problem

Building an AI Customer Support Agent for `/support` requires providing context-aware answers to user queries while avoiding two major failure modes:
1. **Brand-name keyword over-biasing in KB search**: Common queries like "why did hop say pay cash" include the brand name "hop". Without stop-word filtering, "hop" matches generic "Getting Started with hop" articles over specific "How the verdict works" articles.
2. **Context & Secret Leakage**: Passing full user objects or raw DB rows to LLM contexts risks exposing unwhitelisted fields (e.g. `secretApiToken`, `stripeCustomerId`) or inventing uncalculated economic numbers.
3. **Flapping human escalation requests**: Unauthenticated users or repeat button clicks could spam escalation tickets.

## Solution

1. **Stop-word filtering & explicit titles in `lib/support-kb.ts`**:
   - Filter out common stop words (`hop`, `why`, `did`, `does`, `how`, `what`, `where`, `can`, `with`, `say`, `says`) during keyword scoring in `searchSupportKb`.
   - Explicitly title KB entries (e.g., `How the verdict works (pay cash vs points)`).
2. **Strictly bounded account snapshot in `lib/support-context.ts`**:
   - `snapshotSummary()` explicitly constructs output from a whitelist of `AccountSnapshot` fields (`signedIn`, `balances`, `tier`, `prefs.homeAirport`, `hasAwardWallet`).
   - Property injection (e.g. `secretApiToken`, `stripeCustomerId`) cannot reach the system prompt.
   - System prompt instructs the agent never to invent or recalculate economic numbers.
3. **Idempotent escalation tools in `lib/support-agent-tools.ts`**:
   - `escalate_to_human` requires a validated user email (session email for signed-in users, or user-provided email for anonymous users).
   - Escalation calls are idempotent within the tool instance, preventing duplicate ticket creation on repeat submissions.

## Verification

- `npx vitest run lib/__tests__/support*` passed all 36 tests across 6 files.
- `npm run check` passed all migration checks, ESLint, TypeScript types, and 1,388 unit tests across 116 test files.
