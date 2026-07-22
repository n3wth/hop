## hop design system — conventions

hop is a points-vs-cash flight optimizer. This library is the **flat editorial** system:
no shadows, gradients, or glows — depth comes from a warm paper-grain cream canvas,
type, color, and composition. Build with real Tailwind v4 utility classes and hop's own
CSS custom properties below; don't invent a different visual language.

**No provider or root wrapper needed.** Tokens are plain CSS custom properties already
loaded globally by `styles.css` — every component reads them directly (`var(--color-brand)`,
`bg-brand`, etc.) with no `ThemeProvider`/context to mount first.

### Styling idiom: Tailwind v4 utility classes + hop's own tokens

Compose with ordinary Tailwind utilities (`flex`, `gap-3`, `rounded-[12px]`, `px-4`,
`text-[14px]`) plus hop's color/spacing/motion tokens, referenced either as a Tailwind
class or directly as `var(--token-name)` in inline styles:

| Purpose | Tokens |
|---|---|
| Surfaces | `bg-bg` (cream canvas), `bg-paper` (card), `bg-surface` (white), `bg-sunk` (recessed) |
| Text | `text-text` (ink), `text-text2` (ink-soft), `text-text3` (ink-faint) |
| Brand | `bg-brand` / `text-brand` (teal), `bg-brand-deep`, `bg-brand-ink` (dark hero surface) |
| Borders | `border-border`, `border-hair` (hairline) |
| Value tiers | `text-good`/`bg-good-bg` (green, cpp ≥ 3.0), `text-ok`/`bg-ok-bg` (amber, ≥ 1.5), `text-weak`/`bg-weak-bg` (rust, below) — **only** for cents-per-point value classification, never generic status |
| Type | `font-display` (Bricolage Grotesque, headings), `font-sans` (General Sans, body — the default), `font-mono` (Geist Mono, numerals/receipts) |
| Radius | `rounded-[var(--radius)]` (12px, standard), `rounded-[var(--radius-lg)]` (sheets/panels) |
| Motion | single easing token `var(--ease-premium)`; transform-only entrances, never `hover:` movement (no card lift, no arrow nudge — hover is `transition-colors` only) |
| Eyebrow labels | `tracking-[var(--track-eyebrow)]` + `text-[12px] font-semibold uppercase` |

Dark-hero surfaces (verdict panels, wallet, `CardAffiliateCTA`) use `bg-brand-ink` with
white/`text-hero-label`/`text-mint-bright` text — never mix light-surface tokens
(`text-text`, `bg-paper`) into a dark-hero composition.

### Where the truth lives

Read `styles.css` (imports `_ds_bundle.css`, which carries every token as a real
`@theme`/`:root` custom property, plus hop's few hand-authored utility classes like
`.hop-skeleton`, `.hop-spin`, `.hop-rise`) before styling anything net-new. Per-component
API docs are each `<Name>.prompt.md` alongside `<Name>.d.ts`. `guidelines/index.md` carries
hop's broader design-system source material.

### Example

```tsx
import { SectionHead, DegradedNote, Button } from 'hop'

function OtherWaysToFly() {
  return (
    <section>
      <SectionHead title="Other ways to fly" note="6 more options" />
      <DegradedNote degraded={['awards']} />
      <div className="mt-4 flex gap-3">
        <Button>Search again</Button>
        <Button variant="secondary">Adjust dates</Button>
      </div>
    </section>
  )
}
```
