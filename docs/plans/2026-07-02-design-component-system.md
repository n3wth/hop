# Design system / component layer — primitives that make new surfaces compose, not re-derive

> Plan. Status: proposal.
> TL;DR: eight small PRs turn hop's proven class recipes into ~8 server-renderable primitives
> under `components/ui/`, each PR proven by named call-site migrations and locked by a
> warn→error ESLint ladder plus reviewer greps — engine numbers get dedicated display primitives
> (`TierChip`, `Stat`) so "computed, never generated" becomes compile-shaped, and
> `docs/design/DESIGN-SYSTEM.md` flips from class-recipe cookbook to primitive API index.

**Owner's words:** "visually enhance. and create design system/component system that can help
site to scale more quickly."

**Lens: the engine seam.** Every number the UI shows is born in `lib/*` —
`assembleSearch` → `SearchResult.summary`/`options[].cpp`, `getUserBalances` → `Balance[]`,
`tier()`/`formatValue()`. Today those numbers cross into JSX through hand-rolled markup. The
verified census (2026-07-02; **re-grep before each PR — the A-train moves these counts**):

- **Tier→color mapping is duplicated seven times**: class maps at `components/ResultRow.tsx:24`
  (plus its `BAR` map at `:29`) and `components/landing/DestinationGrid.tsx:10`; style-object
  maps at `components/DealCard.tsx:23`, `app/destinations/DestinationGuideCard.tsx:11`,
  `app/points/[amount]/page.tsx:45`; an inline `bg-good-bg text-good` status chip at
  `components/LedgerDreamCard.tsx:261`; and a prose copy in `DESIGN-SYSTEM.md` §Value chips
  (`:294`, snippet `:298–304`).
- **The ink-outline CTA is hand-rolled five times with three radii**:
  `components/checkout/CheckoutForm.tsx:416` (`rounded-[9px]`), `components/ResultRow.tsx:306`,
  `app/book/page.tsx:186`, `app/book/confirmation/page.tsx:65` (all `rounded-[11px]`),
  `components/EmptyState.tsx:41` (`rounded-[12px]`); `components/ResultsSkeleton.tsx:48`
  mirrors the shape.
- Card recipes: `border border-border bg-paper` **46 hits / 29 files**;
  `border border-border bg-surface` **71 / 32**. `rounded-[12px]` **50 hits / 23 files**.
  Brand-solid buttons (`bg-brand px-`) **28**. Eyebrows (`uppercase tracking-`) **103**.
  **17 distinct** arbitrary `tracking-[…]` values. A private `Stat` at
  `components/RouteBar.tsx:19`. `toLocaleString('en-US')` money/points formatting hand-rolled
  in **8 lib files**.

The primitive layer is where the engine's output meets pixels — so the primitives that carry
engine numbers are designed first and made invariant-enforcing: `TierChip` takes the raw
computed cpp and derives color *internally* via `lib/cpp.ts#tier`, so a call site **cannot**
pair a green chip with a weak number — the same mechanism as `Icon`'s compile-enforced
`12|16|20|24` size union. (`lib/search.ts:160/209` assigns `option.tier = tier(option.cpp)`,
so TierChip's internal derivation reproduces the engine's classification exactly.)

**Prior art honored (do not contradict):**

- `docs/plans/2026-07-02-design-national-grade.md` is **in execution** (A1 icons merged as
  #112; A2 "signature & craft" is next in the train — check `git log` before starting). This
  plan is the executable blueprint for its queued packages **A3 (buttons), A4 (chip/card),
  A5 (radius/tracking tokens), A6 (SectionHead adoption), A8 (docs reconciliation)** plus the
  primitives the train didn't name (Field/Input, Stat, EmptyState/DegradedNote fold-in). PRs
  here sequence *after* A2, never concurrently on shared files (`ResultRow`, `SignedInHome`).
  The train's taste calls (ink canonized, `warning` glyph on degraded) are settled.
- `components/ui/Button.tsx` already exists (primary/secondary, Link/native-anchor/button
  polymorphism, focus-visible, **no `'use client'`**) — extend it, don't re-create it.
- `components/Icon.tsx` proves the house pattern: server-safe, compile-enforced prop unions.
  `components/Sheet.tsx` is the one sanctioned client primitive.
- `docs/agent-playbook.md` §6: the codebase is a cost surface; shrink-as-you-go; §7: no
  multi-surface refactor sweeps alongside feature work. But §6 also says **"consolidate when
  you see a twin"** — deleting one duplicated recipe across its handful of twin files is
  consolidation, not a sweep. Each primitive lands with its proof migrations; everything else
  converts opportunistically when touched.
- Framework ground truth read:
  `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  and `11-css.md` — primitives are plain sync function components with no hooks/handlers, so
  they render in RSC and inherit interactivity from parent client components; only `Sheet`
  keeps `'use client'`.
- **Focus reality** (correcting an earlier draft): `app/globals.css:181` already applies a
  global `:focus-visible` ring to `:where(a, button, input, select, textarea, [tabindex])`,
  with `.no-inner-ring` (`:189`) as the sanctioned opt-out for container-focused fields. The
  7 explicit `focus-visible:` occurrences in 3 files (`ui/Button`, `Sheet`, `EscalationCTA`)
  are belt-and-braces where `outline-none` exists. The rule is therefore **"never suppress the
  global ring"**, not "add focus-visible everywhere". `outline-none` appears in **14 files** —
  that's the audit surface.

## 1. Requirements

Done means:

- [ ] `components/ui/` contains the full primitive set, all server-renderable (zero
  `'use client'` except the existing `Sheet`): **Button** (primary / secondary / ghost /
  **ink** × sm/md/lg × `onDark` × typed `iconOnly`-requires-`aria-label`), **TierChip**,
  **Chip**, **Card**, **Eyebrow**, **Stat**, **Field/Input/Textarea/Select**. Existing `Icon`,
  `Sheet`, `DegradedNote`, `EmptyState`, `SectionHead` fold into the documented set
  **in place** (no move-only diffs — `SectionHead` keeps its path).
- [ ] API shape is **plain props + `Record<Variant, string>` class maps of complete literal
  Tailwind strings** — the existing `Button.tsx` idiom. No cva/clsx/tailwind-merge dependency:
  hop has none today, Tailwind v4's static extraction requires whole class strings anyway, and
  a `Record` keyed by a TS union gives cva's exhaustiveness for free, RSC-safe.
- [ ] **`components/ui/TierChip.tsx` is the only file that maps `CppTier → color tokens`.**
  All seven census sites above are deleted or rerouted in PR 3 (the style-object twins compose
  from TierChip's exported `TIER_CLASS`/`TIER_WORD`/`TIER_BAR` maps; the LedgerDreamCard
  status chip moves to `Chip` because "held directly" is a status, not a cpp tier — the
  good/ok/weak tokens stay reserved for cpp classification, per `DegradedNote`'s comment).
- [ ] Missing tokens land: `--radius-sm: 10px`; `--track-eyebrow` / `--track-label` /
  `--track-tag` — the playbook §3 names these as canon but they are **not in
  `app/globals.css` yet** (verified). Token names deliberately use `--track-*`, **not**
  Tailwind's `--tracking-*` namespace, so the 7 existing stock `tracking-wide`/`tracking-tight`
  uses are untouched — with a comment in `@theme` saying why.
- [ ] Each primitive PR ships with its named call-site migrations, a grep check appended to
  `.claude/agents/copy-voice-reviewer.md`, **and its ESLint `no-restricted-syntax` rule at
  `'warn'`** (scoped `app/**` + `components/**`, `ignores: ['components/ui/**']`). A rule
  flips to `'error'` per-recipe only when that recipe's census grep hits zero — never a
  big-bang error switch. The warn counts are the `/audit` burn-down signal.
- [ ] `docs/design/DESIGN-SYSTEM.md` "Component Patterns" (§Cards `:284`, §Value chips `:294`,
  §Eyebrow labels `:309`, §CTA buttons `:319`) is rewritten as a **Primitives index**
  (import path · props · when to use · "hand-rolling this recipe is a defect") — the single
  source of truth an agent reads instead of grepping 30 files.
- [ ] Visual-enhancement pass on migrated surfaces: hover = color-only (plus the two
  sanctioned micro-moves from A2 — image zoom-in-frame, arrow nudge — composed *through*
  Button/Card, never re-implemented); the global focus ring never suppressed except via
  `.no-inner-ring`; tracking snapped to the three tokens; radii snapped to the four-step scale.
- [ ] `npm run check` and `npm run build` green after every PR; `scripts/shoot.sh`
  before/after shots for each migrated route.

Non-goals (deliberate):

- **No big-bang sweep.** Un-migrated call sites keep working; conversion is opportunistic
  (shrink-as-you-go) except the named proof sets and the single-recipe twin consolidations
  (ink ×5, tier maps ×7) — each of those is one recipe, not a surface refactor.
- **No file moves** of existing primitives (`Icon`, `Sheet`, `SectionHead`, `EmptyState`,
  `DegradedNote` keep their paths) — the index documents location; churn costs tokens.
- **No new visual language.** Every variant is an existing, shipped recipe canonized.
- **No `PricePair` until the rule of three proves it** — `Stat` lands first; `PricePair` only
  if ≥3 call sites (VerdictRail, SampleVerdict, A2UIBlock, DealCard, points/[amount]) migrate
  to one shape cleanly. Decision recorded back into this plan (taste-call protocol, playbook §4).
- **No custom listbox.** `Select` ships the existing `appearance-none` + drawn-caret pattern
  (`CheckoutForm.tsx:802`) as-is.
- **No touching `SearchBar.tsx` (~1100 lines) as a sweep** — its buttons/fields migrate only
  when that file is opened for other work (playbook §6/§7).
- **Checkout rule:** `components/checkout/*` migrations are **class-strings only**, mandatory
  before/after `/book` shots, stop-and-replan if any diff touches behavior — payments never
  change behavior in a design PR.
- No Storybook/docs-site tooling; `DESIGN-SYSTEM.md` + `CHOSEN-editorial.html` remain the
  reference.

## 2. Files to touch

| path | change | new? |
|---|---|---|
| `app/globals.css` | add to `@theme`: `--radius-sm: 10px`; `--track-eyebrow`/`--track-label`/`--track-tag` (values per role census, defaults `0.12em`/`0.06em`/`0.10em` — see PR 1) + the namespace comment | no |
| `components/ui/Button.tsx` | add `ghost` + `ink` variants, `size: 'sm'\|'md'\|'lg'` (default `md`), `onDark?: boolean` (hero scheme via `--color-hero-*` tokens), typed `iconOnly` discriminant requiring `aria-label`; keep polymorphism | no |
| `components/ui/TierChip.tsx` | new — cpp chip; `{ cpp: number; className?: string }`, derives tier/label/aria internally, `null` for non-finite cpp; exports `TIER_CLASS`, `TIER_WORD`, `TIER_BAR` for the rich-composition sites | yes |
| `components/ui/Chip.tsx` | new — neutral/brand meta chip (program badges, cabin chips, filters, status like "held directly") | yes |
| `components/ui/Card.tsx` | new — `surface: 'paper'\|'surface'\|'sunk'`, `radius: 'md'\|'lg'`, `interactive?` (`hover:border-brand`), `as?: 'div'\|'section'\|'article'\|'li'`; no header/footer slots | yes |
| `components/ui/Eyebrow.tsx` | new — uppercase tracked label, `onDark?` | yes |
| `components/ui/Stat.tsx` | new — mono value + caption (`size`, `align`, `onDark`); `PricePair` added here **only if** rule-of-three passes | yes |
| `components/ui/Field.tsx` | new — `Field` (label + control + hint/error slot, `htmlFor`/`id` wired), `Input`, `Textarea`, `Select` styled wrappers forwarding native props; focus = `focus:border-brand` with ring suppression only via the sanctioned `.no-inner-ring` pattern | yes |
| `components/SectionHead.tsx` | gains optional `eyebrow?: string` (renders `Eyebrow` above the title); stays at its path | no |
| `lib/format.ts` | new, **severable** — `formatUSD(n)`, `formatPoints(n)` consolidating the `toLocaleString('en-US')` idiom in `lib/dream-narration.ts:15`, `lib/points-bands.ts:37`, `lib/card-affiliates.ts:50/52`, `lib/counterfactual.ts:190/193`, `lib/place-info.ts:28`, `lib/concierge-hero.ts:63`, `lib/email.ts:99` (one source of truth per fact, playbook §6) | yes |
| `components/ResultRow.tsx` | `:306` booking CTA → `<Button variant="ink" fullWidth>`; `:24` CHIP + `:29` BAR maps deleted → `TierChip` / exported maps | no |
| `components/EmptyState.tsx` | `:41` "Adjust your search" → `<Button variant="ink" href>` | no |
| `components/checkout/CheckoutForm.tsx` | `:416` ink button (PR 2), one `Field` (PR 6), one `Stat` total (PR 5) — class-strings only, three separate single-recipe slices of an 817-line hot file | no |
| `app/book/page.tsx`, `app/book/confirmation/page.tsx` | `:186` / `:65` ink CTAs → `<Button variant="ink">` | no |
| `components/DealCard.tsx` | `:23` CHIP style-object map deleted → `TierChip` + exported maps | no |
| `app/destinations/DestinationGuideCard.tsx` | `:11` CHIP map deleted → `TierChip` (its `formatValue — TIER_WORD` aria pattern is absorbed into TierChip) | no |
| `components/landing/DestinationGrid.tsx` | `:10` TIER_CHIP map deleted → `TierChip` | no |
| `app/points/[amount]/page.tsx` | `:45` TIER_CHIP map deleted → `TierChip` | no |
| `components/LedgerDreamCard.tsx` | `:261` status chip → `<Chip tone="brand">` (status, not cpp tier) | no |
| `components/RouteBar.tsx` | `:19` private `Stat` deleted → `components/ui/Stat` | no |
| `components/landing/SignedInHome.tsx` | proof migrations: 2 cards + eyebrows + 1 stat (9 radius recipes today) | no |
| `components/concierge/A2UIBlock.tsx` | proof migrations: card + eyebrow + TierChip (13 `border border-border` recipes, 8 eyebrows today) | no |
| `components/ProgramsManager.tsx`, `components/HomeAirportPicker.tsx` | proof migrations for `Field`/`Input`/`Select` (canon inputs at ProgramsManager `:165`/`:346`, picker input `:83`) | no |
| `eslint.config.mjs` | per-primitive `no-restricted-syntax` blocks appended at `'warn'`, flipped to `'error'` per-recipe when census greps clean; `ignores: ['components/ui/**']` | no |
| `.claude/agents/copy-voice-reviewer.md` | append check #6 "hand-rolled primitive recipes" — one grep line per primitive PR, plus the `outline-none` rule (P2) and the literal-tier rule (P1) | no |
| `docs/design/DESIGN-SYSTEM.md` | rewrite §Component Patterns (`:282–338`) → Primitives index; delete the recipe prose at §Cards/§Value chips/§Eyebrow/§CTA buttons; fix `--ease-premium` drift (`:278` says `cubic-bezier(0.16, 1, 0.32, 1)`; `globals.css:72` says `cubic-bezier(0.2, 0, 0, 1)` — code wins); resolve the stale `:124–125` "text-* not yet wired" note after the PR 7 empirical check | no |
| `CLAUDE.md` | one added line under Design & copy: "New UI composes `components/ui/*` — a hand-rolled button/chip/card/field/stat recipe in a diff is a defect; index in DESIGN-SYSTEM.md" | no |
| `lib/__tests__/ui-primitives.test.ts` | new — node-env render tests + the variant-map meta-test (§7) | yes |
| `lib/__tests__/format.test.ts` | new — formatter tests | yes |

No `eve/*` changes. No migrations (`drizzle/*.sql`) — this feature has no persistence.

## 3. Engine hooks

The primitives are **render-only endpoints for engine output**; every economic number is
computed by `lib/*` and only *displayed* here — never derived, defaulted, or (via `/ask`)
LLM-invented.

| `lib/*` function | returns | consumed by |
|---|---|---|
| `lib/cpp.ts#tier(value: number \| undefined): CppTier` | `'green' \| 'amber' \| 'muted'` (boundaries ≥3.0 / ≥1.5) | **inside `TierChip` only** — the single tier→token mapping in the codebase; `lib/search.ts:160/209` computes `option.tier = tier(option.cpp)`, so the chip's internal derivation is bit-identical to the engine's |
| `lib/cpp.ts#formatValue(v: number): string` | `"3.2¢/pt"` | inside `TierChip` (label + aria-label) |
| `lib/search.ts#assembleSearch(...)` → `SearchResult` | `options[].cpp/.tier`, `summary.{cheapestCash, bestMiles, bestCpp, saveVsCash}`, `verdict`, `degraded[]` | `TierChip` (per-option cpp), `Stat` (summary numbers via RouteBar/VerdictRail), `DegradedNote` (`degraded[]`) |
| `lib/accounts.ts#getUserBalances(sub)` → `Balance[]` (never throws, `[]` fallback) | program balances | `Stat` on `/account`, SignedInHome, PointsPanel |
| `lib/concierge-tools.ts#priceTrip` | same `SearchResult` shape, narrated in `/ask` | `A2UIBlock` renders its numbers through `TierChip`/`Stat` — the LLM narrates around them; the values pass through as computed data |
| `lib/points-bands.ts#formatPointsLabel/formatPointsCompact`, new `lib/format.ts#formatUSD/formatPoints` | formatted strings | `Stat` receives **pre-formatted strings from lib formatters** as props — the component never formats money itself, so formatting stays testable in node |

Enforcement is structural: `TierChip`'s props are `{ cpp: number; className?: string }` —
there is **no** `tier`/`color`/`tone` override prop, so a mislabeled value color is
unrepresentable (same mechanism as `Icon`'s size union). The exported `TIER_CLASS`/`TIER_WORD`/
`TIER_BAR` maps exist for the two rich-composition sites (DealCard, DestinationGuideCard) that
tint surrounding elements — they keep the mapping in one file, and the reviewer rule makes a
**literal tier value** (`'green'` etc.) flowing into them, rather than engine data
(`option.tier`, `tier(cpp)`), a P1. Call sites guard presence
(`option.cpp !== undefined && <TierChip cpp={option.cpp} />`); TierChip additionally renders
`null` for non-finite cpp — no placeholder chips fabricating a value.

## 4. Flags & seams

**No feature flag, and that is the honest answer, not an omission.** `HOP_ENABLE_*` gates
*runtime capability* that can misbehave when half-configured (checkout, Gmail, valuation
sync). A compile-time component layer has no unconfigured state: every PR either builds and
renders identically-or-better, or doesn't merge. The equivalent risk control is the seam
structure of the migration itself:

- Each primitive is additive; un-migrated hand-rolls keep rendering byte-for-byte until touched.
- No new env keys, no `process.env` reads, no `lib/env.ts` changes.
- The only "switch" is the ESLint ladder — each rule lands at `'warn'` (visible, non-blocking)
  and flips to `'error'` per-recipe only when its census grep is clean, so the guard can never
  block unrelated PRs during the opportunistic-migration tail.

## 5. Degradation plan

- **Primitives perform zero I/O and cannot throw**: pure sync functions of props — no fetch,
  no DB, no `withDb`, no hooks. Nothing here can add a throw path to a page.
- **`DegradedNote` remains the sanctioned degradation surface** and enters the index with its
  contract frozen: renders `null` for an empty/unmessaged `degraded[]`, keeps
  **`role="status"`**, calm `border-border bg-sunk` treatment, `warning` glyph. Its radius
  snaps `rounded-[12px]` → `var(--radius-sm)` in the Card PR — visual-only; the null contract
  and `role` are regression-tested (§7).
- **`TierChip` renders `null` for non-finite cpp** (belt-and-suspenders alongside the
  call-site guard) — a degraded award source produces *no chip*, never a fake one.
- **`Stat` renders exactly the string it is given**; when `summary.cheapestCash` is undefined
  (cash source degraded), the caller omits the stat — the existing per-section degradation
  pattern (`RouteBar`'s guards are the model and are preserved in migration).
- No new queries → no new `user_id` scoping surface. Nothing in this plan touches Supabase.

## 6. Migration strategy (the Work lane, made mechanical)

Eight PRs, strictly sequential, each XS–M, each self-proving. Per-PR recipe: **(1)**
create/extend the primitive (≤ ~80 lines), **(2)** migrate the named proof call sites, **(3)**
append the hand-roll grep to `copy-voice-reviewer.md` **and** land the matching ESLint rule at
`'warn'`, **(4)** update the `DESIGN-SYSTEM.md` index row *in the same diff* (A8's same-diff
rule), **(5)** `npm run check && npm run build && scripts/shoot.sh <touched routes>`. Re-run
the census greps first — the A-train shifts counts.

| PR | contents (train slot) | size |
|---|---|---|
| 1 | **Tokens** (A5 slice). Pre-flight namespace audit in the PR body: stock `rounded-sm` usage is **zero**, so `--radius-sm` in `@theme` is safe — and record that `--radius-lg: 20px` in `@theme` **already silently overrides 5 stock `rounded-lg` call sites** (`VerdictRail.tsx:378`, `CardAffiliateCTA.tsx:76`, `ai-elements/tool.tsx:33/139`, `SearchBar.tsx:1095`); bless or resolve that pre-existing collision in the same diff and write the v4 namespace-override behavior into `DESIGN-SYSTEM.md` + a `docs/solutions/` entry. Add `--track-*` tokens (named outside `--tracking-*` deliberately, comment says why): assign each role the plurality value of its census sites (defaults from the verified histogram: eyebrow `0.12em`, label `0.06em`, tag `0.10em`; do not invent new values — the 17-value histogram is in this plan's header). Proof snaps: RouteBar caption `tracking-[0.06em]` → `var(--track-label)`, one eyebrow. | XS |
| 2 | **Button completes** (A3): `ghost` + `ink` + `size` + `onDark` + typed `iconOnly`-requires-`aria-label`. Migrate **all five ink call sites** — one recipe, five slices: `CheckoutForm.tsx:416` (9px, class-strings-only checkout rule + `/book` shots), `ResultRow.tsx:306` (11px), `app/book/page.tsx:186`, `app/book/confirmation/page.tsx:65` (11px), `EmptyState.tsx:41` (12px) — killing all three drifted radii in one PR. Reviewer grep + `'warn'` rule for `border-[1.5px] border-text` and `bg-brand px-` outside `components/ui`. One scoped security-reviewer pass on the native-anchor path (`rel`/`target` on external links). | S |
| 3 | **TierChip + Chip** (A4a): delete **all seven** tier→color sites — `ResultRow.tsx:24` (+`BAR:29` via exported `TIER_BAR`), `DealCard.tsx:23` and `DestinationGuideCard.tsx:11` (compose from exported maps), `DestinationGrid.tsx:10`, `points/[amount]/page.tsx:45`, `LedgerDreamCard.tsx:261` (→ `Chip tone="brand"` — status, not tier), `DESIGN-SYSTEM.md:298` snippet. This is twin consolidation (playbook §6), not a sweep. `CABIN_CHIP` (`app/sweet-spots/[program]/page.tsx:40`) noted as named `Chip` debt. Vitest tier-boundary + null-contract tests. `'warn'` rule: `bg-good-bg text-good` / `Record<CppTier` outside `components/ui`. | S |
| 4 | **Card + Eyebrow + SectionHead.eyebrow** (A4b/A6): migrate 2 SignedInHome cards, 1 A2UIBlock card, eyebrows on both (top offenders: SignedInHome 9 radius recipes; A2UIBlock 13 card borders, 8 eyebrows). `DegradedNote` radius snap rides here (contract frozen, tests prove it). | M |
| 5 | **Stat + `lib/format.ts`**: migrate RouteBar's private `Stat` (`:19`), one SignedInHome stat, one CheckoutForm total (class-strings only). Decide `PricePair` by rule-of-three; record the decision in this file. **`lib/format.ts` is severable** — if the PR runs long, land `Stat` on the existing lib formatters and defer `format.ts` to its own XS PR. | S |
| 6 | **Field/Input/Textarea/Select**: canon extracted from ProgramsManager `:165`/`:346` inputs, `CheckoutForm.tsx:776` input and `:802` `appearance-none` + drawn-caret select (**ship as-is; a custom listbox is out of scope**). Focus model: `focus:border-brand` container pattern; ring suppression only via `.no-inner-ring`. Migrate ProgramsManager, HomeAirportPicker (`:83`), one CheckoutForm field. | M |
| 7 | **Enforcement flips + docs** (A8): flip each `'warn'` rule to `'error'` whose census grep is clean (never a big-bang switch); `DESIGN-SYSTEM.md` Primitives-index rewrite (delete the §Cards/§Value chips/§Eyebrow/§CTA buttons recipe prose at `:284/:294/:309/:319`); `CLAUDE.md` rule; ease-token drift fix (`:278` → `cubic-bezier(0.2, 0, 0, 1)`). Resolve the `--text-*` question empirically: the scale sits inside `@theme` (`globals.css:100–111`) so v4 *should* generate `text-2xs…text-hero` utilities, and `DESIGN-SYSTEM.md:124–125` is a **stale note** ("until v4 custom scale support lands"), not a decision; verified blast radius is near zero (stock `text-sm/base/lg/xl`: **0 uses** in app/components). Build + inspect; if shadowing stock utilities is still judged unsafe, the pre-agreed fallback is renaming to `--text-hop-*` — record whichever verdict in the doc. | S |
| 8 | **Visual pass the layer unlocks**: `outline-none` audit across its 14 files — the rule is "never suppress the global ring (`globals.css:181`) except via `.no-inner-ring`", not a focus-visible sweep; hover color-only audit via Card `interactive`; type-rhythm snap on migrated surfaces (pending PR 7's `--text-*` verdict); arrow-nudge/image-zoom compose via Button/Card once A2's utilities exist. | M |

After PR 8, every *remaining* hand-roll converts opportunistically: the warn-level rules make
new ones visible in every lint run, the error flips block them once a recipe's census is
clean, the reviewer greps catch template-literal escapes, and any agent editing a file for
other reasons swaps recipes it touches. **Measurable payoff** (playbook §6, checkable): a new
card + CTA + stat section drops from ~40 lines of recipe to ~10 lines of composition; the
verified census greps (46/29 `bg-paper` recipe, 71/32 `bg-surface`, 50 `rounded-[12px]`, 28
brand-solid, 103 eyebrows, 17 tracking values) are the burn-down baseline `/audit` tracks;
agents read one index table instead of re-deriving "how do we do buttons here".

## 7. Test plan

Vitest constraint verified: `vitest.config.ts` collects only `lib/**/*.test.ts` +
`app/**/*.test.ts`, **node env, no jsdom**. All primitives are pure sync components, so they
render in node via `react-dom/server#renderToStaticMarkup` + `createElement` from a plain
`.ts` test file — no config change, no new deps. `Sheet` (client, portal) is excluded.

`lib/__tests__/ui-primitives.test.ts`:

- **Variant-map meta-test** (machine-checks the flat law *and* Tailwind v4's silent-purge
  failure mode): walk every exported `Record` class map in `components/ui/*`; each value is a
  non-empty **static** string containing no `${` and none of
  `shadow|bg-gradient|blur|drop-shadow`.
- `TierChip` boundaries — cpp `3.0` → markup contains `bg-good-bg`; `2.9` → `bg-ok-bg`;
  `1.5` → `bg-ok-bg` (exact boundary); `1.4` → `bg-weak-bg`; label equals `formatValue(cpp)`;
  `NaN`/`Infinity` → renders nothing. (Note: 2.5 is `POINTS_THRESHOLD_CPP`, a *verdict* line,
  not a tier line — tier boundaries are 3.0/1.5 and both are tested exactly.)
- `Button` — `variant="ink"` markup contains `border-text`; `href` renders `<a>`; no `href`
  renders `<button type="button">`; `disabled` present; `iconOnly` without `aria-label` is a
  **type error** (compile-checked via `@ts-expect-error`). Fallback, written as a comment in
  the test file: if the `next/link` branch throws under bare `react-dom/server` (router
  context), assert on the exported variant maps directly and leave the Link path to
  `npm run build` + screenshots — do not stall re-deriving this.
- `Card` — each `surface`/`radius` combination emits the expected token classes; `interactive`
  adds `hover:border-brand` and nothing else.
- `Stat` — renders value inside a `hop-num` element verbatim (no reformatting).
- **Null contracts** — `DegradedNote` with `[]` and with unmessaged sources renders nothing
  and keeps `role="status"` when it does render; `EmptyState` renders its ink CTA via Button.

`lib/__tests__/format.test.ts`: `formatUSD(1234.5) === '$1,235'` (matches `dream-narration`
rounding), `formatPoints(60000) === '60,000'`, zero/negative/undefined-guard cases.

Commands, per PR:

```bash
npx vitest run lib/__tests__/ui-primitives.test.ts lib/__tests__/format.test.ts
npm run check          # lint (incl. the new warn/error rules) + typecheck + vitest
npm run build
scripts/shoot.sh / /search /deals /account /book   # before/after shots (MOCK=1)
```

Edge cases named: degraded cash source → RouteBar omits the cash `Stat` (existing behavior
preserved, verified in shots); empty balances → SignedInHome renders onboarding state with
zero fabricated `Stat`s; ESLint ladder verified by a deliberate uncommitted violation showing
a warning, a flipped rule failing `npm run lint`, and `components/ui/Button.tsx` itself still
passing (the `ignores` works).

## 8. Copy & design notes

- **No new user-facing copy.** Primitives are copy-free by design — text arrives as
  children/props from call sites, keeping `docs/design/copy-spec.md` enforcement at the
  surface layer where the copy-voice-reviewer already looks. `EmptyState`/`DegradedNote` copy
  is untouched.
- Flat editorial holds by construction: no variant string may contain shadow/gradient/blur
  (the meta-test + reviewer grep run over `components/ui/**` too — only the *hand-roll* greps
  exclude it). Hover states are **color-only** (`hover:bg-brand-deep`, `hover:border-brand`,
  ink's `hover:bg-text hover:text-white`); the only motion composes from A2's two sanctioned
  micro-moves.
- Tokens only: radii `--radius-sm/10 · --radius/14 · --radius-lg/20 · --radius-hero/28`;
  tracking `--track-eyebrow/label/tag`; colors from `@theme`. WCAG AA: the global
  `:focus-visible` ring (`globals.css:181`) covers every interactive primitive — the law is
  "never suppress it except via `.no-inner-ring`"; `Field` ties label→control with
  `htmlFor`/`id` and error text is real text, never color alone; `TierChip` carries the
  `formatValue — tier word` aria-label so color is never the only signal; icon-only Buttons
  require `aria-label` at the type level.
- `DESIGN-SYSTEM.md` becomes prescriptive ("use `<TierChip cpp={…}>`") instead of descriptive
  (paste-this-classlist); `docs/design/CHOSEN-editorial.html` stays the visual reference.

## 9. Risks & open questions

1. **Collision with the in-flight national-grade train.** A1 merged (#112); A2 is next. PRs
   here map onto A3–A6/A8 and must run *after* A2, sequentially, never concurrently on shared
   files (`ResultRow`, `SignedInHome`, `CheckoutForm`). Whoever executes checks `git log` for
   A2 first and re-runs the census greps — the counts in this plan are a 2026-07-02 snapshot.
2. **Tailwind v4 `--text-*` question.** Deferred to PR 7's empirical check (build + inspect),
   with the risk now bounded: zero stock `text-sm/base/lg/xl` usage exists, and `--text-hop-*`
   is the pre-agreed fallback naming. Until resolved, primitives keep shipped inline sizes
   (`text-[14.5px]`). Do **not** rename tokens speculatively.
3. **ESLint guard has partial coverage.** `no-restricted-syntax` on string literals catches
   plain `className`s; template literals with expressions escape it. Accepted: the reviewer
   grep (which sees raw diff text) is the backstop, and the warn→error ladder means a
   mis-tuned regex warns instead of blocking. Note the non-airtightness in the reviewer check.
4. **Premature abstraction (`PricePair`, `Card` slots).** The cash-vs-points block genuinely
   differs across VerdictRail/DealCard/A2UIBlock. Mitigation: rule of three, decided during
   PR 5, decision written back here. `Card` ships with no header/footer slots — it's a styled
   box; composition does the rest.
5. **Class-string drift inside variants.** With plain `Record` maps, nothing stops a future
   edit adding a shadow or an interpolation to one variant string. Mitigation: the variant-map
   meta-test (static, non-empty, no `${`, no shadow/gradient/blur) fails the suite the moment
   it happens.
6. **Exported tier maps are a soft edge.** `TIER_CLASS`/`TIER_WORD`/`TIER_BAR` exist for two
   rich-composition sites; a call site could feed them a literal tier. The type system can't
   enforce provenance, so the engine-invariant reviewer rule (literal tier = P1) is the
   backstop — and any *new* `Record<CppTier` map outside `components/ui/TierChip.tsx` is
   caught by grep.
7. **Hot-file collisions** (`SearchBar.tsx` ~1100 lines, `CheckoutForm.tsx` ~817): proof
   migrations there are single-recipe slices, never sweeps (playbook §6/§7); checkout slices
   are class-strings only with mandatory `/book` shots and a stop-and-replan rule if any diff
   touches behavior.
8. Nothing here is irreversible; no payment, booking, or data-touching surface changes
   behavior.

## 10. Review hooks

Run over each PR's diff (`/review-parallel`):

- **copy-voice-reviewer** — owns the design canon: flat-law, token-only, tracking/radius snap,
  the `outline-none`-without-`.no-inner-ring` P2, and it *receives new checks from every PR
  here* (the compounding step is literally part of the diff). Enforcement lives here — **no
  seventh reviewer**: `.claude/workflows/review-parallel.js` hard-codes the six-reviewer
  registry (ADR 0006), and a checklist appended to an existing reviewer costs nothing.
- **engine-invariant-reviewer** — verify `TierChip`/`Stat` render engine values without
  re-deriving them: no tier thresholds outside `lib/cpp.ts`, no formatting math in components
  beyond lib-formatted strings, no literal tier fed to the exported maps, no path where
  `/ask`'s LLM output reaches a `TierChip`/`Stat` prop.
- **nextjs16-reviewer** — RSC discipline: no `'use client'` creep into `components/ui/*`,
  Icon's SSR-entry pattern preserved, `next/link` polymorphism in Button still correct under
  Next 16 (cite `05-server-and-client-components.md`).
- **degradation-reviewer** — `DegradedNote` contract unchanged (`null` on empty,
  `role="status"`); migrated surfaces keep their per-section guards; confirm no primitive
  introduced a throw path.
- **security-reviewer** — one light pass, **scoped to PR 2 only**: Button's native-anchor
  path and `rel`/`target` handling for external-link call sites (the polymorphic anchor is
  the one place it earns a look). Otherwise not required — no auth, tokens, or queries are
  touched (state this in each PR body so the omission is deliberate).
- eve-architecture-reviewer is not required: no `eve/*` surface (state in PR bodies).

**Compound step** (after PR 8): add `docs/solutions/` entries — "UI primitives render in
node-env vitest via renderToStaticMarkup, no jsdom" and "Tailwind v4 `@theme` namespace
overrides: `--radius-lg` already re-points stock `rounded-lg`" — plus the `CLAUDE.md`
compose-don't-re-derive rule, so the next agent finds all three automatically.
