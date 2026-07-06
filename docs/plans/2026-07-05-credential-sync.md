# Credential-based balance auto-sync + pretty sync addresses

**Status: implemented (flag-gated, inert by default)**
**Flags: `HOP_ENABLE_CREDENTIAL_SYNC` (+ `HOP_CREDENTIAL_KEY`)** for the vault;
the scheduled fetch additionally needs `HOP_BALANCE_FETCH_WORKER_URL` +
`HOP_BALANCE_FETCH_SECRET` (a deployed `cloudflare/balance-fetch-worker`).

## Why

The first balance-sync PR (#206) shipped the credential-*free* rails (paste + email forward). This
adds the two things asked for next:

1. **"hop logs in and gets my balances autonomously."** A credential vault + scheduled headless
   login that reads the balance for the user.
2. **A pretty forwarding address.** The long HMAC address (`sync+<userId>.<sig>@`) is replaced in
   the UI by a short random alias (`sync-x7k2p9@`).

## Honest framing (important)

Major loyalty programs actively fight automated logins (bot detection, device fingerprinting,
MFA). This seam does **not** pretend to defeat that. It:

- syncs the programs it has a **verified recipe** for, and marks every other login
  **`unsupported`** rather than silently failing;
- surfaces a truthful **per-login status** (`pending` / `ok` / `failed` / `unsupported`) with the
  last error;
- keeps **paste + forward as the always-works fallback** for everything else.

That honesty is the design, not a limitation to paper over — it's why AwardWallet's scraping is a
whole company.

## Credential vault — `lib/credential-vault.ts`

- Username + password are encrypted as **one AES-256-GCM blob** per row (`hop_program_credentials`),
  keyed by `HOP_CREDENTIAL_KEY` (64-hex). Random 12-byte IV per write; the GCM tag makes tampering
  a hard decrypt failure.
- Plaintext exists only inbound (`addCredential`) and in the cron's `decryptCredential` step. It is
  never logged, never returned to the client (`username_mask` is the display form), and never
  leaves the server except to the fetch worker over the shared-secret channel.
- No valid key → every function fails closed. Every query is `user_id`-scoped in code (`withDb`).

## Scheduled fetch — `lib/balance-autosync.ts` + `app/api/cron/balance-autosync`

Daily cron (gated by `isCredentialAutosyncLive()` + `CRON_SECRET`). For each due credential:
decrypt → ask the Browser Rendering worker to sign in and return the dashboard **text** → run that
text through the **same** `extractBalances` clamp as the other rails, filtered to the credential's
own program → upsert via `applyExtractedBalances`. The worker computes no number; a balance still
has to appear in (and near a mention of) the program's page text. Per-run capped; each credential
independent; never throws.

## Fetch worker — `cloudflare/balance-fetch-worker/`

Cloudflare **Browser Rendering** + Puppeteer. `POST /fetch` (Bearer secret) signs in per a
per-program `RECIPES` entry and returns visible text. `RECIPES` starts **empty** — a program is
added only after its recipe is verified live; until then it returns `unsupported`. No anti-bot
evasion, no credential storage/logging in the worker.

## Pretty sync address — `lib/balance-sync.ts`

A short random alias (`hop_sync_addresses`, alphabet excludes look-alikes) minted lazily on
`/account`. `sync-<alias>@` resolves by DB lookup (`resolveSyncAlias`); the legacy HMAC address
stays accepted (`resolveSyncAddress`) so anything already handed out keeps working. The ingest
route tries the alias first, then the HMAC.

## Security

- Vault double-gate: flag **and** a valid AES key — no key, no storage.
- Credential server actions (`app/actions/credentials.ts`): session + flag gated, size-capped,
  password never returned.
- Cron authz via `CRON_SECRET`; worker authz via constant-ish-time Bearer compare.
- Account deletion sweeps both new tables (`lib/account-deletion.ts`).

## Pieces

| Piece | Path |
| --- | --- |
| Vault (crypto, store, cron access) | `lib/credential-vault.ts` |
| Autosync engine | `lib/balance-autosync.ts` |
| Cron route | `app/api/cron/balance-autosync/route.ts` (+ `vercel.json`) |
| Fetch worker | `cloudflare/balance-fetch-worker/` |
| Pretty alias | `lib/balance-sync.ts` (`getOrCreateSyncAlias`, `resolveSyncAlias`, …) |
| Credential actions | `app/actions/credentials.ts` |
| Account UI | `components/ProgramLogins.tsx` |
| Flags + keys | `lib/env.ts` |
| Schema | `lib/db/schema.ts`, `drizzle/0005_*.sql` |
| Tests | `lib/__tests__/credential-vault.test.ts`, `lib/__tests__/balance-sync.test.ts` |
