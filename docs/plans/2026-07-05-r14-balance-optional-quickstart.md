# R1.4 — balance-optional program add + 5-majors quick-start

> Plan. Status: approved, implemented.

## Decisions (resolving §10's open questions)

1. **Zero-balance transfer reachability (§10.1): DEFERRED.** No `lib/transfers.ts` change in this
   phase — a zero-balance/quick-start row does not count as a transfer source. Revisit once this
   phase's data shows whether balance-less adds convert to real-balance adds.
2. **Quick-start button visibility (§10.2): cold-start only** — rendered only when
   `manual.length === 0`, per the plan's own default recommendation. Not shown once any manual
   program exists.
3. **Analytics (§10.3): both events fire, distinctly.** `addQuickStartPrograms` keeps
   `first_program_added`'s existing contract (fires when the seed makes the user's first row, same
   check as manual `addProgram`) AND fires a new, distinct `quick_start_used` event with property
   `added_count` (the number of rows actually inserted, i.e. excluding any of the 5 that already
   existed) — so activation-via-quick-start is measurable separately from activation-via-manual-add
   without changing what `first_program_added` means.

TL;DR: let a signed-in user reach a real, non-"example" verdict without knowing an exact balance
— an "Add" with no balance entered now succeeds (stored as `0`, the engine already treats `0` as
"don't claim ownership" without a false "you have the miles" statement) — and add a one-tap
"Add the 5 majors" quick-start that seeds the five transferable bank currencies as zero-balance
rows. Both changes are additive to the existing `hop_manual_balances` / `addProgram` /
`ProgramsManager` machinery from R0.7/R1.1; no schema change, no new flag, no engine change.

## 1. Problem, grounded in the roadmap's own reasoning

`docs/plans/2026-07-03-critical-review-roadmap.md` (Structural problem 3, "The funnel inverts the
product") names this precisely: *"Both import paths are unavailable (AwardWallet connect degrades
without `AWARDWALLET_CONNECT_URL`; Gmail double-gated off), so activation = manual data entry
requiring external lookups."* R1.4's own line: *"Allow adding a program with balance unknown ('hop
still shows you the route's value'); a one-tap 'add the 5 majors' quick-start... Activation must
not equal data entry."* `docs/plans/2026-07-04-business-plan.md` §6 GTM step 1 calls repairing this
funnel the precondition for everything else ("nothing else matters until then"), and R1.1 (already
shipped) proves the pattern this plan extends: reduce the *number of things a user must do* between
a points-winning verdict and a believable answer.

Today `addProgram` (`app/actions/accounts.ts:56-106`) rejects the add outright when the balance
field is empty (`if (!balance.trim()) return { ok: false, error: 'Enter a valid balance' }`), and
the client mirrors that (`components/ProgramsManager.tsx:288-291`). A user who knows they hold
"some Amex points" but not the exact number — the common case, per the roadmap's own framing —
cannot add the program at all. Verified: **without a manual balance row, the search page renders
`isExample={!hasRealBalances}` (`app/search/page.tsx:330,392`) and `VerdictRail`'s ownership voice
never engages** (`hasRealBalances = balances.length > 0`), so the visitor's own verdict never
personalizes.

## 2. Why this is safe under the engine invariant (ADR 0002)

Traced before proposing anything: `holdsDirectly = directBalance != null && directBalance > 0`
(`lib/search.ts:217`) and `transfersTo` only counts a source `balances.find((b) =>
balanceIsSource(b, sourceId) && b.balance > 0)` (`lib/transfers.ts:188`). **A zero-balance row is
functionally identical to "no balance in this program" for every economic computation** — it
cannot flip `owns`, cannot light up a transfer path, cannot change `cpp`/`tier`/`verdict`. So:

- Adding a program at balance `0` is 100% engine-invariant-safe with **zero changes to
  `lib/search.ts`, `lib/transfers.ts`, or `lib/cpp.ts`** — it only flips `hasRealBalances` to
  `true` (`balances.length > 0`), which turns off the signed-out "example" framing
  (`PointsPanel isExample`) and lets `VerdictRail` render its already-existing "you don't yet hold
  enough" branch (`components/VerdictRail.tsx:225-234`) instead of the signed-out value-demo
  branch — which is the exact "hop still shows you the route's value" promise from the roadmap,
  already coded and shipped, just currently unreachable without a balance.
- **Deliberately out of scope this phase:** making a `0`-balance quick-start row count as a
  transfer *source* (so seeding Amex would surface "Alaska via Amex transfer" reachability even
  before the user enters a real number). That would require loosening `transfersTo`'s `balance > 0`
  guard to "row exists" for reachability only (never for amount) — a real, if small, engine change,
  and arguably a different economic claim ("you could transfer *some* points" vs "you hold N
  points"). Flagged as an open question (§8) rather than assumed.

## 3. UX changes

### 3a. Balance-optional add (`/account#programs`)

- `AddProgramForm` (`components/ProgramsManager.tsx:273-377`): balance input becomes genuinely
  optional. Placeholder changes from `"Balance"` to `"Balance (optional)"`. Client-side, drop the
  `if (!balance.trim()) { setError('Enter a balance'); return }` guard — an empty balance is a
  valid submission, not an error.
- `addProgram` (`app/actions/accounts.ts:56-106`): `parseBalance` treats an empty/whitespace input
  as `0` (not a parse failure) instead of erroring. A real invalid input (letters, negative,
  over-max) still errors exactly as today — only "nothing entered" changes behavior.
- **Display honesty for `0`-balance rows** (`ProgramRow`, `components/ProgramsManager.tsx:200-224`):
  render `"Balance not set — add it"` (a small text link that opens the row in edit mode) instead
  of the bare `"0"` for any manual row whose stored balance is exactly `0`. This is a deliberate
  simplification, not a new column: a user who types a literal `0` for a real zero balance is not
  a real-world case worth a schema migration for (see §4), and treating every `0` as "unset" is
  strictly more honest than showing a number that reads as "you hold nothing here" when the truth
  is "unknown."
- No changes to `VerdictRail`/`PointsPanel`/`app/search/page.tsx` — they already do the right thing
  once `hasRealBalances` flips true (verified in §2).

### 3b. "Add the 5 majors" quick-start (`/account#programs`, empty state)

- Lives in `ManualSection`'s existing empty state (`components/ProgramsManager.tsx:93-105`,
  currently "Add your points" text with no action) — add a secondary button beside/below the
  manual `AddProgramForm`: **"Add the 5 majors"**, subtext: *"Amex, Chase, Citi, Capital One, and
  Bilt — hop shows what your points are worth once you fill in real balances."* One tap, no modal,
  flat editorial (border button, no shadow/gradient), matching the existing AwardWallet CTA's
  visual weight (`components/ProgramsManager.tsx:504-509`) so it doesn't outrank the primary manual
  form.
- Only rendered when `manual.length === 0` (or arguably always visible but disabled/hidden once any
  of the 5 already exist — see open question §8; recommend: show only pre-first-add, since it's a
  cold-start affordance, not a persistent feature).
- After the action resolves, `router.refresh()` re-renders the section with 5 new "Balance not
  set" rows the user can fill in inline (reusing the edit-mode UI already in `ProgramRow`) — no new
  list/edit UI needed.
- This is exactly the moment R1.1's activation bridge (`app/account/page.tsx:223-236`, the
  `returnTo` banner) already lands a user on: a signed-in searcher with zero programs, routed here
  from a points-winning verdict they couldn't claim. Quick-start shortens "manual data entry
  requiring external lookups" to one tap + up to 5 numbers instead of 5 full add-flows.

## 4. Data model: no migration

Quick-start rows are ordinary `hop_manual_balances` inserts at `balance = 0`, exactly like a
balance-optional manual add (§3a) — same table, same columns, same `withDb` path. No new column,
no new table, no nullable-vs-zero distinction persisted: `0` **is** the "unknown" representation,
end to end (DB, engine, and now UI display). This was the one point worth double-checking before
committing to "no schema change" — confirmed in §2 that `0` produces no different *engine* output
than "row absent," so the only place "0 vs literally unset" could matter is display, and §3a
handles that with a copy rule, not a column. Rejected alternative: a nullable `balance` column or a
`balance_unknown` boolean — both are real options if the display simplification in §3a ever proves
wrong in practice (a support ticket about someone's genuine `0` balance), but they add a migration
and a second null-handling path for zero present-day benefit; do not build them speculatively.

## 5. The 5 majors — which programs, and their source

The five **transferable bank currencies** in `lib/programs.ts`' canonical registry — the same five
that head `lib/valuations.ts`' `BASELINE_CPP` table under its own `"Transferable bank currencies"`
comment block (`lib/valuations.ts:34-39`), so both the identity registry and the valuation table
already agree these five are the canonical "starter" set:

| id | name | source |
|---|---|---|
| `amex-mr` | Amex Membership Rewards | `lib/programs.ts` |
| `chase-ur` | Chase Ultimate Rewards | `lib/programs.ts` |
| `citi-typ` | Citi ThankYou Points | `lib/programs.ts` |
| `capital-one` | Capital One Miles | `lib/programs.ts` |
| `bilt` | Bilt Rewards | `lib/programs.ts` |

Rationale: bank-transferable points are the highest-reach starting point for a new user (most
travel-rewards credit cards route through one of these five), and — unlike airline/hotel programs —
a person can plausibly hold any subset of them without having flown a specific airline. Pull the
five by canonical `id` from `PROGRAMS` (`lib/programs.ts`) rather than hardcoding display strings,
so a future edit to `lib/programs.ts`'s name/aliases stays the single source of truth.

## 6. File-by-file changes

| File | Change | Est. lines |
|---|---|---|
| `lib/accounts.ts` | Add `QUICK_START_PROGRAM_IDS = ['amex-mr','chase-ur','citi-typ','capital-one','bilt']` and `seedQuickStartPrograms(userId): Promise<{ added: string[] }>` — for each id, resolve its `ProgramDef` via `PROGRAMS.find`, skip if `findManualByProgram` already resolves it (idempotent, never overwrites a real balance), else `addManualBalance(userId, def.name, 0, def.kind)`. Never throws (each insert already goes through `withDb`). | ~35 |
| `app/actions/accounts.ts` | (a) `parseBalance`: empty/whitespace input → `0` instead of `null`. (b) New action `addQuickStartPrograms(): Promise<Result>` — `requireUser()` (existing helper), call `seedQuickStartPrograms`, fire `first_program_added` via `captureServerEvent` if the user had zero programs before the call, `revalidateBalances()`, return a note like `"Added 5 programs — fill in real balances below."` (or "Already had N of these" when some existed). | ~25 |
| `components/ProgramsManager.tsx` | (a) `AddProgramForm`: drop the empty-balance client error, update placeholder/label copy. (b) `ProgramRow`: render "Balance not set — add it" (button into edit mode) when `program.balance === 0`. (c) New `QuickStartButton` (or inline in `ManualSection`'s empty state): `useTransition` + calls `addQuickStartPrograms`, `router.refresh()` on success, same note/error pattern as `AddProgramForm`. | ~60 |
| `docs/design/copy-spec.md` | One short addition under the account/programs section: the "Balance (optional)" / "Balance not set — add it" / quick-start button copy, so future edits hold the same terse voice. | ~10 |

No changes to: `lib/search.ts`, `lib/transfers.ts`, `lib/cpp.ts`, `VerdictRail.tsx`,
`app/search/page.tsx`, `lib/db/schema.ts`, `drizzle/*` (no migration).

## 7. Next.js 16 / React 19 notes

Both new/changed actions (`addQuickStartPrograms`, the `parseBalance` tweak inside `addProgram`)
are `'use server'` functions in an existing `'use server'` file (`app/actions/accounts.ts:1`) —
same pattern as every other action in that file (`revalidatePath` after mutation, no new route
handler, no caching/`fetch` involved). No new framework surface is introduced, so no Next
16-specific doc lookup changes the design; the existing file's `revalidatePath('/account')` /
`/` / `/deals` / `/ask` calls (`app/actions/accounts.ts:228-233`) already cover every page whose
balances-derived output needs to refresh after a quick-start seed, since it writes through the same
`addManualBalance` path as a manual add.

## 8. Test plan

New/extended vitest coverage, offline (no `DATABASE_URL`, `withDb` mocked exactly like
`lib/__tests__/accounts.test.ts` already does):

- **`lib/__tests__/accounts.test.ts`** (extend): `seedQuickStartPrograms`
  - Empty account → inserts exactly 5 rows, one call to `addManualBalance` per program, all at
    balance `0`.
  - Account that already holds one of the 5 (e.g. real Amex balance of 50,000) → adds the other 4,
    **does not** touch/overwrite the existing Amex row (assert `updateManualBalance`/
    `addManualBalance` is never called for the id that already resolved via
    `findManualByProgram`).
  - Called twice in a row (double-click / re-render) → second call is a no-op for all 5 (idempotent
    — no duplicate rows, no balance overwritten to `0`).
  - A `withDb` failure mid-loop degrades to whatever subset succeeded, never throws (matches the
    file's existing "never throws" test shape).
- **`app/actions/__tests__/accounts.test.ts`** (new, mirrors the `app/api/*/__tests__/route.test.ts`
  pattern already used elsewhere): `parseBalance`-level behavior via `addProgram` —
  - Empty balance string → `{ ok: true }`, stored value `0` (not an error).
  - Whitespace-only balance → same as empty.
  - Genuinely invalid balance (`"abc"`, negative, over `MAX_BALANCE`) → still errors exactly as
    today (regression guard that the optional-balance change didn't loosen real validation).
- **Manual verification** (per the `verify` skill — this touches a live runtime surface): with
  `MOCK=1`, sign in, add a program with the balance field left blank, confirm it saves and renders
  "Balance not set"; click "Add the 5 majors" on a fresh account, confirm 5 rows appear; click it
  again, confirm no duplicates; run a search and confirm the verdict no longer shows the
  signed-out "example" framing once at least one program exists.

Commands: `npx vitest run lib/__tests__/accounts.test.ts app/actions/__tests__/accounts.test.ts`,
then `npm run check` (lint + typecheck + test) and `npm run build`.

## 9. Review hooks

- **degradation-reviewer** — `seedQuickStartPrograms` and `addQuickStartPrograms` must never throw;
  confirm every DB call stays inside the existing `withDb`-wrapped `lib/accounts.ts` helpers rather
  than a new raw query.
- **engine-invariant-reviewer** — confirm no economic figure changes: this diff should show zero
  touches to `lib/search.ts`/`lib/cpp.ts`/`lib/transfers.ts`; the reviewer should be able to verify
  §2's claim (`0` balance ≠ different engine output) directly from the diff.
- **copy-voice-reviewer** — "Balance (optional)", "Balance not set — add it", and the quick-start
  button/subtext must hold `docs/design/copy-spec.md`'s terse/no-slop bar; no exclamation points,
  no "just" flattery language for the 5-majors framing.
- **security-reviewer** — `addQuickStartPrograms` follows the exact `requireUser()` +
  `user_id`-scoped-in-code pattern every other action in the file uses; confirm no new unscoped
  query is introduced.
- **compound-engineering:review:code-simplicity-reviewer** — flag if `QuickStartButton` ends up
  duplicating meaningful logic from `AddProgramForm`'s pending/error/note state machine; extracting
  a shared `useServerAction`-style hook is a reasonable follow-up if the duplication is real, but
  don't pre-build it for one caller.

## 10. Open questions for the human

1. **Zero-balance-as-transfer-source (§2's deferred item):** should a quick-start/unset program
   also count as a *transfer source* for reachability (not amount) — e.g. "you could reach Alaska
   via an Amex transfer" shown as a possibility even before a real Amex balance is entered? This
   needs a small, deliberate `lib/transfers.ts` change (loosen the `balance > 0` guard for
   reachability only) and a copy decision about how to phrase an amount-less transfer hint. Recommend
   deferring to a follow-up once this phase's data shows whether balance-less adds convert to
   real-balance adds — no need to build it speculatively.
2. **Quick-start button visibility after first add:** show only when `manual.length === 0` (cold-
   start only, my default above), or keep it visible until all 5 already exist (e.g., a user who
   added 2 manually could still one-tap the remaining 3)? The idempotent seed makes either safe;
   it's a product-taste call, not a technical constraint.
3. **`captureServerEvent('first_program_added', …)` semantics:** should a 5-row quick-start fire the
   existing `first_program_added` event once (today's contract: fires when the insert made the
   user's *first* row, `app/actions/accounts.ts:99-102`), or should R0.5's funnel analytics get a
   distinct `quick_start_used` event so activation-via-quick-start is measurable separately from
   activation-via-manual-add? No PostHog event taxonomy doc exists yet to check against — flagging
   rather than guessing.
