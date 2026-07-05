# Experience heuristics — what makes a hop surface feel designed

Hard rules distilled from live design review of the home hero (2026-07-04,
PR #185). The flat-editorial system (`CHOSEN-editorial.html`, CLAUDE.md
§Design) says what things look like; this file says how compositions behave.
Reviewers (`copy-voice-reviewer`, and any UI diff review) should treat a
violation as a P2 or higher.

North stars: **Airbnb** for imagery discipline (photography leads, labels in
plain text below the image, orderly grids, generous whitespace) and **Figma's
marketing site** for composition (one composed centerpiece beside confident
type — not scattered fragments).

## Composition

1. **Imagery is structural, never ornament.** Photos live in grid columns and
   in-flow rows. Absolutely-positioned decorative elements that float beside
   or behind a centered column are banned — three iterations of "floating
   postcards" all collided with the search pill at some width. If it can't be
   expressed as a flex/grid child, it doesn't ship.
2. **One composed object beats many fragments.** A single large photo with
   the product layered on it (verdict card on the hero showcase) reads as
   curated; four small scattered cards read as AI-generated filler.
3. **Text is never covered. By anything. At any width.** Labels may sit on a
   photo only over the standard legibility scrim, one label block per image,
   and no sibling element may intrude into a text box. If two cards overlap,
   the overlap must land on photo, never on caption — and prefer not
   overlapping at all.
4. **Whitespace scales with the viewport.** Fixed paddings tuned at 1440
   feel cramped at 1920. Hero bands get breakpoint-scaled vertical air
   (`pt-4 sm:pt-8 lg:pt-12`-style ramps), and edge-anchored layers use
   `clamp()` so wide screens don't open dead gutters.

## Motion

5. **Motion is content changing, not decoration moving.** Slow cross-fades
   that bring the next destination are alive; idle bobbing/floating loops are
   filler and read as AI-made. No continuous transform loops on decorative
   elements. (Existing rules stand: no hover movement, transform-only
   entrances, everything behind `prefers-reduced-motion`.)
6. **One clock per composed object.** When a photo and its caption/card
   rotate, they advance together on a single shared period — independently
   blinking parts break the "one object" illusion.

## Imagery & ambience

7. **Labels below the photo, in plain text** (Airbnb). Overlay only when the
   image is the whole card, and then per rule 3.
8. **Ambient color comes from real content.** The hero wash derives from the
   active photo's average color (`lib/images` blurhash → `color`), alpha
   ≈ 0.1–0.22 over cream, radial falloff well inside the edges. Never an
   arbitrary decorative gradient (the flat-editorial no-gradients rule still
   holds for chrome; photo-derived ambience under a photo-led section is the
   one sanctioned exception).
9. **Full-bleed layers never use `w-screen`** — 100vw includes the scrollbar
   and opens horizontal overflow. Use `inset-x-0` within the section and let
   radial falloff fake full-bleed. Negative-z layers require `isolate` on the
   section, or an ancestor background will paint over them.

## Copy in composition

10. **The subline is one line.** If supporting copy wraps at the hero
    measure, cut it (≤ ~45ch). One idea per line; the number does the
    selling (`copy-spec.md` still governs voice).

## Chrome

11. **Adjacent chrome shares one color system.** The masthead lockup matches
    the nav's bordered controls (`text2` borders/labels); brand color returns
    on hover/moments, not as a permanent third color in the bar.

## Process — how UI work gets verified here

12. **Screenshot-verify at 390, 768, 1360(+gate boundary), 1512, and 1920
    before showing anyone.** A layout only exists once it's been seen at real
    widths; every overlap bug this session shipped between screenshots, not
    between builds. Decorative layers are gated (`hidden min-[…]:block`) to
    the widths where they verifiably fit; phones get the in-flow equivalent.
13. **Engine numbers only, even in ornament.** Any figure a decorative
    surface shows (¢/pt, miles, "points win") is computed by `lib/*`
    (`computeCpp`, `POINTS_THRESHOLD_CPP`) — degrade to nothing rather than
    fake it.
14. **The math closes on screen.** Wherever cash, savings, and points appear
    together, a reader must be able to reconcile them from what's VISIBLE:
    cash − savings = the taxes/fees shown; savings ≈ miles × cpp; the route
    and cabin label match the economics (domestic numbers never wear a
    transpacific route; premium-cabin ¢/pt is always labeled `· business` /
    `· first`). One unexplained dollar reads as fabricated — the audience is
    people who check.
