# hop Design System

Canonical reference for colors, type, spacing, icons, copy, and component patterns.
The implementation lives in `app/globals.css` (`@theme`) and `components/Icon.tsx`.

---

## Principles

**Flat editorial.** No shadows, gradients, or glows. Depth comes from type weight, color, and
composition. Paper-grain background texture adds warmth without literal depth.

**Numbers deserve precision.** Every price, cpp value, balance, and stat renders in Geist Mono
via `.hop-price` or `.hop-num`. This signals "this is a computed fact, not marketing copy."

**Warm, not loud.** The palette is cream + deep teal. Accent is mint. The brand color is teal
(`--color-brand`), not neon. Color earns its place — a red error is genuinely bad news.

**Copy is confident.** State the answer and the number. No marketing slop, no emoji, no
filler. Full voice spec: `docs/design/copy-spec.md`.

---

## Color Tokens

All tokens are defined in `app/globals.css` → `@theme { ... }`.

### Canvas & Surface

| Token | Value | Usage |
|---|---|---|
| `--color-canvas` | `oklch(97.2% 0.008 83)` | Page background (warm cream) |
| `--color-paper` | `oklch(98.8% 0.005 83)` | Cards, modals, popovers |
| `--color-surface` | `oklch(96.5% 0.009 83)` | Secondary surfaces, alt sections |
| `--color-sunk` | `oklch(95.5% 0.010 83)` | Inset regions, stat grids |

### Text

| Token | Usage |
|---|---|
| `--color-text` | Primary body text |
| `--color-text2` | Secondary / supporting text |
| `--color-text3` | Tertiary / captions, labels |

### Brand

| Token | Value | Usage |
|---|---|---|
| `--color-brand` | `oklch(40% 0.13 192)` | Primary teal — CTAs, links, eyebrows |
| `--color-brand-deep` | `oklch(32% 0.11 192)` | Hover / pressed state |
| `--color-brand-light` | `oklch(93% 0.025 192)` | Light teal fill — icon backgrounds, callouts |
| `--color-brand-mint` | `oklch(72% 0.13 175)` | Accent mint — badges on dark |
| `--color-mint-bright` | `oklch(88% 0.14 175)` | High-contrast mint on dark |
| `--color-brand-ink` | `oklch(18% 0.07 192)` | Near-black for dark-on-light on brand bg |

### Value Tiers (good / ok / weak)

The cpp engine classifies redemptions into three tiers. UI must use these tokens so color
always means the same thing across surfaces (verdict, chip, search row, deal card).

| Tier | cpp range | Token | Usage |
|---|---|---|---|
| green | ≥ 3.0¢ | `--color-good`, `--color-good-bg` | Strong redemption |
| amber | ≥ 1.5¢ | `--color-ok`, `--color-ok-bg` | Adequate, not great |
| muted | < 1.5¢ | `--color-weak`, `--color-weak-bg` | Weak — consider cash |

These are the only places in the UI where red/amber/green appear. Never use them decoratively.

### Borders & Dividers

| Token | Usage |
|---|---|
| `--color-border` | Standard component border |
| `--color-hair` | Hairline dividers within a surface |

### Hero / Dark surfaces

The hero section and `/ask` landing use a dark teal backdrop. Specialized tokens:

| Token | Usage |
|---|---|
| `--color-hero-cream` | Warm cream text on dark |
| `--color-hero-body` | Secondary text on dark |
| `--color-hero-white-hover` | White-on-dark button hover state |

---

## Typography

### Fonts

| Role | Family | CSS var | Tailwind class |
|---|---|---|---|
| Display / headlines | Bricolage Grotesque | `--font-display` | `font-display` |
| Body | General Sans (Fontshare) | (default) | `font-sans` |
| Wordmark | Fraunces (italic) | `--font-serif` | `font-serif .wordmark` |
| Numbers / data | Geist Mono | `--font-mono` | via `.hop-num` / `.hop-price` |

### Number utility classes

Use these instead of inline `font-family` / `tabular-nums` on any computed value.

```css
.hop-num   { font-family: var(--font-mono); font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.hop-price { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-weight: 600; letter-spacing: -0.02em; }
```

- **`.hop-price`** — prominent price/cpp displays: checkout totals, RouteBar stats, DealCard miles, big balances
- **`.hop-num`** — inline data values: smaller stats, chips, secondary figures, times, flight numbers

When a parent switches to mono and contains a non-numeric unit (e.g. `mi`, `pts`), add `font-sans`
to the unit `<span>` to keep it in General Sans: `<span className="font-sans ml-1 text-[12px]">mi</span>`

### Type Scale

Defined as CSS custom properties in `@theme`:

```
--text-2xs: 10px   --text-xs: 11px    --text-sm: 12px    --text-base: 14px
--text-md: 15px    --text-lg: 16px    --text-xl: 18px    --text-2xl: 20px
--text-3xl: 24px   --text-4xl: 30px   --text-5xl: 40px   --text-hero: 64px
```

In Tailwind v4 these are not yet wired as `text-*` utilities. Use inline sizes (`text-[14px]`)
or the Tailwind default scale as needed until v4 custom scale support lands.

---

## Spacing Scale

4px base unit, defined in `@theme`:

```
--space-1: 4px   --space-2: 8px    --space-3: 12px  --space-4: 16px
--space-5: 20px  --space-6: 24px   --space-7: 28px  --space-8: 32px
--space-10: 40px --space-12: 48px  --space-14: 56px --space-16: 64px
--space-20: 80px --space-24: 96px
```

---

## Border Radius

Four steps, nothing off-scale. An arbitrary `rounded-[Npx]` outside this scale is a defect.

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `10px` | Small chips, notes, compact controls |
| `--radius` | `14px` | Standard cards, chips, inputs |
| `--radius-lg` | `20px` | Larger cards (LedgerDream) |
| `--radius-hero` | `28px` | Hero-scale cards on `lg:` |

### Tailwind v4 namespace override — blessed

`--radius-sm` and `--radius-lg` sit in Tailwind v4's stock `--radius-*` theme namespace, so
declaring them in `@theme` **re-points the stock utilities**: `rounded-sm` renders at 10px
(stock 0.25rem) and `rounded-lg` at 20px (stock 0.5rem). This is deliberate and blessed —
in this codebase `rounded-sm` / `rounded-lg` **are** the tokens, byte-identical to
`rounded-[var(--radius-sm)]` / `rounded-[var(--radius-lg)]`; either spelling is sanctioned.
Audit at bless time (2026-07-02): zero stock `rounded-sm` call sites existed; the five stock
`rounded-lg` call sites were already rendering at 20px and stay on-scale. Full write-up:
`docs/solutions/2026-07-02-tailwind-v4-theme-namespace-overrides.md`. The general rule: before
adding any `@theme` variable, check whether its name lands in a stock namespace — if it does,
you are re-pointing an existing utility, so bless it here or pick a name outside the namespace
(the `--track-*` tokens below chose the latter).

---

## Letter-spacing (tracking) tokens

Three role tokens in `@theme` replace hand-rolled `tracking-[0.…em]` values. They are named
`--track-*` — deliberately **outside** Tailwind's stock `--tracking-*` namespace — so the stock
`tracking-wide`/`tracking-tight` utilities keep their defaults and nothing is silently
re-pointed. There is no generated utility; use the arbitrary-value form:

| Token | Value | Role | Usage |
|---|---|---|---|
| `--track-eyebrow` | `0.12em` | Uppercase kickers / section eyebrows | `tracking-[var(--track-eyebrow)]` |
| `--track-label` | `0.06em` | Small uppercase captions / stat labels | `tracking-[var(--track-label)]` |
| `--track-tag` | `0.1em` | Chips, tags, badges | `tracking-[var(--track-tag)]` |

A new numeric `tracking-[0.…em]` in a diff is a defect (ESLint warns at `no-restricted-syntax`
level; the warn count is the migration burn-down). Negative display tracking (`tracking-[-…]`,
headline tightening) has no token and stays inline. Existing hand-rolled values convert
opportunistically when a file is touched — no sweeps.

---

## Icon System — Phosphor Icons

Icons use **Phosphor Icons** (`@phosphor-icons/react`), rendered via the `<Icon>` component
at `components/Icon.tsx`. All consumer code uses the legacy Material Symbols name strings;
the component maps them internally. Never import Phosphor directly from page/component code.

### Usage

```tsx
import Icon from '@/components/Icon'

<Icon name="flight" size={20} />
<Icon name="check_circle" size={16} weight="fill" className="text-good" />
<Icon name="shield" size={12} />
```

### Size scale — 12 / 16 / 20 / 24 only

The `size` prop is typed as the union `12 | 16 | 20 | 24`; off-scale sizes are compile errors.

| Size | Use |
|---|---|
| `12` | Eyebrow badges, status dots, micro-labels (uppercase 10.5–12px chips) |
| `16` | Icons inline with text (buttons, rows, notes) — the default choice |
| `20` | Icon-only controls (close buttons, tab bar, pagers, submit orbs) |
| `24` | Feature tiles — the `h-10`/`h-11` rounded `bg-brand-light` chips |

### Available icons

| Name (legacy) | Phosphor component | Notes |
|---|---|---|
| `search` | MagnifyingGlass | |
| `close` | X | |
| `add` | Plus | |
| `check` | Check | |
| `check_circle` | CheckCircle | |
| `menu` | List | |
| `info` | Info | |
| `error` | WarningCircle | Maps to warning/error states |
| `warning` | Warning | |
| `refresh` | ArrowClockwise | |
| `content_copy` | Copy | |
| `expand_more` | CaretDown | Dropdown chevron |
| `caret_up` | CaretUp | |
| `caret_left` | CaretLeft | |
| `caret_right` | CaretRight | |
| `arrow_right` | ArrowRight | |
| `arrow_left` | ArrowLeft | |
| `swap_horiz` | ArrowsLeftRight | Transfer / swap |
| `settings` | GearSix | |
| `notifications` | Bell | |
| `lock` | Lock | Secure checkout |
| `shield` | Shield | Trust / verification |
| `schedule` | Clock | Time / duration only — never sync/refresh |
| `house` | House | Home tab |
| `envelope` | EnvelopeSimple | Gmail / email connect |
| `stop` | Stop | Stop streaming (weight="fill") |
| `paper_plane` | PaperPlaneRight | Send / submit in composer |
| `flight` / `airplane` | Airplane | Flights |
| `suitcase` | Suitcase | Luggage / trips |
| `map_pin` | MapPin | Location |
| `compass` | Compass | Explore |
| `globe` | Globe | Worldwide |
| `calendar` | CalendarBlank | Dates |
| `credit_card` | CreditCard | Payment |
| `receipt_long` | Receipt | Itinerary details |
| `loyalty` | Tag | Loyalty programs |
| `deals` | SealPercent | Deals / promotions |
| `wallet` | Wallet | Balances |
| `currency` | CurrencyDollar | Dollar values |
| `trending_up` | TrendUp | Value / growth |
| `transfer` | ArrowsClockwise | Point transfers |
| `chart` | ChartBar | Analytics |
| `workspace_premium` / `trophy` | Trophy | Premium / top pick |
| `medal` | Medal | Award |
| `star` | Star | Favorites |
| `person` | User | Account |
| `logout` | SignOut | Sign out |
| `lightbulb` | Lightbulb | Tips / AI suggest |

### Default weight

The `<Icon>` component defaults to `regular` weight. `weight="fill"` is reserved for
**status marks** (`check_circle` in confirmations/eyebrow badges, `error`, `warning`) and
**brand feature-tile icons** (the `h-10`/`h-11` `bg-brand-light` chips). Navigation and
utility glyphs (carets, close, menu, search, arrows, refresh, settings) stay `regular`.
The component accepts all Phosphor weights: `thin | light | regular | bold | fill | duotone`.

### One concept, one glyph

| Concept | Glyph | Never |
|---|---|---|
| Retry / refresh / re-sync / start over | `refresh` | `swap_horiz`, `schedule`, `lightbulb` |
| Transfer / swap (points, origin↔destination) | `swap_horiz` | — |
| Watch / alert subscription | `notifications` (Bell) | Bell for anything else |
| Degraded / partial data | `warning` | `notifications` |
| Home tab | `house` | `compass` |
| Concierge "have hop book it" | `compass` | — |
| Gmail / email connect | `envelope` | `loyalty` |
| Time / duration | `schedule` (Clock) | Clock for sync/refresh actions |
| Flight content (route dividers may use `flight rotate-90`) | `flight` | `flight` as a send button |
| Send (composer) | `paper_plane` | rotated `flight` |
| Directional carets | `caret_left` / `caret_right` / `expand_more` / `caret_up` | CSS-rotated carets |

---

## Motion

Entrance animations are restrained, transform-only, and gated behind `prefers-reduced-motion`.

**`.hop-rise`** — fade-up entrance. Apply to sections; use `--hop-delay` CSS var for stagger:

```tsx
<section
  className="hop-rise"
  style={{ ['--hop-delay' as string]: '80ms' }}
>
```

**`.hop-rise` on destination cards** — pass `stagger={true}` to `DestinationGrid` and the
card index drives `120 + index * 70ms` delays automatically.

**Value bars** (VerdictRail) — width-expand on mount, transform-only.

**Bunny leap** (logo mark in TopNav) — single warm moment per session, on first arrival
(`FlyingBunny.tsx`), not on hover.

One easing token: `var(--ease-premium)` (`cubic-bezier(0.16, 1, 0.32, 1)`).

**No hover movement, anywhere.** `:hover`/`group-hover:` must never trigger `translate`,
`scale`, or any other transform — no card lift, no arrow nudge, no icon shift. Hover states are
`transition-colors` only (`hover:border-brand`, `hover:text-*`, `hover:bg-*`). This is a hard
rule, not a per-component judgment call — if a hover state needs to feel more alive, reach for a
color/border shift, not motion. (`.hop-press`/`.hop-press-card`'s `:active` scale-down is tap/press
feedback on click, a distinct interaction from hover, and is unaffected by this rule.)

---

## Component Patterns

### Cards

Flat, bordered, no shadow. Standard pattern:

```tsx
<div className="rounded-[var(--radius)] border border-border bg-paper p-6">
```

Hover state: `transition-colors hover:border-brand` (color shift only, no lift/shadow).

### Value chips (cpp / tier)

```tsx
// Chip color from tier():
const TIER_CHIP = {
  green: 'bg-good-bg text-good',
  amber: 'bg-ok-bg text-ok',
  muted: 'bg-weak-bg text-weak',
}

<span className={`hop-num rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${TIER_CHIP[tier(cppVal)]}`}>
  {formatValue(cppVal)}
</span>
```

### Eyebrow labels

Small uppercase tracking label above a section or card headline:

```tsx
<span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brand">
  Already know the route?
</span>
```

### CTA buttons

Primary (brand fill):
```tsx
<a className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-brand px-6 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-deep">
```

Secondary (bordered):
```tsx
<a className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-border bg-paper px-5 py-3 text-[14.5px] font-semibold text-text transition-colors hover:border-brand hover:text-brand">
```

Ghost (text link):
```tsx
<a className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand transition-colors hover:text-brand-deep">
  Label <span aria-hidden>→</span>
</a>
```

---

## Accessibility

- WCAG AA is required. Token colors were calibrated to pass — do not lighten them.
- `aria-hidden` on decorative icons and flag spans.
- Streaming narration text uses a `role="status" aria-live="polite"` SR-only span that
  announces only the *completed* text, not each streamed token.
- `prefers-reduced-motion` gates all entrance animations.
- Color alone never conveys state — tier chips have both color and a text value.

---

## Files

| File | Purpose |
|---|---|
| `app/globals.css` | All design tokens (`@theme`), utility classes (`.hop-num`, `.hop-price`, `.hop-rise`, `.wordmark`) |
| `app/layout.tsx` | Font loading (Bricolage Grotesque, Fraunces, Geist Mono from `next/font/google`) |
| `components/Icon.tsx` | Icon system — Phosphor wrapper with legacy name compatibility |
| `lib/cpp.ts` | `tier()`, `formatValue()` — the single source of cpp classification |
| `docs/design/copy-spec.md` | Full copy voice and language rules |
| `docs/design/CHOSEN-editorial.html` | Canonical visual reference (open in browser) |
