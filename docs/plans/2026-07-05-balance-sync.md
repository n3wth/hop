# Balance sync — an AwardWallet-independent syncing seam

**Status: implemented (flag-gated, inert by default)**
**Flag: `HOP_ENABLE_BALANCE_SYNC`** · AI path additionally needs `AI_GATEWAY_API_KEY` · email rail
additionally needs `HOP_BALANCE_INGEST_SECRET` + a deployed `cloudflare/balance-sync-worker`.

## Problem

hop's only auto-sync today is AwardWallet (`lib/awardwallet.ts`) — a third-party dependency with
its own signup, API key, and coverage limits. Manual entry (`hop_manual_balances`) is the primary
path but goes stale. We want a **generalized, first-party** way to keep balances current that
works for *any* loyalty program, without scraping bank/airline sites (credential storage, ToS
risk, brittle).

## Approach — "hop reads what you already have"

Every loyalty program already tells the user their balance: statement emails, account pages,
app screenshots. The seam accepts that text through two rails and turns it into
`hop_manual_balances` rows through ONE extraction + clamp pipeline:

1. **Paste** (`/account` → POST `/api/balance-sync`, session-authed): paste a statement email or
   an account-page copy; hop previews what it read; the user confirms; rows upsert.
2. **Email forward** (Cloudflare Email Worker → POST `/api/balance-sync/ingest`, shared-secret):
   the user forwards balance emails to their **personal sync address**
   (`sync+<userId>.<hmac8>@…`). The address itself is the capability — an HMAC-signed user id,
   so a spoofed `From:` can never write into someone else's account and no DB scan is needed.

### Extraction: AI translator with a deterministic clamp

`lib/balance-sync.ts#extractBalances` follows the established NL-translator shape
(`lib/ai-gateway.ts#callGateway`, same as prefs/standing-orders/counterfactual parsers):

- **AI path**: a cheap gateway model (default `anthropic/claude-haiku-4-5`, override
  `HOP_BALANCE_SYNC_MODEL`) translates freeform text → strict JSON `{ balances: [...] }`.
- **The clamp** (`validateExtracted`): every entry must pass deterministic checks before it can
  touch the DB — program string sanitized + length-bounded, balance an integer in
  `[0, 50,000,000]`, the balance's digits **literally appear in the source text**
  (`balanceAppearsInText`), the program is **actually mentioned** in the text
  (`programAppearsInText`), and the balance sits **within ~300 chars of a program mention**
  (`balanceNearProgram`). The model can transcribe a number the user gave us; it can neither
  invent one nor attribute a real number (an order/confirmation number elsewhere in the email)
  to a program it was never near. Numbers are *verified*, not generated.
- **Deterministic fallback**: no gateway key / call fails → a pure regex parser
  (`parseBalancesDeterministic`) matches known program names/aliases (`lib/programs.ts`) against
  same-line (or short look-ahead) number tokens: identifier-labeled numbers
  ("account 8123456", "confirmation #…", "member …") are excluded, a keyword-adjacent number
  ("12,400 miles", "balance: 12,400") wins, and ambiguous lines are skipped. Conservative: a
  missed balance is fine, a wrong one is not.
- Programs canonicalize through `canonicalizeProgram` (same identity the whole engine joins on);
  unknown programs keep their free text + a derived monogram, exactly like manual adds.

### Apply: reuse the manual-balances path

`applyExtractedBalances` upserts through the existing `lib/accounts.ts` helpers
(`findManualByProgram` → `updateManualBalance` / `addManualBalance`), so synced rows are ordinary
manual rows: editable in `ProgramsManager`, merged by `getUserBalances` (AwardWallet still wins
for programs it covers), zero schema migration. Re-forwarding the same email is naturally
idempotent (same value → unchanged).

## Why not…

- **Scraping (what AwardWallet does)**: needs stored credentials + per-site automation; breaks
  constantly; ToS-hostile. Rejected.
- **A new table**: `hop_manual_balances` already has the right shape, UI, and merge semantics.
- **Extraction in the Worker (Workers AI)**: possible later, but keeping ONE clamp path on the
  server (Vercel AI Gateway) means paste and email share validation byte-for-byte.

## Security

- Ingest route: constant-time Bearer check (`HOP_BALANCE_INGEST_SECRET`), 503 when unconfigured,
  401 otherwise — the support-ingest pattern. Rate-limited per IP.
- User resolution: only via the HMAC-verified sync address (keyed on `resolveAuthSecret()`),
  never the spoofable `From:`. Bad/missing signature → soft reject, no write.
- Session route: `getUserId()` + per-user rate limit; body size-capped.

## Pieces

| Piece | Path |
| --- | --- |
| Core (parse, clamp, apply, sync address) | `lib/balance-sync.ts` |
| Flag + secret | `lib/env.ts` (`isBalanceSyncEnabled`, `HOP_BALANCE_INGEST_SECRET`) |
| Paste route | `app/api/balance-sync/route.ts` |
| Email ingest route | `app/api/balance-sync/ingest/route.ts` |
| Email Worker (relay only) | `cloudflare/balance-sync-worker/` |
| Account affordance | `components/BalanceSyncPaste.tsx` (+ `app/account/page.tsx`) |
| Tests | `lib/__tests__/balance-sync.test.ts` |
