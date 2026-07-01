# hop, the companion that grows with you — agentifying the whole site

> One definitive plan that merges the three winning angles — **proactive delivery**, **memory that compounds**, and **real actions via MCP** — into a single ordered roadmap. Every milestone respects hop's four load-bearing invariants:
> 1. **Computed, never generated.** cpp / verdict / miles / affordability come only from `lib/search.ts#assembleSearch` + `lib/cpp.ts`. Memory and MCP shape *prose and which thing to recompute*, never a number.
> 2. **Graceful degradation.** Every new `lib/*` resolver returns `{ok:false}` / `[]` / a fallback via `lib/supabase-helpers.ts#withDb` and never throws to a page.
> 3. **Your data, your token.** Auth0 `sub`-scoped in code; MCP reach only via the user's own `hop_` token / session.
> 4. **Flag-gated seams + flat-editorial bar.** New learning loops and MCP writes sit behind `HOP_ENABLE_*` flags and hold the no-shadow/no-gradient design + terse copy voice.

---

## Status (living)

The **memory spine is shipped** — all four axes are on `main`, flag-gated (dark):

- **M1 — glass box** ✅ (#76) — `/account` "What hop knows about you"; reversible stated facts.
- **M2 — durable conversation memory** ✅ (#86) — `hop_conversation_summary`, rolling summaries.
- **M3 — inferred facts** ✅ (#90) — `hop_inferred_facts`, "hop noticed…" confirm/dismiss.
- **M4 — observed outcomes** ✅ (#93) — `hop_memory_outcomes`, "Not for me" → "hop observed…".

To turn the spine on (migrations + flags + verification), see
[`docs/enabling-agentic-memory.md`](../enabling-agentic-memory.md).

**Next:** M5 (compounding everywhere — one `lib/memory-context.ts` resolver feeds home/deals),
then M6 (first real action — Add-to-Calendar / Watch-this).

---

## 1. Vision

Today hop answers one sharp question — *points or cash?* — brilliantly, but it has a goldfish memory and no hands. It remembers only what you literally typed into `save_profile_fact`, its 40-turn thread (`lib/conversations.ts`, `MAX_MESSAGES = 40`) silently rolls off, the Gmail learning seam is gated dark, and nothing it observes — a booked trip, an ignored standing-order alert, the fact you ask about Tokyo every session — ever feeds back into the next answer. And when hop reaches a verdict, all it can do is *tell* you; it can't put the trip on your calendar, draft the itinerary, or watch it for you without you wiring a form.

The "grows with you" hop does three things on **every surface** (`/`, `/ask`, `/search`, `/deals`, `/account`), not just `/ask`:

- **It anticipates** — the signed-in home (`SignedInHome`) opens about the trip you've been mulling; `/deals` leads with your regions; standing-order creation pre-seeds from what you actually book.
- **It remembers and compounds** — it learns along three axes (STATED / INFERRED / OBSERVED), folds all three into the same prompt the concierge already builds (`buildAgenticSystem`), and gets sharper every visit — transparently, in a **glass box** you can edit.
- **It acts** — with one tap and one confirmation it can *watch* (standing orders), *add-to-calendar* (Google Calendar MCP), *draft* an itinerary (Tripsy MCP), and *enrich* a trip's full cost (Expedia hotels MCP) — always proposing, never auto-committing money.

The compounding is the moat. A points optimizer that knows your balances is useful. One that also remembers you book business to Asia in spring, never to places you flagged avoid, only pulls the trigger above 2.8 cpp, and *can put the win on your calendar* — and tells you it knows — is the one you keep.

---

## 2. The agentic model

Three capability planes, each grounded in an existing seam:

### A. Proactive (push, not pull)
The Eve layer (`lib/notify`/`outbox`/`notification-prefs`, `eve/` runtime) + standing-order cron (`/api/cron/standing-orders`, `vercel.json` every 6h) already watch and alert. We extend *what* is worth surfacing (opportunity detection from balances + observed patterns) and *where* it lands (in-app card, email, calendar reminder) — never a number hop didn't compute live at fire time.

### B. Memory that compounds (the spine)
A single resolver, **`lib/memory-context.ts`**, becomes the one place every surface reads personalization from — mirroring how `lib/accounts.ts#getUserBalances` unified balances. It composes four sources, each tagged by provenance:

| Axis | Source today | New durable store |
|---|---|---|
| **STATED** | `travel_profile` jsonb on `hop_user_prefs` (`lib/travel-profile.ts`) — only writer is `save_profile_fact` | — (reuse) |
| **summary** | thread rolls off at 40 turns | `hop_conversation_summary` |
| **INFERRED** | nothing | `hop_inferred_facts` (confidence-scored, status: pending/confirmed/rejected) |
| **OBSERVED** | `hop_escalations`, `hop_standing_order_alerts` exist but never feed back | `hop_memory_outcomes` |

Hard line: **inferred + observed memory shapes PROSE and ordering only.** It can float a region up, lead with premium, *suggest* a watch threshold — but `validateProfile`-clamped stated facts are the only thing that ever becomes a "fact," and no memory source ever asserts a cpp/verdict. Clamp-on-read strips anything number-shaped from summaries so a poisoned row can't assert economics.

### C. Actions (hands, via connected MCP)
hop already *exposes* its engine as an MCP server (`app/api/[transport]/route.ts`). Now it *orchestrates* connected servers as a **client**, behind a uniform "propose → user confirms → do → record outcome" contract:

| Action | MCP server | Records to |
|---|---|---|
| Add win/trip to calendar | Google Calendar (`create_event`) | `hop_memory_outcomes` |
| Draft skeleton itinerary | Tripsy (`tripsy_trips_create`) | `hop_memory_outcomes` |
| Full-trip cost (flight + hotel) | Expedia (`search_hotels`) | informational only |
| Enrich profile from receipts | AgentMail/Gmail (`search_messages`) | proposes → `save_profile_fact` |

Every action: computed numbers stay hop-owned (never pushed into the calendar/Tripsy entry), no payment, user confirms each one, MCP-unavailable degrades to a copy-paste link or silence. **Outcomes close the loop** — a confirmed action is an OBSERVED fact that compounds back into B.

---

## 3. Prioritized roadmap (ordered by impact ÷ effort; earliest = highest leverage, lowest risk)

Sequencing rationale: **trust before learning before acting.** You can't ethically infer or observe until the user can *see and correct* what hop holds (M1). Durable context (M2) is the cheapest "it remembers me" win and unblocks the prompt slot everything else fills. Inference (M3) and outcomes (M4) are the compounding engine but carry creepiness/sparsity risk, so they ship only on top of the glass box that makes them reversible. Actions (M6–M7) are highest-ceiling but depend on memory to know *what* to act on, so they come once the spine exists. M5 and M8 are the "make it felt everywhere" payoffs.

### M1 — The glass box: "What hop knows about you" · `effort S · impact HIGH · risk LOW` → **FIRST PR**
- **Ships:** a new `/account` section rendering the user's existing `travel_profile` as plain, source-tagged, editable rows ("Vacation days: 25 · *you told me this*") each with confirm / edit / forget.
- **Capability:** pure read/edit projection — `lib/memory-view.ts` over `getProfile`; forget = `setProfile` minus a field; edit = `saveProfileFact`'s `validateProfile` path. **No new tables.**
- **Why it grows:** before hop learns anything new, you can see and correct what it remembers. The trust foundation every later memory milestone (M3/M4) requires — inference is only acceptable because it lands here as reversible "I noticed" rows.
- **Guardrail:** projects clamped facts only — never raw thread text. Grouped by life-area, not DB field; copy in `docs/design/copy-spec.md` voice.

### M2 — Durable thread memory: rolling summaries · `effort M · impact HIGH · risk LOW`
- **Ships:** `lib/conversation-memory.ts` + `hop_conversation_summary` (user_id unique, summary text, updated_at). When `saveConversation` crosses the 40-turn roll-off, the dropped turns are condensed offline (cheap Haiku call, constrained to durable human-readable context, *never new economics*) and injected by `buildAgenticSystem` as a "what you remember from earlier" block beside `profileSummary`.
- **Capability:** `lib/conversations.ts` roll-off point, the existing AI Gateway in `app/api/concierge`, `withDb`.
- **Why it grows:** resumed threads stop being amnesiac — come back a month later and hop still knows you're weighing Lisbon vs Tokyo and fly business. Most visceral "it remembers me" moment; directly fixes the survey's #1 gap.
- **Guardrail:** prose CONTEXT only, never written to `travel_profile`, numeric-stripped clamp-on-read, expires after N days inactivity, surfaced in the glass box as "I noticed" (confirmable). Flag `HOP_ENABLE_THREAD_MEMORY`; off → today exactly. Haiku failure → degrade to no summary, never block chat.

### M3 — Inferred preferences: hop proposes, you confirm · `effort M · impact HIGH · risk MED`
- **Ships:** `lib/inferred-facts.ts` + `hop_inferred_facts` (fact_type enum, value, confidence 1–10, evidence, status). A **pure, unit-tested** detector fires only on REPEATED discrete signals (same region in 3+ turns, premium cabin restated, a budget ceiling repeated) and emits a low-confidence fact with evidence. Surfaces two ways: glass-box "I noticed — is this right?" rows, and a `profile_confirm`-style a2ui block in `/ask`. Confirm promotes via `save_profile_fact`; reject tombstones so it won't re-propose.
- **Capability:** `lib/conversations.ts` thread, existing `profile_confirm` block + `validateBlock`/`personalizeBlocks` pipeline (`lib/a2ui.ts`), `buildAgenticSystem` injection, the M1 glass box.
- **Why it grows:** the heart of "grows with you" — hop starts noticing what you care about without a form, then *asks before acting*. Each confirmation compounds.
- **Guardrail:** never one-off, never sentiment ("you seem hesitant" is forbidden); always confidence-scored, confirmable, evidence-shown, never auto-promoted; the avoided-destinations guardrail always wins. Flag-gated; conservative thresholds favor missing an inference over inventing one.

### M4 — Observed outcomes: hop learns from what you DO · `effort L · impact HIGH · risk MED`
- **Ships:** `lib/memory-outcomes.ts` + `hop_memory_outcomes` recording only EXPLICIT discrete events: an escalation/booking captured (route + cabin from `hop_escalations` snapshot), a standing-order alert seen-but-not-acted after a window (`hop_standing_order_alerts`), a verdict_card explicitly dismissed via a new "not for me" tap. A pure aggregator derives human-readable observations ("you've booked business to Asia twice", "you pass on sub-2.6cpp alerts") → glass-box "I observed" rows + soft prompt context. Can *suggest* a standing-order `min_cpp` raise — never auto-edit, never change a verdict.
- **Capability:** existing escalation/alert tables, the `verdict_card` block (add a dismiss action), standing-orders surface, `withDb`, M1 glass box.
- **Why it grows:** closes the loop the survey flagged twice as the biggest miss. Once hop grades recommendations against what you actually book, picks and watch thresholds converge on the real you.
- **Guardrail:** observed events only — "dismissed card" is a fact, "didn't book because afraid" is forbidden. Minimum event count before an observation surfaces (else "no strong pattern yet"). All outcome→suggestion nudges advisory + user-confirmed.

### M5 — Compounding everywhere + resumed chips · `effort M · impact HIGH · risk MED`
- **Ships:** wire the now-rich memory into surfaces beyond `/ask`: `SignedInHome` opens with a memory-grounded, engine-computed line ("Still weighing Lisbon vs Tokyo? Lisbon's at 3.1cpp this week"); `/deals` orders by remembered regions/cabin; standing-order creation pre-seeds from observed routes. Resumed `/ask` threads rehydrate their last `prompt_chips`. `lib/memory-context.ts` becomes the single resolver every surface calls (the `getUserBalances` template).
- **Capability:** `buildAgenticSystem` injection, `SignedInHome`, `/deals` ordering, `lib/standing-orders` pre-seed, a2ui chip persistence.
- **Why it grows:** hop stops being a chat box that remembers and becomes a whole site that anticipates. Every prior milestone's learning pays off on every surface.
- **Guardrail:** every surfaced number is recomputed live by the engine (memory chooses *what* to recompute, never the value); facts carry recency and decay out of prompts when stale; one resolver = one graceful-degradation path → empty/unavailable memory falls back to today's generic behavior with zero breakage.

### M6 — First real action: "Add to calendar" + "Watch this" from any verdict · `effort M · impact HIGH · risk LOW`
- **Ships:** an a2ui action affordance on `verdict_card`/`compare`/standing-order alert: "Add to calendar" (Google Calendar `create_event` — date + route + notes, **no cpp/miles pushed**) and "Watch this" (pre-seed a standing order from the discussed route/cabin). Confirmed action → `hop_memory_outcomes` (M4 loop).
- **Capability:** Google Calendar MCP, existing `lib/standing-orders`, a2ui block + outcome recording.
- **Why it grows:** hop's first *hands*. The win you discovered becomes a thing on your calendar and a watch — and that action is itself an observed signal that sharpens future picks.
- **Guardrail:** user confirms each event; calendar event is a user-owned reminder with no hop dependency; computed numbers never leave hop's DB; MCP-unavailable → degrade to a copy-paste link.

### M7 — Draft the trip + full-trip cost · `effort M–L · impact MED–HIGH · risk MED`
- **Ships:** "Draft itinerary" (Tripsy `tripsy_trips_create` — skeleton: route + dates, user fills lodging/activities) and full-trip cost (Expedia `search_hotels` for depart ±2 nights rendered beside the flight verdict, informational only).
- **Capability:** Tripsy + Expedia MCP, the `compare` block layout.
- **Why it grows:** hop graduates from "where + points-or-cash" to "here's the whole trip, drafted." Tripsy spend read back later (hotels ran $4k) enriches `affordableWith` context.
- **Guardrail:** skeleton only, no booking, no payment; hotel data informational (user books in Expedia); hop computes flight cpp, never an invented hotel cpp; either MCP down → flight verdict stands alone, no error.

### M8 — Proactive opportunity engine + analytics-tuned delivery · `effort M · impact MED · risk MED`
- **Ships:** Eve detects opportunities *outside* explicit standing orders (balances + observed regions → "your United is 12k from NRT business at 3.1cpp") and delivers via the right channel (in-app / email / calendar reminder). PostHog (`exec`) segments which nudges convert to tune frequency and copy — batch, reviewed, never real-time model changes.
- **Capability:** Eve runtime + `lib/notify`/`outbox`, the M4 observed loop, PostHog MCP.
- **Why it grows:** hop reaches out *before* you ask, about the trip it knows you want, at a number it computes live — the fullest expression of a companion.
- **Guardrail:** every alert recomputes its number live at fire time; PostHog receives only `{event, route, program, cpp_band, ts}` — no balances/email/IP; opportunity cadence respects `notification-prefs`; all delivery flag-gated.

---

## 4. How each step makes hop grow-with-you

- **M1** turns the profile from a form into "here's what I know about you" — and makes everything after it reversible, so hop earns the right to infer.
- **M2** makes hop *remember the conversation* past a session — the first felt "it knows me."
- **M3 + M4** are the compounding engine: hop notices (stated→inferred) and grades itself (observed), and every confirmation/booking makes the next pick pre-fit you.
- **M5** spreads that learning to every surface, so the *whole site* anticipates.
- **M6 + M7** give hop hands, and each action feeds M4 — doing things makes hop learn faster.
- **M8** closes proactivity: hop reaches out about the trip it learned you want, computed live.

Each milestone both *uses* the prior milestones' learning and *produces* new signal for the next — that feedback loop is the "grows with you" moat.

---

## Sequencing rationale

Order is trust → durable context → compounding learning → reach everywhere → hands → proactive outreach, ranked by impact ÷ effort with earliest = lowest risk. M1 (glass box) is first because it is pure read/edit projection over memory hop already holds (no new tables, no economics, lowest risk) AND it is the ethical precondition for everything after: hop may only infer (M3) or observe (M4) once the user can see and reverse what it holds, and those inferred/observed facts land as new source-tagged rows in the very surface M1 builds. M2 (rolling summaries) is the cheapest high-impact 'it remembers me' win and creates the prompt slot M3/M4/M5 all fill, so it precedes them. M3 (inference) and M4 (outcomes) are the compounding engine but carry creepiness/sparsity risk, so they ship on top of M1's reversible glass box and M2's prompt slot. M5 spreads the now-rich memory to every surface via one resolver (the getUserBalances pattern). M6–M7 add hands (calendar/watch, then draft/hotels) once memory knows what to act on, and each action feeds M4's observed loop. M8 (proactive opportunity engine) comes last because it depends on observed patterns (M4) and the memory resolver (M5) to reach out about the right trip at a live-computed number. Each milestone consumes prior learning and emits new signal for the next — that loop is the moat. The recommended first PR is M1, fully specified in firstPr."

---

## First PR (shipped as M1)

**M1 — The glass box: a 'What hop knows about you' section on /account**

Build a transparent, editable surface that renders the memory hop ALREADY holds — pure read/edit projection over the existing travel_profile jsonb on hop_user_prefs, with NO new tables and NO new economics. This is the trust foundation every later memory milestone depends on, and it ships visibly more agentic behavior today.

Approach:
1. New pure module lib/memory-view.ts. Export type MemoryFact = { id: string; kind: 'vacationDays'|'travelParty'|'cabin'|'dietary'|'accessibility'|'lovedDestinations'|'avoidedDestinations'|'airlineStatuses'; group: 'rhythm'|'style'|'places'|'status'; label: string; value: string; source: 'stated'; editable: true }. Export projectProfile(profile: TravelProfile): MemoryFact[] that flattens the TravelProfile (from lib/travel-profile-model.ts) into source-tagged rows, grouped by life-area not DB field (e.g. vacationDays+travelParty -> 'rhythm'; cabin+dietary+accessibility -> 'style'; loved/avoided -> 'places'; airlineStatuses -> 'status'). One row per list ENTRY for lists (each loved place is its own forgettable row). Pure + total; empty profile -> []. This is the seam M2/M3/M4 later extend to add source:'noticed'|'observed' rows — keep the shape forward-compatible.
2. Server actions in a new app/account/memory-actions.ts ('use server'): forgetFact(kind, value?) -> reads getProfile, removes that field (or that single list entry), calls setProfile with the result; editFact(patch) -> validates via saveProfileFact's path. Both auth0-guarded (resolve sub; bail to no-op if signed out) and withDb-graceful (already inherited from setProfile/getProfile). revalidatePath('/account') after a successful write.
3. New client component components/MemoryKnows.tsx: renders the grouped MemoryFact[] as flat-editorial rows, each '<label>: <value> · you told me this' with confirm (no-op acknowledge) / edit (inline) / forget (calls the server action). Use existing tokens from app/globals.css and mirror the ProgramsManager/AirlineStatusManager visual pattern already on the page. No shadows/gradients. Empty state in copy-spec voice ('hop hasn't learned anything durable about you yet — tell it in /ask and it'll remember here.').
4. Wire into app/account/page.tsx: add a new <section id="knows"> near the top (the page already computes `profile` via getProfile at line ~115 and renders <section> blocks with <h2> headers), passing projectProfile(profile) to <MemoryKnows/>. Reuse the existing <h2 className="font-display ..."> header style.
5. Add lib/__tests__/memory-view.test.ts: projectProfile is pure -> assert grouping, one-row-per-list-entry, empty -> [], source always 'stated', and that an unknown/garbage profile (post-validateProfile) yields no rows. Keep under lib/**/*.test.ts so vitest collects it.

Invariant adherence: no LLM, no computed economics (cpp/verdict never appear here), withDb-graceful inherited, Auth0 sub-scoped, no new table/migration, flat-editorial design, copy-spec voice. Forget/edit go through the SAME validateProfile clamp that save_profile_fact uses, so a hand-edit can't poison the prompt.

Files: `lib/memory-view.ts`, `lib/__tests__/memory-view.test.ts`, `app/account/memory-actions.ts`, `components/MemoryKnows.tsx`, `app/account/page.tsx`

Verify: npx vitest run lib/__tests__/memory-view.test.ts (projectProfile grouping / one-row-per-entry / empty / clamp). npx tsc --noEmit and npm run lint clean. npm run build to catch RSC/server-action wiring. Manual: MOCK=1 npm run dev, sign in, /ask -> state durable facts (e.g. 'I have 25 vacation days, I fly business, I love Lisbon, never suggest Cancun') so save_profile_fact persists them, then open /account and confirm the new 'What hop knows about you' section shows grouped rows each tagged 'you told me this'; tap forget on the Lisbon row and confirm it disappears after revalidate and is gone from the travel_profile (re-open /ask and confirm hop no longer cites it). Confirm a signed-out visit and an empty profile both render the graceful empty state, not a crash.
