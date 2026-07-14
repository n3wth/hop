// hop's Astryx theme — maps Astryx design tokens onto hop's existing warm-
// editorial CSS custom properties (app/globals.css) so the narrow set of
// Astryx primitives (Dialog, DropdownMenu, Badge, EmptyState, Toast) render
// in hop's own colors/type/radii instead of Astryx's stock look. Light mode
// only — hop has no dark theme (see app/layout.tsx's `colorScheme: 'light'`).
//
// Token values are literal `var(--color-...)` strings pointing at
// app/globals.css's `:root` tokens, so this theme stays in lockstep with
// hop's palette automatically — edit a color once, in one place.
//
// Flat design law (docs/agent-playbook.md §4): no shadows, no gradients, no
// glows. `--shadow-*` are nulled to 'none' below so every Astryx component
// that reads a shadow token (Dialog, Popover/DropdownMenu, Toast, Card, ...)
// renders flat by construction, without per-component overrides drifting out
// of sync as new components are themed later.

import { defineTheme } from '@astryxdesign/core/theme'

// components/AccountMenu.tsx's trigger is a circular avatar photo, not a
// labeled button — none of Astryx's stock Button variants (primary/
// secondary/ghost/destructive) are a round, zero-padding, image-filling
// button, so this adds one via the documented module-augmentation escape
// hatch (see Astryx's own Button.d.ts JSDoc example for this exact pattern).
declare module '@astryxdesign/core/Button' {
  interface ButtonVariantMap {
    avatar: true
  }
}

export const hopTheme = defineTheme({
  name: 'hop',

  typography: {
    scale: { base: 14, ratio: 1.2 }, // matches --text-base: 14px
    body: {
      family: 'General Sans',
      fallbacks: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    },
    heading: {
      family: 'Bricolage Grotesque',
      fallbacks: 'system-ui, -apple-system, sans-serif',
      weight: 'semibold',
    },
    code: {
      family: 'Geist Mono',
      fallbacks: 'ui-monospace, "JetBrains Mono", monospace',
    },
  },

  motion: {
    fast: 150,
    medium: 300,
    ratio: 0.75,
    easing: 'cubic-bezier(0.2, 0, 0, 1)', // hop's --ease-premium
  },

  // No `radius` scale config — Astryx's defaults (base=4, multiplier=1) are
  // left as-is. --radius-inner stays 4px, which is what the Badge override
  // below relies on to match components/ui/Chip.tsx's original `rounded`
  // (Tailwind 4px) look; --radius-element/-container/-page are remapped
  // explicitly onto hop's own scale in `tokens` below.
  tokens: {
    // ---- Flat law: kill every Astryx elevation shadow --------------------
    '--shadow-low': 'none',
    '--shadow-med': 'none',
    '--shadow-high': 'none',

    // ---- Surfaces ----------------------------------------------------------
    '--color-background-body': 'var(--color-bg)',
    '--color-background-surface': 'var(--color-paper)', // Dialog panel bg — matches Sheet's old bg-paper
    '--color-background-card': 'var(--color-paper)',
    '--color-background-popover': 'var(--color-surface)', // DropdownMenu panel bg — matches AccountMenu's old bg-surface
    '--color-background-muted': 'var(--color-sunk)',
    '--color-background-inverted': 'var(--color-text)',
    '--color-overlay': 'rgba(0, 0, 0, 0.3)', // matches Sheet's old bg-black/30 scrim
    '--color-overlay-hover': 'var(--color-sunk)',
    '--color-overlay-pressed': 'var(--color-border-soft)',

    // ---- Accent / brand ------------------------------------------------
    '--color-accent': 'var(--color-brand)',
    '--color-accent-muted': 'var(--color-brand-light)',
    '--color-on-accent': '#ffffff',
    '--color-neutral': 'var(--color-sunk)',

    // ---- Text / icons ----------------------------------------------------
    '--color-text-primary': 'var(--color-text)',
    '--color-text-secondary': 'var(--color-text2)',
    '--color-text-disabled': 'var(--color-text3)',
    '--color-text-accent': 'var(--color-brand)',
    '--color-icon-primary': 'var(--color-text)',
    '--color-icon-secondary': 'var(--color-text3)',
    '--color-icon-disabled': 'var(--color-border)',
    '--color-icon-accent': 'var(--color-brand)',

    // ---- Borders / tracks --------------------------------------------------
    // hop's own token is ALSO named --color-border; referencing it from this
    // Theme-scoped block would form a CSS custom-property cycle and make the
    // token invalid inside Astryx components, so the tuned value is copied
    // verbatim from app/globals.css. Keep the two in sync.
    '--color-border': '#e2ddd2',
    '--color-border-emphasized': 'var(--color-text3)',
    '--color-skeleton': 'var(--color-sunk)',
    '--color-track': 'var(--color-sunk)',
    '--color-shadow': 'transparent', // belt-and-suspenders alongside the nulled --shadow-* above

    // ---- Semantic status — mapped onto hop's cpp-tier vocabulary ---------
    // (hop has no dedicated error red; `weak`/rust is the closest "needs
    // attention" tone it already uses.)
    '--color-success': 'var(--color-good)',
    '--color-success-muted': 'var(--color-good-bg)',
    '--color-on-success': '#ffffff',
    '--color-warning': 'var(--color-warn)',
    '--color-warning-muted': 'var(--color-gold-soft)',
    '--color-on-warning': 'var(--color-text)',
    '--color-error': 'var(--color-weak)',
    '--color-error-muted': 'var(--color-weak-bg)',
    '--color-on-error': '#ffffff',

    // ---- Categorical tints used by components/ui/Chip.tsx's TierChip -----
    // (green = "Excellent", yellow = "Good", orange = "Fair" — see
    // components/ui/Chip.tsx for the tier → Badge variant mapping.)
    '--color-background-green': 'var(--color-good-bg)',
    '--color-text-green': 'var(--color-good)',
    '--color-background-yellow': 'var(--color-ok-bg)',
    '--color-text-yellow': 'var(--color-ok)',
    '--color-background-orange': 'var(--color-weak-bg)',
    '--color-text-orange': 'var(--color-weak)',

    // ---- Radii used by Dialog / DropdownMenu / Toast containers -----------
    '--radius-element': 'var(--radius)', // 14px — menu items, toast
    '--radius-container': 'var(--radius-lg)', // 20px — Dialog / dropdown panel
    '--radius-page': 'var(--radius-hero)', // 28px
    '--radius-chat': 'var(--radius-hero)',
  },

  components: {
    // Chip/TierChip (components/ui/Chip.tsx) render as a small tinted pill —
    // Astryx's default Badge is a taller, fixed-height pill sized for
    // standalone status badges. Override the base box model to match the
    // original hand-rolled `px-2 py-0.5 rounded text-xs font-medium` pill
    // exactly, independent of the shared --radius-* scale (which starts
    // higher than this pill ever used).
    badge: {
      base: {
        height: 'auto',
        paddingBlock: '2px',
        paddingInline: '8px',
        borderRadius: '4px',
        fontSize: '12px',
        lineHeight: '1.4',
      },
    },
    // Explicit flat-law belt-and-suspenders: even though --shadow-high is
    // nulled above (which is what Dialog's box-shadow actually reads),
    // pin it here too so the intent survives a future token rename.
    dialog: {
      base: { boxShadow: 'none' },
    },
    // components/AccountMenu.tsx's trigger — see the module augmentation
    // above. Matches the original hand-rolled trigger exactly: a 40px teal
    // circle, hover = color change only (flat law — no scale/lift).
    button: {
      'variant:avatar': {
        width: '40px',
        height: '40px',
        padding: '0',
        borderRadius: 'var(--radius-full)',
        backgroundColor: 'var(--color-brand)',
        color: '#ffffff',
        overflow: 'hidden',
        ':hover': { backgroundColor: 'var(--color-brand-deep)' },
      },
    },
    // components/EmptyState.tsx's dashed-border "no results" panel. Only the
    // outer container is theme-addressable (Astryx doesn't expose the inner
    // title/description as separately themable parts) — their font/size
    // come from `typography.heading` above instead of an exact px match.
    'empty-state': {
      base: {
        borderRadius: '20px', // --radius-lg
        border: '1.5px dashed var(--color-border)',
        backgroundColor: 'var(--color-paper)',
        paddingBlock: '58px',
        paddingInline: '32px',
        textAlign: 'center',
      },
    },
  },
})
