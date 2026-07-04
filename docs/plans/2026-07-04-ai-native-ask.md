# 2026-07-04 — AI-native /ask: the engine visible, the verdict structured, the actions attached

> Plan. Status: proposal.
> TL;DR: /ask today renders engine work as invisible prose — a markdown wall with detached
> chrome (floating "Have hop book it" row, static chips) and fake-precise numbers when no tool
> ran. Make the surface AI-native: stream the engine's tool steps inline, render verdicts as
> structured cards fed only by tool payloads, attach actions to the message they belong to,
> derive next-step chips from the last tool result, and force ungrounded answers to speak in
> the curated dataset's honest ranges.

## 1. Requirements (done means)

- [ ] **A1 — the engine is visible.** While the concierge works, the stream shows grouped tool
  steps inline ("award space · seats.aero ✓ · cash · Duffel ✓ · your balances ✓"), building on
  the shipped grouped-tool-steps work (docs/plans/2026-07-02-ask-source-citations-and-tool-steps.md).
  A failed upstream renders a degraded row in-thread, DegradedNote-style — never silence.
- [ ] **A2 — verdicts are cards, not paragraphs.** When `priceTrip`/`verdict` returns, the
  message renders a structured mini verdict card (pick, cpp chip in tier color, miles vs cash,
  $ saved) built from the tool-result payload. Prose narrates around the card; it never restates
  numbers the card doesn't carry.
- [ ] **A3 — actions attach to their message.** "Have hop book it" / "Watch this route" /
  "Share" sit on the verdict card they refer to. The floating top-right action row is removed;
  "What hop remembers" and "Start over" move to the composer's overflow.
- [ ] **A4 — chips are contextual after the first exchange.** Next-step suggestions derive from
  the last tool result (after a sweet-spot answer: "Pull live dates", "Can my Amex MR cover
  this?"). The static seed chips (docs/content-plan.md §5) remain only for the empty state.
- [ ] **A5 — no fake precision without a tool call.** Observed in prod: the model narrated the
  curated "US↔Asia Cathay First 70k (cash $4.5k–7k)" sweet spot as "$6,200" and "8.9¢/pt"
  with no engine call. Curated values must render as their honest ranges with a "pull live
  numbers" action; specific $/cpp figures in prose are only allowed when they appear in a tool
  payload in the same thread. Enforce in the system prompt AND as an engine-invariant-reviewer
  check.
- Non-goals: no new engine capability, no booking-flow changes, no memory-axis work, no
  redesign of the composer.

## 2. Files to touch

| Path | Change | New? |
|---|---|---|
| `components/concierge/VerdictCard.tsx` | structured verdict card fed by tool-result parts | yes |
| `components/Concierge.tsx` | render tool parts → steps/cards; remove floating action row; contextual chips state | no |
| `components/ai-elements/*` | reuse/extend tool + suggestion primitives | no |
| `app/api/concierge/route.ts` | emit tool-result display payloads + next-step chip suggestions as data parts; A5 prompt rule | no |
| `lib/concierge-tools.ts` | tool results carry display-ready computed fields (already engine-computed — expose, don't recompute) | no |
| `.claude/agents/engine-invariant-reviewer.md` | add the A5 check (prose numbers require same-thread tool payload) | no |

## 3. Engine hooks

`lib/concierge-tools.ts#priceTrip` (assembleSearch verdict), `verdict`, `sweet_spots`
(`lib/sweet-spots.ts` — ranges only), `getUserBalances`. **Every number on a card comes from a
tool payload; chips' text may be LLM-phrased but their actions are deterministic routes/tool
calls; no LLM number reaches prose without a payload source.**

## 4. Flags, degradation, tests, copy

- No new flags or env; the surface already exists. Streaming parts degrade to today's prose
  when a payload is absent (older conversations keep rendering).
- Tool failure → degraded row in-thread; card renders partial sections per-source exactly like
  `/search` does.
- Tests: card formatter is pure → vitest over payload fixtures (tiers, missing cash, missing
  awards, $0 saved); chip derivation pure-function tests; A5 prompt regression: fixture convo
  asserting curated answers keep ranges. `npm run check`, `npm run build`.
- Copy: terse, state the number and its source ("live" vs "curated range"); no bunny in
  cards; docs/design/copy-spec.md governs.

## 5. Risks & review hooks

- Risk: over-carding — short conversational answers must stay prose; cards only when a tool
  returned economics. Judge in review.
- Reviewers: engine-invariant-reviewer (A2/A5), copy-voice-reviewer (card + chip copy),
  nextjs16-reviewer (streaming data parts), degradation-reviewer (in-thread degraded rows).
