# 0002. The engine is the source of truth; LLMs only narrate

Status: Accepted
Date: 2026-06-30

## Context

hop's product is a *verdict*: book with points, transfer partners, or pay cash — and the number
behind it (cpp, miles, taxes, dollars saved). That verdict is the moat. The moment an economic
figure is invented or rounded by a language model, the product is no longer trustworthy: a
hallucinated "~45k miles at 4.1cpp" reads identical to a real one and a user books on it.

Every economic figure already comes from one place. `lib/search.ts#assembleSearch` is the single
funnel: it fans out to upstream sources, computes per-option economics, ranks, picks, and renders
the verdict + summary. The arithmetic lives in `lib/cpp.ts` — `cpp = (cash − taxes) × 100 / miles`,
tiers `≥3.0 green` / `≥1.5 amber` / else muted, and `POINTS_THRESHOLD_CPP = 2.5` as the
`use-points` line. The in-app concierge already honors this: it ignores model-emitted numbers and
reconciles from engine output (`reconcileEconomics`).

Adding Eve (an always-on LLM agent across email, web, Slack) multiplies the surfaces where a model
touches a number. Without an explicit, enforced rule, the invariant erodes one prompt at a time.

## Decision

**`lib/*` deterministic code computes every economic number. An LLM may only NARRATE numbers the
engine produced — it must never compute, estimate, round into a different value, or free-text a
figure that did not come from an engine call.** Verdict = engine; narration = model.

This is structural, not advisory:

- **Eve tools wrap the engine and return its output verbatim.** `eve/tools/verdict.ts` returns
  `assembleSearch`'s `verdict`/`pick`/`summary`/`options`/`degraded` unchanged; its description
  instructs the model to *always call it before stating any verdict, cpp, miles, or savings number
  — never invent them.* `price-trip.ts` and `balances.ts` follow the same shape.
- **Alert/email copy is deterministic.** `lib/email.ts#renderAlertEmail` invents no numbers:
  route, cpp, miles, taxes all come straight from the engine's `FlightOption`. When Eve later
  narrates around an alert, it composes prose *around* these values, never producing them.
- **Degraded sections are surfaced, not papered over.** `assembleSearch` never throws; upstream
  failures land in `degraded[]` (`'cash'`/`'awards'`/`'balances'`). A narrator handed a degraded
  result must say so plainly (the UI uses `DegradedNote`), not fill the gap with an invented figure.

## Consequences

- **The model's job shrinks to language.** Eve and the concierge phrase, prioritize, and explain;
  they never do math. This is what makes a proactive agent safe to point at real balances.
- **Constants live in exactly one place.** `POINTS_THRESHOLD_CPP`, the tier cutoffs, and the cpp
  formula are defined in `lib/cpp.ts` / `lib/search.ts` and referenced everywhere else. Hardcoding
  `2.5`/`3.0`/`1.5` or re-deriving cpp anywhere else is a regression.
- **A dedicated reviewer enforces it.** `.claude/agents/engine-invariant-reviewer.md` is invoked
  on any change that surfaces an economic figure (concierge, a2ui, MCP tools, Eve tools, email
  templates). It flags P1 when an LLM emits or computes a number not sourced from an engine call,
  when a verdict is rendered while its section is in `degraded[]`, or when a threshold/formula is
  re-implemented outside the engine.
- **Adding a surface is cheap and safe.** Any new channel (Slack, Discord, web push) inherits the
  guarantee for free as long as it routes numbers through an engine-wrapping tool. The rule, not
  the surface, is what we maintain.
