# Enabling the agentic memory spine (M1–M4)

hop's "grows with you" memory ships **dark**: the code is on `main`, but every seam is
flag-gated and no-ops gracefully until an operator (a) creates the table and (b) flips the
flag. Nothing below touches the live experience until you do these two steps. This is
deliberate — it lets the feature land in small, reviewed PRs without ever risking production.

## What's shipped

| Milestone | What the user sees once enabled | Flag | Table |
|---|---|---|---|
| **M1 — glass box** | A "What hop knows about you" section on `/account`: your stated travel facts as plain, forgettable rows. | *(none — always on)* | *(reuses `hop_user_prefs.travel_profile`)* |
| **M2 — conversation memory** | Resumed `/ask` threads stay context-aware a month later ("you were weighing Lisbon vs Tokyo, fly business"). | `HOP_ENABLE_CONVO_MEMORY` | `hop_conversation_summary` |
| **M3 — inferred facts** | "hop noticed…" cards in the glass box (a cabin lean, who you travel with, places you gravitate to/from) you confirm or dismiss. Nothing is auto-applied. | `HOP_ENABLE_INFERRED_FACTS` | `hop_inferred_facts` |
| **M4 — observed outcomes** | A "Not for me" dismiss on concierge verdict cards; after a place recurs, a read-only "hop observed…" row + hop stops leading with it. | `HOP_ENABLE_OBSERVED_OUTCOMES` | `hop_memory_outcomes` |

M1 is already live (no flag). M2–M4 each need one migration + one flag.

## Invariants these hold (so enabling is safe)

- **No economics in memory.** Nothing here ever stores or asserts a cpp/price/miles/verdict.
  Every number stays engine-computed, live, at render time. M2's summary is scrubbed of
  figure-shaped tokens in code; M3/M4 tables have no economics column by design.
- **Nothing auto-applied.** Inferred facts (M3) land as *pending* suggestions you confirm.
  Observed outcomes (M4) shape prose + ordering only — they never change a verdict or a
  stated fact, and only surface after a signal *recurs* (never a one-off).
- **Reversible + visible.** Everything hop learns shows up in the `/account` glass box and
  can be forgotten/dismissed there.
- **Degrades to today.** Flag off → the exact current behavior. Flag on but table missing →
  `withDb` returns the fallback and it still no-ops (no crash). So the order below is safe
  even if you flip a flag before running its migration.

## Step 1 — run the migrations

These SQL files are **applied manually** (Supabase SQL editor or `psql`) — they are *not* in
the Drizzle journal, and `drizzle-kit migrate` is **not** the path here (the repo carries an
unrelated `0002_mighty_menace` in the journal). Run each file's contents once, in order:

- `drizzle/0002_conversation_summary.sql`  → `hop_conversation_summary`
- `drizzle/0003_inferred_facts.sql`        → `hop_inferred_facts`
- `drizzle/0004_memory_outcomes.sql`       → `hop_memory_outcomes`

Via `psql` (prefer the unpooled URL for DDL):

```bash
psql "$DATABASE_URL_UNPOOLED" -f drizzle/0002_conversation_summary.sql
psql "$DATABASE_URL_UNPOOLED" -f drizzle/0003_inferred_facts.sql
psql "$DATABASE_URL_UNPOOLED" -f drizzle/0004_memory_outcomes.sql
```

Or paste each file into the Supabase SQL editor and run it. Each is a plain
`CREATE TABLE … ` (+ an index); re-running is safe to avoid, but a failure just means the
table already exists.

## Step 2 — flip the flags (Vercel env → Production, then redeploy)

```
HOP_ENABLE_CONVO_MEMORY=1
HOP_ENABLE_INFERRED_FACTS=1
HOP_ENABLE_OBSERVED_OUTCOMES=1
```

- `HOP_ENABLE_CONVO_MEMORY` and `HOP_ENABLE_INFERRED_FACTS` also require `AI_GATEWAY_API_KEY`
  (already set — they use it to condense / infer). `HOP_ENABLE_OBSERVED_OUTCOMES` needs **no**
  key: its aggregator is pure deterministic code.
- Accepted truthy values: `1`, `true`, `yes` (case-insensitive). Anything else = off.
- Flags are read at call time (`lib/env.ts`), so a redeploy (or the next request on a fresh
  lambda) picks them up.

## Step 3 — verify

1. Sign in, open `/account` → the "What hop knows about you" glass box renders (M1).
2. In `/ask`, state a durable fact ("I fly business, love Lisbon, never suggest Cancun").
   It appears in the glass box tagged *you told me this* (M1 write path via `save_profile_fact`).
3. Chat a while about a cabin/travel-party/place pattern → a "hop noticed…" card appears in
   the glass box to confirm/dismiss (M3).
4. Dismiss the same destination's verdict card twice with "Not for me" → a "hop observed…"
   row appears and hop stops leading with it (M4).
5. Come back to a `/ask` thread later → hop still recalls the earlier gist (M2).

Roll back at any time by unsetting a flag (the table can stay — it just goes dormant).
