# Skill: opportunity alert (pattern → cpp)

Workflow #2 from the design doc — the flagship "we learned you fly Tokyo 3×/year → here's a 4.1¢/pt
window" message. Run per user on the daily scan (`schedules/daily-opportunity-scan.ts`). The output
is at most one or two real, high-value redemptions delivered by email — or, correctly, nothing.

## The rule that governs everything here

Every cpp, miles, and savings figure comes from the engine (`verdict` / `price_trip`). You decide
*which* candidates to price and *whether* to send; the engine decides every number and the threshold
math. Never invent a window, a value, or a pattern.

## Steps

1. **Load real signal.**
   - `balances` → the user's holdings + `totalPoints`. If they hold nothing, stop — there's no
     opportunity to compute against.
   - Travel patterns (phase 2, gated): if the patterns tool reports them, read `usualMonths`,
     `favoriteRegions`, `typicalCabin`. Until Gmail is verified and on, work from balances + the
     saved profile alone. Do not fabricate patterns.

2. **Build the candidate set** (a small union, deduped by destination code):
   - pattern routes — favorite regions in an upcoming `usualMonths` window (phase 2);
   - `affordableWith(totalPoints)` — destinations they can already book with points they hold;
   - `topValue(n)` — hop's highest-cpp sweet spots as a backstop.
   Keep it tight (≈8–12 candidates). The scan cost scales with candidates priced.

3. **Price each candidate through the engine.**
   - `price_trip(code, userId)` for the one-glance read; for a dated, route-level verdict use
     `verdict(from, to, depart, …, userId)`. If a section is `degraded`, treat that candidate's
     numbers as unavailable — never substitute a guess.

4. **Threshold — deterministic, the engine's line, not yours.**
   - Keep a candidate only when its engine cpp `≥ 2.5` (`POINTS_THRESHOLD_CPP`).
   - Tier `green` (cpp `≥ 3.0`) is a **"best find"** — lead with it.
   - Below 2.5 is a pay-cash verdict; never dress it up as an opportunity.

5. **Dedupe against what you've already sent.**
   - Read the per-user `eve.lastOpportunities` state (a `defineState` ledger of recent
     destination+fingerprint keys). Drop any candidate you've already delivered recently so the user
     isn't pinged about the same window twice.

6. **Pick the best 1–2 and deliver.**
   - Rank survivors by cpp; take the top one (two only if both are green and clearly distinct).
   - **Note:** a dedicated broad-opportunity email is a DEFERRED enhancement — main's sender
     (`lib/email.ts`, PR #59) is standing-order-shaped and email-only, keyed on a watch's
     `notifyEmail`. So record the opportunity as an alert (the same durable record a crossing
     produces) and deliver it through the same alert-shaped path:
     `deliver({ userId, to, alertId, route, pick, fingerprint })` — `to` is the user's notify
     email, `alertId` the recorded alert id, `fingerprint` the offer fingerprint; you pass NO
     numbers (the email reads them from `pick`). Then record the keys to `eve.lastOpportunities`.
   - **If nothing crossed, send nothing.** Silence is the correct output. Never send a "no
     opportunities today" digest or pad the message to feel productive.

## Copy

One opportunity, stated like a verdict: route, cabin, the program, miles + taxes, the cpp, and the
cash it beats — then the booking link. See `skills/copy-voice.md`. A green "best find" earns the one
warm line; everything else is just the answer and the number.
