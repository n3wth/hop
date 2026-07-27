# National-grade design & UX — the elevation program

> Plan. Status: **in execution.** TL;DR: take hop from "clean" to "a tool designed for
> millions that's genuinely fun to use" — one enforced visual language, one signature
> moment, craft details everywhere — via a sequential PR train, each reviewed before merge.

The bar (set by the owner): hyper-critical; Mobbin/Awwwards-level; fun to use; feels like a
national-scale product. Everything holds the flat-editorial law (no shadows/gradients/glows,
tokens only, WCAG AA, transform-only reduced-motion-safe motion) — the law is the brand, not
the ceiling.

Derived from a three-lens critique (icon audit · visual-language consistency · Awwwards gap),
consolidated by a judge pass. The full rules canon lives in `docs/design/DESIGN-SYSTEM.md`
(updated per-PR, same-diff rule).

## The five taste calls — DECIDED

1. **Lightbulb means AI memory/insight, only.** "hop noticed" keeps it; everything else loses
   it. The Ask tab gets a chat glyph (`chat` = ChatCircle — a conversation, not a "send").
   Rationale: an idea-bulb IS the memory metaphor; six meanings = zero meanings.
2. **DegradedNote uses `warning`.** Honesty is hop's product thesis — a failed source is a
   heads-up, not a neutral fact. Calm styling, truthful glyph. Bell stays watch-only.
3. **The ink-outline button is CANONIZED as the `ink` tier.** It sits on the most-clicked
   button in the app (ResultRow booking CTA) and has real editorial presence. Documented as
   the fourth tier, `var(--radius)`, never improvised.
4. **Composer submit = circular icon button with `paper_plane`.** Chat surfaces follow chat
   conventions — that's what "native" means. One composer instance (empty + thread) → one
   affordance. Never the airplane (flight = flight content only).
5. **Fraunces earns its keep: ONE italic accent word per surface** ("dream", "worth",
   "next?"). The restrained personality move — this is where "fun" lives in the type system.

## The PR train (sequential; each: implement → review swarm → green deploy → merge)

| # | Package | Size | Status |
|---|---------|------|--------|
| A1 | Icon system: 12/16/20/24 compile-enforced scale, regular-default weight, semantics table (retry→refresh, house→Home, warning→degraded, envelope→Gmail, one-concept-one-glyph) | M | **in flight** |
| A2 | Signature & craft: the verdict reveal (staged entrance, CountUp from 0, bunny leap synced to count-up on a points win), `.hop-img-zoom` + arrow-nudge primitives, `::selection` + scrollbar, `.hop-photo` one-grade treatment | M | next |
| A3 | Button consolidation: every button through `<Button>` (primary/secondary/ghost/**ink**, sm/md/lg, onDark scheme); reviewer grep for raw `bg-brand px-` | L | queued |
| A4 | Chip + TierChip + card anatomy: one `<Chip>`, one `<TierChip>` owning tier→color, bg-paper card canon, hover:border-brand | M | queued |
| A5 | Radius/tracking/gap snap: `--radius-sm`, three tracking tokens, kill arbitrary gaps | M | queued |
| A6 | DestinationCard merge + composer convergence + SectionHead adoption | M | queued |
| A7 | Typographic rhythm on the signed-in home: total-points to display scale, LedgerDream breakout, Fraunces accents per taste call 5 | M | queued |
| A8 | DESIGN-SYSTEM.md reconciliation + CLAUDE.md same-diff rule + reviewer checks | S | last |

Interleaved (separate track): monetization Phase 1 (from the plan-panel blueprint) with
revenue instrumentation — the "self-aware growth" loop.

## Why this order
Icons first (the loudest "uncareful" signal, already running). Signature & craft second —
it's the most *feelable* change (the fun) and independent of the consolidation work. Then the
mechanical consolidations (buttons → chips/cards → radius/tracking → merges), which shrink
every future diff. Type rhythm near the end (it reads best on top of consistent primitives).
Docs last, folding in everything.

## Definition of done (per PR and overall)
- tsc/lint/vitest/build clean; adversarial review swarm with 0 surviving P1/P2.
- No flat-law violation, no WCAG regression, no engine-number invariant touched.
- DESIGN-SYSTEM.md updated in the same diff when primitives/tokens change.
- Overall: a stranger's first session feels considered at every step — loading, empty,
  error, hover, press, reveal — and the verdict moment is unmistakably hop's.
