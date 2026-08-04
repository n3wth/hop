# Apple-Music-grade design, translated through hop's constraints

Blueprint from a four-agent design panel (generated cover-art, shelf IA, motion
polish, contrarian critique) synthesized 2026-07-05. Written to be executed by
cheaper-model sessions phase by phase — each phase cites the exact primitives
so no re-research is needed. Read `docs/design/experience-heuristics.md` first;
nothing below overrides it.

## The governing thesis (contrarian's, ratified)

Apple Music's language solves "make an infinite catalog browsable." hop's
problem is the opposite: "make one computed answer feel trustworthy and
final." So we import three of Apple Music's **ideas** — generated visual
identity for photo-less abstractions, surfaces that respond to content,
shelf density for secondary options — but never its **vocabulary** (dark
chrome as default, saturated gradient-art, cover-carries-everything, kinetic
hover). The discipline that keeps a shelf honest: **a shelf earns its slot
only as a filtered/ranked lens onto engine output for THIS user — never a
static "things you might like" list.** Shelves feed the composer (each ends
in a scoped "Ask hop …" bridge), they never sit beside it as alternative
navigation. The AgentComposer stays the front door.

## Phase 1 — CoverArt system on /sweet-spots (small, static, ships visible)

`components/CoverArt.tsx`: pure-SVG, SSR-only, deterministic. No gradients —
depth via flat same-hue shapes at stepped opacities (100/55/30%), the
`Logo.tsx` carve trick for negative space. Closed palette, zero new hex:
field always `--color-brand-ink`; dominant arc = cpp tier via the existing
`CABIN_CHIP` mapping; secondary `--color-mint-bright` 55%; identity arc =
airline token (`--color-as/wn/ua/aa/ba`) else `--color-brand-muted`; gold
sliver (`--color-gold-soft`) only for First/Business. Shapes: 2–3 arcs from
the fixed rotation set `-14°,-6°,10°,22°,34°` (the bunny's cant angles),
chosen by djb2 hash of `seed` (`${programSlug}:${cabin}:${milesLabel}`) —
same seed, same cover, forever. Type: kicker 11px uppercase eyebrow; headline
Bricolage 700 over (never under) the arcs; stat in `.hop-price` mint-bright,
engine-computed only. `Logo` 24–28px bottom-right, carve = field, 60%.

Ship to: `/sweet-spots` index cards + `/sweet-spots/[program]` header (both
`force-static`; seeds known at build). Then reuse the geometry via `next/og`
`ImageResponse` (pattern: `lib/og.tsx`) as deal share images. Do NOT replace
DealCard's destination photography. "Collections" covers wait until a
collections surface exists.

## Phase 2 — Home→/search shared-element photo morph (high craft, now cheap)

Preconditions are already satisfied by the self-hosted photo manifest
(`lib/destination-photos.ts`, PR #190): both home showcase and `/search`
resolve the SAME deterministic file per destination — but verify by unifying
the two lookups on the manifest key (code), not two free-text queries, so the
morph never crossfades between different photos. Then wrap the home card
`<img>` and `/search`'s destination photo in `<ViewTransition
name={`photo-${code}`}>` (Next 16 App Router; `experimental.viewTransition`
already on; base root crossfade already in `globals.css:825+`). REQUIRED in
the same change: broaden the reduced-motion reset from
`::view-transition-old/new(root)` to `::view-transition-group(*),
::view-transition-old(*), ::view-transition-new(*)` (named transitions are
not caught by the root-only rule). Reference:
`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`.

## Phase 3 — Two shelves that are verdicts, not content

1. **Dream rotation**: upgrade the single LedgerDream card to a row of up to
   6 via `ledgerDream(balances, index)` over `reachableDreamCount`; first
   slot larger; each card shows `proof.path`. Empty → existing `saveToward`
   fallback as a 1-wide row.
2. **Unlocked by transfer**: destinations where the direct balance falls
   short but `effectiveBalanceFor(d.bestProgram, balances)` clears
   `typicalAwardMiles` via a transfer edge; `DestinationCard` + a via-badge
   from `EffectiveBalance.via`; omit when empty; exclude overlap with
   "Within reach". Bridge chip: "Ask hop which of these use a transfer".

Rules: "Within reach" stays ONE row — it must never fork into region/cabin
sub-rows (that is the catalog tipping point). Zero-watch/zero-data shelves
omit entirely — no filler cards ({ok:false}-style degradation at shelf
granularity).

## Phase 4 — Live-value surfaces (ships dark until data matures)

1. **"Your points, priced live" shelf**: `getLiveValuations()` ∩ user
   balances, `isLive` only, ranked by `(live − baseline)` delta; stat cards
   ("3.8¢/pt · was 3.1¢ baseline · 24 live bookings"). Omit until a program
   crosses the 20-sample threshold (none have yet — observations began
   2026-07-05; check the D1 `valuation_snapshot`).
2. **Crossfade on value delta** (motion #2): reuse the ShowcaseRotator
   opacity idiom, triggered ONLY when a rendered cpp/price actually differs
   from the previous value (valuation-sync cron, threshold crossings) —
   never a timer, never on re-render.
3. **Verdict-tinted ambient wash** (critic #2): let the hero wash lean
   toward the tier tokens (`--color-good`/`--color-weak`) with the verdict,
   inside heuristics #8's alpha/radial constraints. Smallest item; taste
   gate with Oliver before shipping.

## Doc-only now (fold into experience-heuristics.md when Phase 1 lands)

- CountUp replay keying: key to the query identity that produced the number
  (search params), never component mount — numbers never re-count on
  revisits.
- Shelf discipline rule (the bolded thesis line above).
- Named-view-transition reduced-motion reset requirement.

## Explicitly rejected (do not revisit without new evidence)

Dark chrome as default; gradient-geometry as decoration; entrance stagger
resurrection (`.hop-rise` was made inert on purpose — globals.css:259);
persistent "verdict tray" mini-player (no real state to pin; /search is
URL-stateless); multi-row genre-style catalog structure; hover/momentum
kinetics (hard rule).

Panel reports live in the 2026-07-05 session transcript; this file is the
durable synthesis.
